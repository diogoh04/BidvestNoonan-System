import type { TimesheetDTO } from "./types";

// Compartilhado entre as rotas de /api/timesheets (lista, detalhe, launch,
// fortnight-plans, adjustments) — antes duplicado em cada route.ts.
export const timesheetInclude = {
  building: true,
  submittedByUser: { include: { staff: true } },
  reviewedByUser: { include: { staff: true } },
  deletedByUser: { include: { staff: true } },
  fortnightAsWeek1: { select: { id: true } },
  fortnightAsWeek2: { select: { id: true } },
  adjustment: { select: { id: true } },
} as const;

export function mapTimesheet(t: any): TimesheetDTO {
  return {
    id: t.id.toString(),
    buildingId: t.buildingId.toString(),
    buildingNome: t.building.nome,
    buildingWorkOrder: t.building.workOrder,
    weekStart: t.weekStart.toISOString().slice(0, 10),
    periodType: t.periodType,
    status: t.status,
    entries: t.entries,
    submittedByUserId: t.submittedByUserId ? t.submittedByUserId.toString() : null,
    submittedByNome: t.submittedByUser?.staff?.nome ?? t.submittedByUser?.username ?? null,
    submittedAt: t.submittedAt ? t.submittedAt.toISOString() : null,
    reviewedByNome: t.reviewedByUser?.staff?.nome ?? t.reviewedByUser?.username ?? null,
    reviewedAt: t.reviewedAt ? t.reviewedAt.toISOString() : null,
    deletedAt: t.deletedAt ? t.deletedAt.toISOString() : null,
    deletedByNome: t.deletedByUser?.staff?.nome ?? t.deletedByUser?.username ?? null,
    fortnightPlanId: t.fortnightAsWeek1?.id.toString() ?? t.fortnightAsWeek2?.id.toString() ?? null,
    hasAdjustment: !!t.adjustment,
  };
}
