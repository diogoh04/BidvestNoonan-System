import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { toJSONSafe } from "@/lib/types";

// Prédios do Team Leader logado, derivados do StaffBuilding já existente —
// nunca de um id vindo do cliente (evita um team leader ver dados de outro).
export async function GET() {
  const user = await getCurrentUser();
  if (!hasRole(user, "team_leader") || !user!.staffId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const staffId = BigInt(user!.staffId);

  const [teamLeader, leaderLinks] = await Promise.all([
    prisma.staff.findUnique({ where: { id: staffId } }),
    prisma.staffBuilding.findMany({
      where: { staffId, role: "team_leader" },
      include: { building: true },
      orderBy: { building: { nome: "asc" } },
    }),
  ]);

  const buildingIds = leaderLinks.map((l) => l.buildingId);

  const cleanerLinks = await prisma.staffBuilding.findMany({
    where: { buildingId: { in: buildingIds }, role: "cleaner" },
    include: { staff: true },
  });

  return NextResponse.json(
    toJSONSafe({
      id: teamLeader?.id.toString() ?? null,
      nome: teamLeader?.nome ?? null,
      staffNumber: teamLeader?.staffNumber ?? null,
      buildings: leaderLinks.map((l) => ({
        id: l.building.id.toString(),
        nome: l.building.nome,
        workOrder: l.building.workOrder,
        cleaners: cleanerLinks
          .filter((c) => c.buildingId === l.buildingId)
          .map((c) => ({
            id: c.staff.id.toString(),
            nome: c.staff.nome,
            staffNumber: c.staff.staffNumber,
            telefone: c.staff.telefone,
            horasSemana: c.horas ?? c.staff.horasSemana,
          })),
      })),
    })
  );
}
