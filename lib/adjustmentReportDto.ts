import type {
  AdjustmentReportDTO,
  AdjustmentItemDTO,
  AdjustmentAction,
  AbsenceCode,
  AdjustmentReportBuildingGroup,
} from "./types";
import { userNameInclude, userDisplayName, userTeamNumber } from "./userName";

export const adjustmentReportInclude = {
  submittedByUser: { include: userNameInclude },
  reviewedByUser: { include: { staff: true } },
  items: {
    orderBy: { ordem: "asc" },
    include: { building: true },
  },
} as const;

function mapItem(it: any): AdjustmentItemDTO {
  return {
    id: it.id.toString(),
    action: it.action as AdjustmentAction,
    buildingId: it.buildingId.toString(),
    staffId: it.staffId ? it.staffId.toString() : null,
    staffNome: it.staffNome ?? null,
    staffNumber: it.staffNumber ?? null,
    dateFrom: it.dateFrom.toISOString().slice(0, 10),
    dateTo: it.dateTo.toISOString().slice(0, 10),
    timeFrom: it.timeFrom ?? null,
    timeTo: it.timeTo ?? null,
    reasonCode: (it.reasonCode as AbsenceCode | null) ?? null,
    isCover: !!it.isCover,
    note: it.note ?? null,
  };
}

export function mapAdjustmentReport(r: any): AdjustmentReportDTO {
  const groups = new Map<string, AdjustmentReportBuildingGroup>();
  for (const it of r.items ?? []) {
    const bid = it.buildingId.toString();
    if (!groups.has(bid)) {
      groups.set(bid, {
        buildingId: bid,
        buildingNome: it.building.nome,
        buildingWorkOrder: it.building.workOrder ?? null,
        items: [],
      });
    }
    groups.get(bid)!.items.push(mapItem(it));
  }

  return {
    id: r.id.toString(),
    weekStart: r.weekStart.toISOString().slice(0, 10),
    status: r.status,
    submittedByNome: userDisplayName(r.submittedByUser),
    submittedByTeamNumber: userTeamNumber(r.submittedByUser),
    submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
    reviewedByNome: r.reviewedByUser?.staff?.nome ?? r.reviewedByUser?.username ?? null,
    reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
    itemCount: (r.items ?? []).length,
    groups: [...groups.values()].sort((a, b) => a.buildingNome.localeCompare(b.buildingNome)),
  };
}
