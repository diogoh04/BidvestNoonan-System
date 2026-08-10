import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { toJSONSafe, type AdjustmentDTO } from "@/lib/types";

const adjustmentInclude = {
  timesheet: { include: { building: true } },
  updatedByUser: { include: { staff: true } },
} as const;

function mapAdjustment(a: any): AdjustmentDTO {
  return {
    id: a.id.toString(),
    timesheetId: a.timesheetId.toString(),
    buildingNome: a.timesheet.building.nome,
    weekStart: a.timesheet.weekStart.toISOString().slice(0, 10),
    periodType: a.timesheet.periodType,
    beforeEntries: a.beforeEntries,
    afterEntries: a.afterEntries,
    diff: a.diff,
    updatedByNome: a.updatedByUser?.staff?.nome ?? a.updatedByUser?.username ?? null,
    updatedAt: a.updatedAt.toISOString(),
  };
}

// GET /api/timesheets/adjustments — folhas semanais editadas depois do
// primeiro envio (aba "Adjustments" em /my/timesheets). Um registro por
// folha, sempre refletindo a diferença atual em relação ao que foi enviado
// (ver PATCH /api/timesheets/[id], que apaga o registro se a edição reverter
// pro valor original).
export async function GET(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  const where: any = {};

  if (hasRole(user, "team_leader")) {
    if (!user.staffId) return NextResponse.json([], {});
    const myLinks = await prisma.staffBuilding.findMany({
      where: { staffId: BigInt(user.staffId), role: "team_leader" },
      select: { buildingId: true },
    });
    where.timesheet = { buildingId: { in: myLinks.map((l) => l.buildingId) } };
  } else if (!hasRole(user, "master", "supervisor")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const adjustments = await prisma.adjustment.findMany({
    where,
    include: adjustmentInclude,
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(toJSONSafe(adjustments.map(mapAdjustment)));
}
