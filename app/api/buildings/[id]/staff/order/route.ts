import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { tlOwnsBuilding } from "@/lib/teamLeaderScope";
import { reorderTimesheetRows } from "@/lib/timesheetRows";
import type { TimesheetEntries } from "@/lib/types";

// Reflete o novo reorder nas folhas ainda "draft" deste prédio (presente e
// futuras, se já tiverem sido criadas) — sem isso a folha ficava com a
// ordem antiga congelada de quando foi criada (ver
// lib/timesheetSnapshot.ts) até alguém recriar a semana do zero. Só a ORDEM
// muda; horas já lançadas, covers e vagas continuam intocados. Folhas
// submitted/done não entram na busca (`status: "draft"`) — essas já são
// histórico fechado.
async function resyncDraftTimesheetOrder(buildingId: bigint, staffIdOrder: Map<string, number> | null) {
  const drafts = await prisma.timesheet.findMany({
    where: { buildingId, status: "draft", deletedAt: null },
    select: { id: true, entries: true },
  });
  await Promise.all(
    drafts.map((t) => {
      const entries = t.entries as unknown as TimesheetEntries;
      const nextRows = reorderTimesheetRows(entries.rows, staffIdOrder);
      return prisma.timesheet.update({
        where: { id: t.id },
        data: { entries: { rows: nextRows } as any },
      });
    })
  );
}

// Ordem manual dos cleaners na folha de ponto, por prédio — ver
// StaffBuilding.ordem no schema.prisma e lib/timesheetRows.ts. Espelha
// PUT /api/teams/[id]/buildings/order (mesma ideia: manda a lista de ids na
// nova ordem, grava `ordem = índice`). Também disponível pro próprio time em
// /my (conta "team_leader" — só reordena, não move prédio entre times).
//
//   PUT { sbIds: string[] }  -> grava a ordem (0,1,2...) nesses vínculos
//   PUT { reset: true }      -> volta o prédio pro modo automático (ordem = null)
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const buildingId = BigInt(params.id);
  if (hasRole(user, "team_leader")) {
    if (!(await tlOwnsBuilding(user!, buildingId))) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
  } else if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json();

  if (body?.reset === true) {
    await prisma.staffBuilding.updateMany({
      where: { buildingId, role: "cleaner" },
      data: { ordem: null },
    });
    await resyncDraftTimesheetOrder(buildingId, null);
    return NextResponse.json({ ok: true });
  }

  const sbIds = Array.isArray(body?.sbIds) ? body.sbIds : null;
  if (!sbIds || sbIds.length === 0) {
    return NextResponse.json({ error: "sbIds is required" }, { status: 400 });
  }

  let ids: bigint[];
  try {
    ids = sbIds.map((s: unknown) => BigInt(s as string));
  } catch {
    return NextResponse.json({ error: "Invalid sbIds" }, { status: 400 });
  }

  // Só reordena vínculos de cleaner que de fato pertencem a este prédio —
  // e exige a lista COMPLETA (senão ficaria ordem parcial/furada).
  const cleaners = await prisma.staffBuilding.findMany({
    where: { buildingId, role: "cleaner" },
    select: { id: true, staffId: true },
  });
  const cleanerIds = new Set(cleaners.map((c) => c.id.toString()));
  const sent = new Set(ids.map((i) => i.toString()));
  if (sent.size !== ids.length || sent.size !== cleanerIds.size || ![...sent].every((i) => cleanerIds.has(i))) {
    return NextResponse.json(
      { error: "sbIds must be the full list of cleaner assignments for this building" },
      { status: 400 }
    );
  }

  await prisma.$transaction(
    ids.map((id, index) => prisma.staffBuilding.update({ where: { id }, data: { ordem: index } }))
  );

  // TimesheetRow.refId (linhas "staff") é o Staff.id, não o vínculo — mapeia
  // sbId -> staffId pra montar staffId -> posição.
  const staffIdBySbId = new Map(cleaners.map((c) => [c.id.toString(), c.staffId.toString()]));
  const staffIdOrder = new Map(ids.map((id, index) => [staffIdBySbId.get(id.toString())!, index]));
  await resyncDraftTimesheetOrder(buildingId, staffIdOrder);

  return NextResponse.json({ ok: true });
}
