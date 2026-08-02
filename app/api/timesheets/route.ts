import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { timesheetCreateSchema } from "@/lib/validation";
import { buildInitialEntries, cloneEntriesForNewWeek } from "@/lib/timesheetSnapshot";
import { toJSONSafe, TimesheetDTO } from "@/lib/types";

function mapTimesheet(t: any): TimesheetDTO {
  return {
    id: t.id.toString(),
    buildingId: t.buildingId.toString(),
    buildingNome: t.building.nome,
    buildingWorkOrder: t.building.workOrder,
    weekStart: t.weekStart.toISOString().slice(0, 10),
    status: t.status,
    entries: t.entries,
    submittedByUserId: t.submittedByUserId ? t.submittedByUserId.toString() : null,
    submittedByNome: t.submittedByUser?.staff?.nome ?? t.submittedByUser?.username ?? null,
    submittedAt: t.submittedAt ? t.submittedAt.toISOString() : null,
    reviewedByNome: t.reviewedByUser?.staff?.nome ?? t.reviewedByUser?.username ?? null,
    reviewedAt: t.reviewedAt ? t.reviewedAt.toISOString() : null,
  };
}

// GET /api/timesheets?buildingId=&weekStart=&status=
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const buildingIdParam = searchParams.get("buildingId");
  const weekStart = searchParams.get("weekStart");
  const status = searchParams.get("status");
  const submittedByUserId = searchParams.get("submittedByUserId");

  const and: any[] = [];

  if (hasRole(user, "team_leader")) {
    if (!user.staffId) return NextResponse.json([], {});
    const myLinks = await prisma.staffBuilding.findMany({
      where: { staffId: BigInt(user.staffId), role: "team_leader" },
      select: { buildingId: true },
    });
    const myBuildingIds = myLinks.map((l) => l.buildingId);
    if (buildingIdParam) {
      const requested = BigInt(buildingIdParam);
      if (!myBuildingIds.some((id) => id === requested)) {
        return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
      }
      and.push({ buildingId: requested });
    } else {
      and.push({ buildingId: { in: myBuildingIds } });
    }
  } else if (hasRole(user, "master", "supervisor")) {
    if (buildingIdParam) and.push({ buildingId: BigInt(buildingIdParam) });
    if (submittedByUserId) and.push({ submittedByUserId: BigInt(submittedByUserId) });
  } else {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  if (weekStart) and.push({ weekStart: new Date(weekStart + "T00:00:00Z") });
  if (status === "draft" || status === "submitted" || status === "done") and.push({ status });

  const where = and.length > 0 ? { AND: and } : {};

  const timesheets = await prisma.timesheet.findMany({
    where,
    include: { building: true, submittedByUser: { include: { staff: true } }, reviewedByUser: { include: { staff: true } } },
    orderBy: [{ weekStart: "desc" }, { building: { nome: "asc" } }],
  });

  return NextResponse.json(toJSONSafe(timesheets.map(mapTimesheet)));
}

// POST /api/timesheets  { buildingId, weekStart } — pega a folha existente
// dessa semana ou cria uma nova (fotografando o estado atual do prédio).
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = timesheetCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { buildingId: buildingIdStr, weekStart: weekStartStr, copyFromWeekStart } = parsed.data;
  const buildingId = BigInt(buildingIdStr);
  const weekStart = new Date(weekStartStr + "T00:00:00Z");

  if (hasRole(user, "team_leader")) {
    if (!user.staffId) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    const owns = await prisma.staffBuilding.findFirst({
      where: { staffId: BigInt(user.staffId), buildingId, role: "team_leader" },
    });
    if (!owns) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  } else if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const existing = await prisma.timesheet.findUnique({
    where: { buildingId_weekStart: { buildingId, weekStart } },
    include: { building: true, submittedByUser: { include: { staff: true } }, reviewedByUser: { include: { staff: true } } },
  });

  if (existing) {
    return NextResponse.json(toJSONSafe(mapTimesheet(existing)));
  }

  let entries = await buildInitialEntries(buildingId);

  if (copyFromWeekStart) {
    const source = await prisma.timesheet.findUnique({
      where: {
        buildingId_weekStart: { buildingId, weekStart: new Date(copyFromWeekStart + "T00:00:00Z") },
      },
    });
    if (source) {
      entries = cloneEntriesForNewWeek(source.entries as any);
    }
  }

  const created = await prisma.timesheet.create({
    data: {
      buildingId,
      weekStart,
      entries: entries as any,
      createdByUserId: BigInt(user.userId),
    },
    include: { building: true, submittedByUser: { include: { staff: true } }, reviewedByUser: { include: { staff: true } } },
  });

  return NextResponse.json(toJSONSafe(mapTimesheet(created)), { status: 201 });
}
