import type { LeaveReason } from "./types";
import { LEAVE_REASON_LABELS } from "./types";

// Fonte única desta lógica — usada tanto pelo gráfico da página
// (components/P45ReportChart.tsx) quanto pelo export em Excel
// (lib/excelExport.ts), pra garantir que os dois sempre mostrem os mesmos
// números.

export type P45StaffItem = {
  voluntaryLeave: boolean | null;
  leaveReasons: LeaveReason[];
};

export type P45SliceKey = LeaveReason | "voluntary" | "unknown";

export type P45Slice = {
  key: P45SliceKey;
  label: string;
  count: number;
  pct: number;
};

export const P45_SLICE_ORDER: P45SliceKey[] = [
  "voluntary",
  "absences",
  "transport",
  "productivity",
  "visa_blocked",
  "other",
  "unknown",
];

// "unknown" cobre P45 antigos, salvos antes desses campos existirem, sem
// voluntaryLeave preenchido.
export const P45_SLICE_LABELS: Record<P45SliceKey, string> = {
  voluntary: "Left by own choice",
  ...LEAVE_REASON_LABELS,
  unknown: "Unknown",
};

// Motivos não são mutuamente exclusivos (um staff pode ter mais de um
// leaveReason) — cada categoria vira uma fatia independente com "% do total
// de P45 que inclui essa categoria"; a soma pode passar de 100%, é esperado.
export function buildP45ReportSlices(list: P45StaffItem[]): { total: number; slices: P45Slice[] } {
  const total = list.length;
  const counts: Record<P45SliceKey, number> = {
    voluntary: 0,
    absences: 0,
    transport: 0,
    productivity: 0,
    visa_blocked: 0,
    other: 0,
    unknown: 0,
  };

  for (const s of list) {
    if (s.voluntaryLeave === true) counts.voluntary += 1;
    else if (s.voluntaryLeave === false && s.leaveReasons.length > 0) {
      for (const r of s.leaveReasons) counts[r] += 1;
    } else counts.unknown += 1;
  }

  const slices = P45_SLICE_ORDER.map((key) => ({
    key,
    label: P45_SLICE_LABELS[key],
    count: counts[key],
    pct: total > 0 ? Math.round((counts[key] / total) * 1000) / 10 : 0,
  }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);

  return { total, slices };
}
