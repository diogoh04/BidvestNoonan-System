import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toJSONSafe } from "@/lib/types";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const teamLeader = await prisma.staff.findUnique({
    where: { id: BigInt(params.id) },
    include: { buildingsAsTeamLeader: { include: { building: true } } },
  });

  const leaderLinks = teamLeader?.buildingsAsTeamLeader.filter((l) => l.role === "team_leader") ?? [];

  if (!teamLeader || leaderLinks.length === 0) {
    return NextResponse.json({ error: "Team leader não encontrado" }, { status: 404 });
  }

  const buildingIds = leaderLinks.map((l) => l.buildingId);

  const links = await prisma.staffBuilding.findMany({
    where: { buildingId: { in: buildingIds } },
    include: { staff: true },
  });

  const allSlots = await prisma.buildingSlot.findMany({
    where: { buildingId: { in: buildingIds } },
    orderBy: { ordem: "asc" },
  });

  return NextResponse.json(
    toJSONSafe({
      id: teamLeader.id.toString(),
      nome: teamLeader.nome,
      staffNumber: teamLeader.staffNumber,
      telefone: teamLeader.telefone,
      buildings: leaderLinks.map((l) => ({
        id: l.building.id.toString(),
        nome: l.building.nome,
        horasDisponiveis: l.building.horasDisponiveis,
        workOrder: l.building.workOrder,
        slots: allSlots
          .filter((s) => s.buildingId === l.buildingId)
          .map((s) => ({ id: s.id.toString(), horas: s.horas })),
        cleaners: links
          .filter((link) => link.buildingId === l.buildingId && link.role === "cleaner")
          .map((link) => ({
            id: link.staff.id.toString(),
            nome: link.staff.nome,
            staffNumber: link.staff.staffNumber,
            telefone: link.staff.telefone,
            horasSemana: link.horas ?? link.staff.horasSemana,
          })),
      })),
    })
  );
}
