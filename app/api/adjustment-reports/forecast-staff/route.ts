import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { isWithinRange, fortnightEndISO } from "@/lib/week";
import { tlOwnsBuilding } from "@/lib/teamLeaderScope";
import { toJSONSafe, type TimesheetEntries } from "@/lib/types";

// GET /api/adjustment-reports/forecast-staff?buildingId=&weekStart=
// Nomes que estão na PREVISÃO (folha quinzenal) daquele prédio na quinzena
// que contém essa semana — alimenta o dropdown do REMOVE.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const buildingId = searchParams.get("buildingId");
  const weekStart = searchParams.get("weekStart");
  if (!buildingId || !weekStart) {
    return NextResponse.json({ error: "buildingId and weekStart are required" }, { status: 400 });
  }

  if (hasRole(user, "team_leader")) {
    if (!(await tlOwnsBuilding(user, BigInt(buildingId)))) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
  } else if (!hasRole(user, "master", "supervisor")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const sheets = await prisma.timesheet.findMany({
    where: { buildingId: BigInt(buildingId), periodType: "biweekly", deletedAt: null },
    orderBy: { weekStart: "desc" },
    select: { weekStart: true, weekEnd: true, entries: true, submittedSnapshot: true },
  });

  const match = sheets.find((s) => {
    const start = s.weekStart.toISOString().slice(0, 10);
    const end = s.weekEnd ? s.weekEnd.toISOString().slice(0, 10) : fortnightEndISO(start);
    return isWithinRange(start, end, weekStart);
  });
  if (!match) return NextResponse.json([]);

  const entries = (match.submittedSnapshot ?? match.entries) as unknown as TimesheetEntries;
  const people = (entries.rows ?? [])
    .filter((r) => r.kind === "staff" && r.nome)
    .map((r) => ({ nome: r.nome as string, staffNumber: r.staffNumber ?? null, staffId: r.refId ?? null }));

  return NextResponse.json(toJSONSafe(people));
}
