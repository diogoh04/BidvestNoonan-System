import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { toJSONSafe, type FortnightPlanDTO } from "@/lib/types";
import { mapTimesheet, timesheetInclude } from "@/lib/timesheetDto";

const planInclude = {
  building: true,
  launchedByUser: { include: { staff: true } },
  week1Timesheet: { include: timesheetInclude },
  week2Timesheet: { include: timesheetInclude },
} as const;

function mapPlan(p: any): FortnightPlanDTO {
  return {
    id: p.id.toString(),
    buildingId: p.buildingId.toString(),
    buildingNome: p.building.nome,
    fortnightStart: p.fortnightStart.toISOString().slice(0, 10),
    forecastEntries: p.forecastEntries,
    week1: mapTimesheet(p.week1Timesheet),
    week2: mapTimesheet(p.week2Timesheet),
    launchedByNome: p.launchedByUser?.staff?.nome ?? p.launchedByUser?.username ?? null,
    launchedAt: p.launchedAt.toISOString(),
  };
}

// GET /api/timesheets/fortnight-plans?fortnightStart= — histórico das
// quinzenais lançadas (aba "Fortnightly sheets" em /my/timesheets), e
// também usado pelo LancarClient pra "Copy from previous fortnight" (já que,
// depois do Launch, não sobra nenhuma linha biweekly viva pra copiar).
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const fortnightStart = searchParams.get("fortnightStart");

  const and: any[] = [];

  if (hasRole(user, "team_leader")) {
    if (!user.staffId) return NextResponse.json([], {});
    const myLinks = await prisma.staffBuilding.findMany({
      where: { staffId: BigInt(user.staffId), role: "team_leader" },
      select: { buildingId: true },
    });
    and.push({ buildingId: { in: myLinks.map((l) => l.buildingId) } });
  } else if (!hasRole(user, "master", "supervisor")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  if (fortnightStart) and.push({ fortnightStart: new Date(fortnightStart + "T00:00:00Z") });

  const plans = await prisma.fortnightPlan.findMany({
    where: and.length > 0 ? { AND: and } : {},
    include: planInclude,
    orderBy: { fortnightStart: "desc" },
  });

  return NextResponse.json(toJSONSafe(plans.map(mapPlan)));
}
