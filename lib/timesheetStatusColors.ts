// Cores de destaque pros códigos de ausência/feriado digitados nas células
// IN/OUT (ver legenda no topo da folha: HP/AA/S/HU/AU/BH/P45 — "Sign In &
// Sign Out Book"). Mesma cor em tela, impressão/PDF e export Excel (ver
// lib/timesheetExcelExport.ts), pra quem bate o olho identificar o motivo
// sem reler a legenda toda vez.
export const STATUS_DAY_CODES = ["HP", "AA", "S", "HU", "AU", "BH", "P45"] as const;
export type StatusDayCode = (typeof STATUS_DAY_CODES)[number];

// Classes Tailwind (fundo pastel, texto preto continua legível) — usadas nas
// três telas que renderizam a folha (CombinedTimesheetEditor,
// LeaderTimesheetView, TimesheetView).
export const STATUS_DAY_BG_CLASS: Record<StatusDayCode, string> = {
  HP: "bg-amber-200",
  AA: "bg-sky-200",
  S: "bg-rose-200",
  HU: "bg-violet-200",
  AU: "bg-orange-300",
  BH: "bg-emerald-200",
  P45: "bg-slate-300",
};

// Mesmas cores em hex (sem "#"), pro fill ARGB do Excel — exceljs não lê
// classe Tailwind, só RGB/ARGB direto.
export const STATUS_DAY_HEX: Record<StatusDayCode, string> = {
  HP: "FDE68A",
  AA: "BAE6FD",
  S: "FECDD3",
  HU: "DDD6FE",
  AU: "FDBA74",
  BH: "A7F3D0",
  P45: "CBD5E1",
};

// Rótulo completo por código — usado no Excel quando uma semana inteira tem
// o mesmo código (ver lib/timesheetExcelExport.ts): mescla os dias e mostra
// "HP - Holiday Paid" em vez de "HP" repetido em cada coluna.
export const STATUS_DAY_LABEL: Record<StatusDayCode, string> = {
  HP: "Holiday Paid",
  AA: "Absent Authorized",
  S: "Sick",
  HU: "Holiday Unpaid",
  AU: "Absent Unauthorized",
  BH: "Bank Holiday",
  P45: "Leaving",
};

// Atalhos de um clique no seletor manual de cor (ver SignCell) — além deles,
// o botão também abre o seletor nativo do navegador, que aceita qualquer cor.
export const HIGHLIGHT_SWATCHES = Object.values(STATUS_DAY_HEX).map((hex) => `#${hex}`);

function matchCode(value: string | null | undefined): StatusDayCode | null {
  if (!value) return null;
  const v = value.trim().toUpperCase();
  return (STATUS_DAY_CODES as readonly string[]).includes(v) ? (v as StatusDayCode) : null;
}

// IN e OUT normalmente vêm iguais quando é um código (ex.: "HP"/"HP") — olha
// os dois e usa o primeiro que bater, pro caso raro de só um lado ter sido
// preenchido ainda.
export function dayCellStatusCode(day: { in: string | null; out: string | null } | undefined | null): StatusDayCode | null {
  if (!day) return null;
  return matchCode(day.in) ?? matchCode(day.out);
}
