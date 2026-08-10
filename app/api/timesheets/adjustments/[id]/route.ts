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

// GET /api/timesheets/adjustments/[id] — detalhe de um ajuste (antes/depois
// + diff célula a célula), pra tela de detalhe da aba Adjustments.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  const adjustment = await prisma.adjustment.findUnique({
    where: { id: BigInt(params.id) },
    include: adjustmentInclude,
  });
  if (!adjustment) return NextResponse.json({ error: "Adjustment not found" }, { status: 404 });

  if (hasRole(user, "team_leader")) {
    if (!user.staffId) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    const owns = await prisma.staffBuilding.findFirst({
      where: { staffId: BigInt(user.staffId), buildingId: adjustment.timesheet.buildingId, role: "team_leader" },
    });
    if (!owns) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  } else if (!hasRole(user, "master", "supervisor")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  return NextResponse.json(toJSONSafe(mapAdjustment(adjustment)));
}
