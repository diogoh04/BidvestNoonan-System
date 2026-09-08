import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/auth";

// Ordem manual dos cleaners na folha de ponto, por prédio — ver
// StaffBuilding.ordem no schema.prisma e lib/timesheetRows.ts. Espelha
// PUT /api/teams/[id]/buildings/order (mesma ideia: manda a lista de ids na
// nova ordem, grava `ordem = índice`).
//
//   PUT { sbIds: string[] }  -> grava a ordem (0,1,2...) nesses vínculos
//   PUT { reset: true }      -> volta o prédio pro modo automático (ordem = null)
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const buildingId = BigInt(params.id);
  const body = await req.json();

  if (body?.reset === true) {
    await prisma.staffBuilding.updateMany({
      where: { buildingId, role: "cleaner" },
      data: { ordem: null },
    });
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
    select: { id: true },
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

  return NextResponse.json({ ok: true });
}
