import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toJSONSafe } from "@/lib/types";
import type { TimesheetEntries } from "@/lib/types";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { tlOwnsBuilding } from "@/lib/teamLeaderScope";

// Reflete o novo rótulo nas folhas ainda "draft" deste prédio — sem isso a
// folha ficava com o Building/WO antigo congelado de quando foi criada (ver
// lib/timesheetSnapshot.ts) até a semana ser recriada do zero. Casamento é
// por `refId` (Staff.id) — se o mesmo staff tiver dois vínculos no mesmo
// prédio (dois turnos), as duas linhas recebem o mesmo rótulo (limitação do
// formato, raro na prática — mesma ressalva do reorder em staff/order/route.ts).
async function resyncDraftTimesheetSheetLabel(
  buildingId: bigint,
  staffId: string,
  predioLabel: string | null,
  workOrder: string | null
) {
  const drafts = await prisma.timesheet.findMany({
    where: { buildingId, status: "draft", deletedAt: null },
    select: { id: true, entries: true },
  });
  await Promise.all(
    drafts.map((t) => {
      const entries = t.entries as unknown as TimesheetEntries;
      let changed = false;
      const nextRows = entries.rows.map((r) => {
        if (r.kind !== "staff" || r.refId !== staffId) return r;
        changed = true;
        return { ...r, predioLabel, workOrder };
      });
      if (!changed) return null;
      return prisma.timesheet.update({ where: { id: t.id }, data: { entries: { rows: nextRows } as any } });
    })
  );
}

// Building/WO que aparecem NA FOLHA pra um vínculo específico (ver
// StaffBuilding.predioLabel/workOrder e lib/timesheetRows.ts). Vazio = usa o
// nome/WO do prédio. Editável na folha (modo Edit), na página do prédio e,
// pro próprio time, em /my (conta "team_leader" — só o rótulo da folha, não
// mexe no cadastro do prédio).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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
  if (!body?.sbId) {
    return NextResponse.json({ error: "sbId is required" }, { status: 400 });
  }

  const norm = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

  const data: { predioLabel?: string | null; workOrder?: string | null } = {};
  if ("predioLabel" in body) data.predioLabel = norm(body.predioLabel);
  if ("workOrder" in body) data.workOrder = norm(body.workOrder);
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const target = await prisma.staffBuilding.findFirst({
    where: { id: BigInt(body.sbId), buildingId, role: "cleaner" },
  });
  if (!target) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  const updated = await prisma.staffBuilding.update({ where: { id: target.id }, data });

  await resyncDraftTimesheetSheetLabel(buildingId, target.staffId.toString(), updated.predioLabel, updated.workOrder);

  return NextResponse.json(
    toJSONSafe({
      sbId: updated.id.toString(),
      predioLabel: updated.predioLabel,
      workOrder: updated.workOrder,
    })
  );
}
