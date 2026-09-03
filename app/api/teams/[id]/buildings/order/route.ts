import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/auth";

// Salva a ordem dos prédios dentro do time (setas pra cima/baixo em
// /teams/[id] — ver TeamBuildingsOrderList). Grava em Building.teamOrder;
// essa ordem é usada tanto na listagem do time quanto na folha impressa
// (/timesheets/leader/[id] e no editor semanal, via GET /api/timesheets).
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const teamId = BigInt(params.id);
  const body = await req.json();
  const buildingIds = Array.isArray(body.buildingIds) ? body.buildingIds : null;
  if (!buildingIds || buildingIds.length === 0) {
    return NextResponse.json({ error: "buildingIds is required" }, { status: 400 });
  }

  let ids: bigint[];
  try {
    ids = buildingIds.map((s: unknown) => BigInt(s as string));
  } catch {
    return NextResponse.json({ error: "Invalid buildingIds" }, { status: 400 });
  }

  // Só reordena prédios que de fato pertencem a este time — evita que um
  // id de fora (ou de outro time) role de propósito ou por engano vire
  // reordenação.
  const owned = await prisma.building.findMany({ where: { id: { in: ids }, teamId }, select: { id: true } });
  const ownedIds = new Set(owned.map((b) => b.id.toString()));
  if (ownedIds.size !== ids.length) {
    return NextResponse.json({ error: "buildingIds must all belong to this team" }, { status: 400 });
  }

  await prisma.$transaction(ids.map((id, index) => prisma.building.update({ where: { id }, data: { teamOrder: index } })));

  return NextResponse.json({ ok: true });
}
