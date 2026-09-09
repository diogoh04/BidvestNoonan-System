import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { toJSONSafe, type FortnightPlanDTO } from "@/lib/types";
import { mapTimesheet, timesheetInclude } from "@/lib/timesheetDto";
import { tlOwnsBuilding } from "@/lib/teamLeaderScope";

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

// GET /api/timesheets/fortnight-plans/[id] — detalhe de um plano lançado
// (aba "Fortnightly sheets"), pra mostrar a previsão original (read-only) e
// linkar pras duas semanas reais.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  const plan = await prisma.fortnightPlan.findUnique({
    where: { id: BigInt(params.id) },
    include: planInclude,
  });
  if (!plan) return NextResponse.json({ error: "Fortnight plan not found" }, { status: 404 });

  if (hasRole(user, "team_leader")) {
    if (!(await tlOwnsBuilding(user, plan.buildingId))) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
  } else if (!hasRole(user, "master", "supervisor")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  return NextResponse.json(toJSONSafe(mapPlan(plan)));
}
