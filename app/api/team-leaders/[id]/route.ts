import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toJSONSafe } from "@/lib/types";
import { getCurrentUser, hasRole } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const teamLeader = await prisma.staff.findUnique({
    where: { id: BigInt(params.id) },
    include: { buildingsAsTeamLeader: { include: { building: true } }, loginAccount: true },
  });

  const leaderLinks = teamLeader?.buildingsAsTeamLeader.filter((l) => l.role === "team_leader") ?? [];

  if (!teamLeader || leaderLinks.length === 0) {
    return NextResponse.json({ error: "Team leader not found" }, { status: 404 });
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

  const allCovers = await prisma.buildingCover.findMany({
    where: { buildingId: { in: buildingIds } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    toJSONSafe({
      id: teamLeader.id.toString(),
      nome: teamLeader.nome,
      staffNumber: teamLeader.staffNumber,
      telefone: teamLeader.telefone,
      loginAccount: teamLeader.loginAccount
        ? {
            id: teamLeader.loginAccount.id.toString(),
            username: teamLeader.loginAccount.username,
            active: teamLeader.loginAccount.active,
          }
        : null,
      buildings: leaderLinks.map((l) => ({
        id: l.building.id.toString(),
        nome: l.building.nome,
        horasDisponiveis: l.building.horasDisponiveis,
        workOrder: l.building.workOrder,
        slots: allSlots
          .filter((s) => s.buildingId === l.buildingId)
          .map((s) => ({ id: s.id.toString(), horas: s.horas })),
        covers: allCovers
          .filter((c) => c.buildingId === l.buildingId)
          .map((c) => ({ id: c.id.toString(), nome: c.nome, staffNumber: c.staffNumber, horas: c.horas })),
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
