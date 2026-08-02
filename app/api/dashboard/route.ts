import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeOpenSlots } from "@/lib/openSlots";
import { toJSONSafe } from "@/lib/types";
import { getCurrentUser, hasRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const [totalStaff, totalCleaners, totalTeamLeaders, buildings] = await Promise.all([
    prisma.staff.count(),
    prisma.staff.count({ where: { buildingsAsTeamLeader: { some: { role: "cleaner" } } } }),
    prisma.staff.count({ where: { buildingsAsTeamLeader: { some: { role: "team_leader" } } } }),
    prisma.building.findMany({
      orderBy: { nome: "asc" },
      include: {
        slots: { orderBy: { ordem: "asc" } },
        teamLeaders: { include: { staff: true } },
      },
    }),
  ]);

  const perBuilding = buildings.map((b) => {
    const cleanerLinks = b.teamLeaders.filter((l) => l.role === "cleaner");
    const cleanerHours = cleanerLinks.map((l) => ({ horasSemana: l.horas ?? l.staff.horasSemana }));
    const horasGastas = cleanerHours.reduce((sum, c) => sum + (c.horasSemana ?? 0), 0);

    const slots = b.slots.map((s) => ({ id: s.id.toString(), horas: s.horas }));
    const openSlots = computeOpenSlots(slots, cleanerHours);

    const hoursDelta = b.horasDisponiveis != null ? b.horasDisponiveis - horasGastas : null;

    return {
      buildingId: b.id.toString(),
      nome: b.nome,
      horasDisponiveis: b.horasDisponiveis,
      horasGastas,
      hoursDelta,
      openSlots: openSlots.map((s) => ({ horas: s.horas })),
    };
  });

  const buildingsOpenSlots = perBuilding
    .filter((b) => b.openSlots.length > 0)
    .map((b) => ({ buildingId: b.buildingId, nome: b.nome, openSlotsCount: b.openSlots.length }));

  const bucketMap = new Map<number, number>();
  for (const b of perBuilding) {
    for (const slot of b.openSlots) {
      bucketMap.set(slot.horas, (bucketMap.get(slot.horas) ?? 0) + 1);
    }
  }
  const openSlotsByHours = Array.from(bucketMap.entries())
    .map(([horas, count]) => ({ horas, count }))
    .sort((a, b) => a.horas - b.horas);
  const totalOpenSlots = openSlotsByHours.reduce((sum, b) => sum + b.count, 0);

  // Só entram no balanço prédios com horasDisponiveis configurado — um prédio
  // sem limite definido não tem o que comparar (ver BuildingStatsBadge).
  const buildingsWithLimit = perBuilding.filter(
    (b): b is typeof b & { horasDisponiveis: number; hoursDelta: number } => b.horasDisponiveis != null
  );
  const buildingsHoursBalance = buildingsWithLimit.map((b) => ({
    buildingId: b.buildingId,
    nome: b.nome,
    horasDisponiveis: b.horasDisponiveis,
    horasGastas: b.horasGastas,
    hoursDelta: b.hoursDelta,
  }));
  const totalHorasDisponiveis = buildingsWithLimit.reduce((sum, b) => sum + b.horasDisponiveis, 0);
  const totalHorasGastas = buildingsWithLimit.reduce((sum, b) => sum + b.horasGastas, 0);
  const grandTotal = {
    horasDisponiveis: totalHorasDisponiveis,
    horasGastas: totalHorasGastas,
    hoursDelta: totalHorasDisponiveis - totalHorasGastas,
    buildingsCounted: buildingsWithLimit.length,
  };

  return NextResponse.json(
    toJSONSafe({
      counts: { totalStaff, totalCleaners, totalTeamLeaders },
      buildingsOpenSlots,
      openSlotsByHours,
      totalOpenSlots,
      buildingsHoursBalance,
      grandTotal,
    })
  );
}
