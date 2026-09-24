import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toJSONSafe } from "@/lib/types";
import { getCurrentUser, hasRole, type SessionUser } from "@/lib/auth";
import { tlOwnsBuilding } from "@/lib/teamLeaderScope";

// Personalizações de Building/WO feitas direto na folha impressa (ver
// TimesheetView, LeaderTimesheetView e CombinedTimesheetEditor) — nunca
// escreve em predios/team/timesheet, só nesta tabela separada.
//
// Master pode mexer em qualquer subjectType (building/team/timesheet — ver
// telas /timesheets). Team Leader só em subjectType "timesheet" (a folha
// dele em /my/timesheets/lancar — nome do prédio no topo + nome do Team
// Leader digitado à mão), e só nas folhas de prédios do próprio time.
async function authorizeTimesheetSubjects(
  user: SessionUser | null,
  subjectType: string,
  subjectIds: bigint[]
): Promise<boolean> {
  if (hasRole(user, "master")) return true;
  if (!hasRole(user, "team_leader") || subjectType !== "timesheet" || subjectIds.length === 0) return false;

  const timesheets = await prisma.timesheet.findMany({
    where: { id: { in: subjectIds } },
    select: { id: true, buildingId: true },
  });
  if (timesheets.length !== subjectIds.length) return false;

  for (const t of timesheets) {
    if (!(await tlOwnsBuilding(user!, t.buildingId))) return false;
  }
  return true;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();

  const { searchParams } = new URL(req.url);
  const subjectType = searchParams.get("subjectType");
  const subjectIdsParam = searchParams.get("subjectIds");
  if (!subjectType || !subjectIdsParam) {
    return NextResponse.json({ error: "subjectType and subjectIds are required" }, { status: 400 });
  }

  let subjectIds: bigint[];
  try {
    subjectIds = subjectIdsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => BigInt(s));
  } catch {
    return NextResponse.json({ error: "Invalid subjectIds" }, { status: 400 });
  }
  if (subjectIds.length === 0) return NextResponse.json([]);

  if (!(await authorizeTimesheetSubjects(user, subjectType, subjectIds))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const rows = await prisma.timesheetSheetOverride.findMany({
    where: { subjectType, subjectId: { in: subjectIds } },
  });

  return NextResponse.json(
    toJSONSafe(
      rows.map((r) => ({
        subjectType: r.subjectType,
        subjectId: r.subjectId.toString(),
        scope: r.scope,
        nomePredio: r.nomePredio,
        workOrder: r.workOrder,
        teamLeaderNome: r.teamLeaderNome,
      }))
    )
  );
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();

  const body = await req.json();
  const subjectType = typeof body.subjectType === "string" ? body.subjectType : null;
  const scope = typeof body.scope === "string" ? body.scope : null;
  if (!subjectType || !scope || body.subjectId == null) {
    return NextResponse.json({ error: "subjectType, subjectId and scope are required" }, { status: 400 });
  }

  let subjectId: bigint;
  try {
    subjectId = BigInt(body.subjectId);
  } catch {
    return NextResponse.json({ error: "Invalid subjectId" }, { status: 400 });
  }

  if (!(await authorizeTimesheetSubjects(user, subjectType, [subjectId]))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const nomePredio = typeof body.nomePredio === "string" ? body.nomePredio : null;
  const workOrder = typeof body.workOrder === "string" ? body.workOrder : null;
  // Team Leader só edita isto via CombinedTimesheetEditor (scope "header");
  // undefined (não veio no body) preserva o que já estava salvo em vez de
  // apagar — só uma string explícita (mesmo vazia) sobrescreve.
  const teamLeaderNome: string | null | undefined =
    body.teamLeaderNome === undefined ? undefined : typeof body.teamLeaderNome === "string" ? body.teamLeaderNome : null;

  const saved = await prisma.timesheetSheetOverride.upsert({
    where: { subjectType_subjectId_scope: { subjectType, subjectId, scope } },
    update: { nomePredio, workOrder, ...(teamLeaderNome !== undefined ? { teamLeaderNome } : {}) },
    create: { subjectType, subjectId, scope, nomePredio, workOrder, teamLeaderNome: teamLeaderNome ?? null },
  });

  return NextResponse.json(
    toJSONSafe({
      subjectType: saved.subjectType,
      subjectId: saved.subjectId.toString(),
      scope: saved.scope,
      nomePredio: saved.nomePredio,
      workOrder: saved.workOrder,
      teamLeaderNome: saved.teamLeaderNome,
    })
  );
}
