import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { closeBuildingAssignment } from "@/lib/staffHistory";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; staffId: string } }
) {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const staffId = BigInt(params.staffId);
  const buildingId = BigInt(params.id);

  // O mesmo staff pode ter vários vínculos no mesmo prédio (cleaner em dois
  // turnos/postos, ou cleaner + team leader). `sbId` identifica exatamente
  // qual remover; `role` (legado) ainda é aceito e remove o primeiro daquele
  // papel.
  const url = new URL(req.url);
  const sbId = url.searchParams.get("sbId");
  const role = url.searchParams.get("role");

  const target = sbId
    ? await prisma.staffBuilding.findFirst({ where: { id: BigInt(sbId), staffId, buildingId } })
    : role === "cleaner" || role === "team_leader"
      ? await prisma.staffBuilding.findFirst({ where: { staffId, buildingId, role } })
      : null;

  if (!target) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  await prisma.staffBuilding.delete({ where: { id: target.id } });

  // Histórico (ver lib/staffHistory.ts) — só faz sentido pra cleaner; o
  // vínculo "team_leader" aqui é derivado de TeamLeader (lib/teams.ts já
  // cuida do histórico de liderança quando o time é que muda). Só fecha a
  // trilha do prédio se NÃO sobrou nenhum outro vínculo de cleaner desse
  // staff nesse prédio.
  if (target.role === "cleaner") {
    const stillCleaner = await prisma.staffBuilding.findFirst({
      where: { staffId, buildingId, role: "cleaner" },
    });
    if (!stillCleaner) {
      await closeBuildingAssignment(staffId, buildingId);
    }
  }

  return NextResponse.json({ ok: true });
}
