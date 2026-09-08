import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toJSONSafe } from "@/lib/types";
import { getCurrentUser, hasRole } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; staffId: string } }
) {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json();
  const horas = body.horasSemana;
  const sbId = body.sbId;
  const role = body.role;

  if (horas !== null && (typeof horas !== "number" || horas < 0)) {
    return NextResponse.json({ error: "Invalid hours" }, { status: 400 });
  }

  const staffId = BigInt(params.staffId);
  const buildingId = BigInt(params.id);

  // O mesmo staff pode ter vários vínculos no mesmo prédio (cleaner em dois
  // turnos/postos, ou cleaner + team leader), cada um com suas próprias
  // horas — `sbId` identifica exatamente qual. `role` (legado) ainda é
  // aceito e atinge o primeiro vínculo daquele papel.
  const target = sbId
    ? await prisma.staffBuilding.findFirst({ where: { id: BigInt(sbId), staffId, buildingId } })
    : role === "cleaner" || role === "team_leader"
      ? await prisma.staffBuilding.findFirst({ where: { staffId, buildingId, role } })
      : null;

  if (!target) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  const updated = await prisma.staffBuilding.update({
    where: { id: target.id },
    data: { horas },
  });

  return NextResponse.json(
    toJSONSafe({
      staffId: updated.staffId.toString(),
      buildingId: updated.buildingId.toString(),
      horas: updated.horas,
    })
  );
}
