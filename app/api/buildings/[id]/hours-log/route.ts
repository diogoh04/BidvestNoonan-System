import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toJSONSafe } from "@/lib/types";
import { getCurrentUser, hasRole } from "@/lib/auth";

// Lança (ou edita) quanto foi gasto neste prédio numa semana específica —
// ver comentário do model BuildingHoursLog no schema.prisma. Upsert: uma
// linha por prédio+semana. UCD Hours é editado só em /buildings/[id] e
// /teams/[id] (BuildingHoursCard) — aqui só CONGELA (snapshot) o valor ao
// vivo do prédio na primeira vez que a semana é lançada; edições
// seguintes a essa mesma semana mudam só hoursSpent, nunca o snapshot.
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json();
  const { weekStart, hoursSpent } = body;

  if (!weekStart || typeof weekStart !== "string") {
    return NextResponse.json({ error: "Missing weekStart" }, { status: 400 });
  }
  if (typeof hoursSpent !== "number" || isNaN(hoursSpent) || hoursSpent < 0) {
    return NextResponse.json({ error: "Invalid hours" }, { status: 400 });
  }

  const buildingId = BigInt(params.id);
  const weekStartDate = new Date(weekStart);

  const existing = await prisma.buildingHoursLog.findUnique({
    where: { buildingId_weekStart: { buildingId, weekStart: weekStartDate } },
  });

  let ucdHours = existing?.ucdHours ?? null;
  if (ucdHours === null) {
    // Primeira vez que essa semana é lançada (ou uma linha antiga sem
    // snapshot ainda) — congela o valor ao vivo agora.
    const building = await prisma.building.findUnique({ where: { id: buildingId }, select: { horasDisponiveis: true } });
    ucdHours = building?.horasDisponiveis ?? null;
  }

  const log = await prisma.buildingHoursLog.upsert({
    where: { buildingId_weekStart: { buildingId, weekStart: weekStartDate } },
    update: { hoursSpent, ucdHours },
    create: { buildingId, weekStart: weekStartDate, hoursSpent, ucdHours },
  });

  return NextResponse.json(
    toJSONSafe({ buildingId: log.buildingId.toString(), weekStart, hoursSpent: log.hoursSpent, ucdHours: log.ucdHours })
  );
}
