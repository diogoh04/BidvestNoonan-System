import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toJSONSafe } from "@/lib/types";
import { getCurrentUser, hasRole } from "@/lib/auth";

// Lança (ou edita) quanto foi gasto neste prédio numa semana específica —
// ver comentário do model BuildingHoursLog no schema.prisma. Upsert: uma
// linha por prédio+semana.
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

  const log = await prisma.buildingHoursLog.upsert({
    where: { buildingId_weekStart: { buildingId, weekStart: weekStartDate } },
    update: { hoursSpent },
    create: { buildingId, weekStart: weekStartDate, hoursSpent },
  });

  return NextResponse.json(
    toJSONSafe({ buildingId: log.buildingId.toString(), weekStart, hoursSpent: log.hoursSpent })
  );
}
