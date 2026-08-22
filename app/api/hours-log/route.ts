import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toJSONSafe } from "@/lib/types";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { getMonthRange } from "@/lib/week";

export const dynamic = "force-dynamic";

// Lançamentos (BuildingHoursLog), usado pela visão geral de /hours-control e
// pelo detalhe de um time. Sempre devolve linhas CRUAS (uma por prédio+
// semana já lançada) — nunca agregadas aqui, porque semanas sem lançamento
// não têm linha nenhuma e o "UCD Hours" delas precisa cair pro valor ao vivo
// do prédio (que quem chama já tem à mão) em vez de ficar de fora da conta.
// Dois modos, mutuamente exclusivos:
//   - ?weekStart=YYYY-MM-DD  -> só as linhas dessa semana.
//   - ?month=YYYY-MM         -> todas as linhas com weekStart dentro do mês
//     (quem chama soma semana a semana, cruzando com getMondaysInMonth).
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

  const where = month
    ? (() => {
        const { startISO, endISO } = getMonthRange(month);
        return { weekStart: { gte: new Date(startISO), lte: new Date(endISO) } };
      })()
    : { weekStart: new Date(weekStart!) };

  const logs = await prisma.buildingHoursLog.findMany({
    where: { ...where, ...(buildingIds ? { buildingId: { in: buildingIds } } : {}) },
  });

  return NextResponse.json(
    toJSONSafe(
      logs.map((l) => ({
        buildingId: l.buildingId.toString(),
        weekStart: l.weekStart.toISOString().slice(0, 10),
        hoursSpent: l.hoursSpent,
        ucdHours: l.ucdHours,
      }))
    )
  );
}
