import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeOpenSlots } from "@/lib/openSlots";
import { toJSONSafe } from "@/lib/types";
import { getCurrentUser, hasRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
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

  // Agrupamento por tamanho de hora dentro de cada prédio — vira o detalhe do
  // tooltip do gráfico "vagas em aberto por prédio" (1 vaga de 20h, 2 de 15h...).
  function groupByHours(slots: { horas: number }[]) {
    const map = new Map<number, number>();
    for (const s of slots) map.set(s.horas, (map.get(s.horas) ?? 0) + 1);
    return Array.from(map.entries())
      .map(([horas, count]) => ({ horas, count }))
      .sort((a, b) => b.horas - a.horas);
  }

  const buildingsOpenSlots = perBuilding
    .filter((b) => b.openSlots.length > 0)
    .map((b) => ({
      buildingId: b.buildingId,
      nome: b.nome,
      openSlotsCount: b.openSlots.length,
      breakdown: groupByHours(b.openSlots),
    }));

  // Mesmo agrupamento, mas invertido: por tamanho de hora, quais prédios têm
  // vaga aberta desse tamanho — vira o detalhe do tooltip do gráfico "vagas em
  // aberto por tamanho de hora".
  const bucketMap = new Map<number, { count: number; buildings: Map<string, { nome: string; count: number }> }>();
  for (const b of perBuilding) {
    for (const slot of b.openSlots) {
      const bucket = bucketMap.get(slot.horas) ?? { count: 0, buildings: new Map() };
      bucket.count += 1;
      const entry = bucket.buildings.get(b.buildingId) ?? { nome: b.nome, count: 0 };
      entry.count += 1;
      bucket.buildings.set(b.buildingId, entry);
      bucketMap.set(slot.horas, bucket);
    }
  }
  const openSlotsByHours = Array.from(bucketMap.entries())
    .map(([horas, { count, buildings }]) => ({
      horas,
      count,
      buildings: Array.from(buildings.entries())
        .map(([buildingId, b]) => ({ buildingId, nome: b.nome, count: b.count }))
        .sort((a, b) => b.count - a.count),
    }))
    .sort((a, b) => a.horas - b.horas);
  const totalOpenSlots = openSlotsByHours.reduce((sum, b) => sum + b.count, 0);

  // Só entram no balanço prédios com horasDisponiveis configurado — um prédio
  // sem limite definido não tem o que comparar (ver BuildingStatsBadge).
  const buildingsWithLimit = perBuilding.filter(
    (b): b is typeof b & { horasDisponiveis: number; hoursDelta: number } => b.horasDisponiveis != null
  );
  // O balanço total (abaixo) soma TODOS os prédios com limite configurado; só a
  // lista exibida no gráfico corta os que já estão zerados (nada a mostrar ali).
  const buildingsHoursBalance = buildingsWithLimit
    .filter((b) => b.hoursDelta !== 0)
    .map((b) => ({
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
