import type { LeaveReason } from "./types";
import { LEAVE_REASON_LABELS } from "./types";

// Fonte única desta lógica — usada tanto pelo gráfico da página
// (components/P45ReportChart.tsx) quanto pelo export em Excel
// (lib/excelExport.ts), pra garantir que os dois sempre mostrem os mesmos
// números.

export type P45StaffItem = {
  voluntaryLeave: boolean | null;
  leaveReasons: LeaveReason[];
  lastBuildingName?: string | null;
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

// ---------- Breakdown por último prédio ----------
//
// Ao contrário dos motivos (acima), o último prédio é mutuamente exclusivo
// — cada staff contribui pra exatamente uma fatia, então isso é
// part-to-whole de verdade (soma das % bate ~100%) e cabe num donut, ao
// contrário do gráfico de motivos (barras, já que um staff pode ter mais
// de um motivo e a soma passar de 100%).
export type P45BuildingSlice = {
  label: string;
  count: number;
  pct: number;
  color: string;
};

// Paleta categórica validada (ordem fixa, 8 matizes) do skill de dataviz —
// ver referenc.../palette.md. Só os 6 primeiros slots entram em uso aqui
// (limite de fatias abaixo), que é o trecho documentado como seguro tanto
// no par adjacente (donut = anel, cada fatia só encosta em 2 vizinhas)
// quanto all-pairs pros 3 primeiros.
const BUILDING_SLICE_COLORS = [
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#008300", // green
];
const OTHER_SLICE_COLOR = "#8a8f8f"; // cinza neutro — "Other" não é uma identidade, é um resto

// Mais de 5 prédios distintos: mantém os 5 maiores e dobra o resto (+
// "Unknown", quando não há prédio salvo) num "Other" — evita estourar o
// teto de matizes distinguíveis da paleta categórica (ver color-formula.md).
const MAX_BUILDING_SLICES = 5;

export function buildP45BuildingSlices(list: { lastBuildingName?: string | null }[]): {
  total: number;
  slices: P45BuildingSlice[];
} {
  const total = list.length;
  const counts = new Map<string, number>();
  for (const s of list) {
    const key = s.lastBuildingName?.trim() || "Unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const head = ranked.slice(0, MAX_BUILDING_SLICES);
  const tailCount = ranked.slice(MAX_BUILDING_SLICES).reduce((sum, [, c]) => sum + c, 0);

  const slices: P45BuildingSlice[] = head.map(([label, count], i) => ({
    label,
    count,
    pct: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    color: BUILDING_SLICE_COLORS[i],
  }));

  if (tailCount > 0) {
    slices.push({
      label: "Other",
      count: tailCount,
      pct: total > 0 ? Math.round((tailCount / total) * 1000) / 10 : 0,
      color: OTHER_SLICE_COLOR,
    });
  }

  return { total, slices };
}
