import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toJSONSafe } from "@/lib/types";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { getMonthRange } from "@/lib/week";

export const dynamic = "force-dynamic";

// Horas gastas lançadas (BuildingHoursLog), usado pela visão geral de
// /hours-control e pelo detalhe de um time. Dois modos, mutuamente
// exclusivos:
//   - ?weekStart=YYYY-MM-DD  -> uma semana só, um valor por prédio.
//   - ?month=YYYY-MM         -> soma de todas as semanas lançadas dentro do
//     mês (visão mensal agregada, sem guardar um "orçamento mensal" à parte).
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const weekStart = searchParams.get("weekStart");
  const month = searchParams.get("month");
  if (!weekStart && !month) {
    return NextResponse.json({ error: "Missing weekStart or month" }, { status: 400 });
  }

  const buildingIdsParam = searchParams.get("buildingIds");
  const buildingIds = buildingIdsParam ? buildingIdsParam.split(",").map((id) => BigInt(id)) : undefined;

  if (month) {
    const { startISO, endISO } = getMonthRange(month);
    const logs = await prisma.buildingHoursLog.findMany({
      where: {
        weekStart: { gte: new Date(startISO), lte: new Date(endISO) },
        ...(buildingIds ? { buildingId: { in: buildingIds } } : {}),
      },
    });
    const sums = new Map<string, number>();
    for (const l of logs) {
      const key = l.buildingId.toString();
      sums.set(key, (sums.get(key) ?? 0) + l.hoursSpent);
    }
    return NextResponse.json(
      toJSONSafe(Array.from(sums.entries()).map(([buildingId, hoursSpent]) => ({ buildingId, hoursSpent })))
    );
  }

  const logs = await prisma.buildingHoursLog.findMany({
    where: {
      weekStart: new Date(weekStart!),
      ...(buildingIds ? { buildingId: { in: buildingIds } } : {}),
    },
  });

  return NextResponse.json(
    toJSONSafe(
      logs.map((l) => ({
        buildingId: l.buildingId.toString(),
        weekStart,
        hoursSpent: l.hoursSpent,
      }))
    )
  );
}
