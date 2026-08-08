export type Role = "cleaner" | "team_leader";

export type StaffStatus = "p45" | "le" | "blocked" | "sick";

// Motivo de saída — só se aplica quando status === "p45" e a saída não foi
// voluntária (ver Staff.voluntaryLeave). "other" exige leaveReasonNote.
export type LeaveReason = "absences" | "transport" | "productivity" | "visa_blocked" | "other";

export const LEAVE_REASON_LABELS: Record<LeaveReason, string> = {
  absences: "Absences",
  transport: "Transport",
  productivity: "Productivity",
  visa_blocked: "Visa expired or blocked",
  other: "Other",
};

// Papel de ACESSO ao app (conta de login) — não confundir com `Role` acima,
// que é o papel de trabalho do staff no prédio (cleaner/team_leader).
// "pending" = conta autocadastrada em /register, aguardando o Master
// escolher o papel real em /users.
export type AppRole = "master" | "supervisor" | "team_leader" | "pending";

export type UserDTO = {
  id: string;
  username: string;
  role: AppRole;
  active: boolean;
  staffId: string | null;
  staffNome: string | null;
  createdAt: string | null;
};

export const TIMESHEET_DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] as const;
export type TimesheetDayKey = (typeof TIMESHEET_DAYS)[number];

// Folha quinzenal: os mesmos 5 dias, duas vezes (W1_/W2_) — o quadro de
// sign in/out ganha uma segunda semana de colunas em vez de virar uma
// folha separada (ver Timesheet.periodType no schema). O rótulo exibido
// fica abreviado (MON/TUE/...) pra caber as 10 colunas.
export const TIMESHEET_DAYS_BIWEEKLY = [
  "W1_MONDAY", "W1_TUESDAY", "W1_WEDNESDAY", "W1_THURSDAY", "W1_FRIDAY",
  "W2_MONDAY", "W2_TUESDAY", "W2_WEDNESDAY", "W2_THURSDAY", "W2_FRIDAY",
] as const;
export type TimesheetBiweeklyDayKey = (typeof TIMESHEET_DAYS_BIWEEKLY)[number];

export type TimesheetPeriodType = "weekly" | "biweekly";

const SHORT_DAY_LABEL: Record<string, string> = {
  MONDAY: "MON",
  TUESDAY: "TUE",
  WEDNESDAY: "WED",
  THURSDAY: "THU",
  FRIDAY: "FRI",
};

// Lista ordenada de chaves do quadro de dias, conforme o período da folha.
export function getTimesheetDayKeys(periodType: TimesheetPeriodType): readonly string[] {
  return periodType === "biweekly" ? TIMESHEET_DAYS_BIWEEKLY : TIMESHEET_DAYS;
}

// Rótulo exibido no cabeçalho da coluna — nome completo do dia na semanal
// ("MONDAY"), abreviado na quinzenal ("MON", repetido nas duas semanas).
export function timesheetDayLabel(dayKey: string): string {
  const base = dayKey.startsWith("W1_") || dayKey.startsWith("W2_") ? dayKey.slice(3) : dayKey;
  return base === dayKey ? base : SHORT_DAY_LABEL[base] ?? base;
}

export type TimesheetStatus = "draft" | "submitted" | "done";

export type TimesheetDayValue = { in: string | null; out: string | null };

export type TimesheetRow = {
  kind: "staff" | "openSlot" | "cover";
  refId: string | null;
  nome: string | null;
  staffNumber: string | null;
  horas: number | null;
  // Solto de propósito (não fixo nas chaves de TIMESHEET_DAYS) — o
  // conjunto real de chaves depende do periodType da folha, ver
  // getTimesheetDayKeys.
  days: Record<string, TimesheetDayValue>;
};

export type TimesheetEntries = { rows: TimesheetRow[] };

export type TimesheetDTO = {
  id: string;
  buildingId: string;
  buildingNome: string;
  buildingWorkOrder: string | null;
  weekStart: string;
  periodType: TimesheetPeriodType;
  status: TimesheetStatus;
  entries: TimesheetEntries;
  submittedByUserId: string | null;
  // Nome real (Staff.nome) de quem enviou, com fallback pro username —
  // é o que aparece pro supervisor, não o login técnico.
  submittedByNome: string | null;
  submittedAt: string | null;
  reviewedByNome: string | null;
  reviewedAt: string | null;
  deletedAt: string | null;
  deletedByNome: string | null;
};

export type StaffDTO = {
  id: string;
  nome: string | null;
  telefone: string | null;
  staffNumber: string | null;
  buildings: { id: string; nome: string; role: Role; horas: number | null }[];
  status: StaffStatus | null;
  blockedAt: string | null;
  // Detalhes da saída — só preenchidos quando status === "p45" (ver
  // Staff.lastWorkingDay/voluntaryLeave/leaveReason/leaveReasonNote no schema).
  lastWorkingDay: string | null;
  voluntaryLeave: boolean | null;
  leaveReason: LeaveReason | null;
  leaveReasonNote: string | null;
  createdAt: string | null;
};

// Relatório em % de motivos de saída do P45 — calculado no client a partir
// da lista já buscada (ver components/P45ReportChart.tsx), sem endpoint
// próprio. "voluntary" é uma fatia igual às demais (todas em % do total de
// P45); "unknown" cobre registros antigos sem voluntaryLeave preenchido.
export type P45ReportSlice = {
  key: LeaveReason | "voluntary" | "unknown";
  label: string;
  count: number;
  pct: number;
};

export type P45ReportDTO = {
  total: number;
  slices: P45ReportSlice[];
};

export type BuildingDTO = {
  id: string;
  nome: string;
};

export type FeedbackDTO = {
  id: string;
  texto: string | null;
  data: string | null;
};

export type DashboardDTO = {
  counts: {
    totalStaff: number;
    totalCleaners: number;
    totalTeamLeaders: number;
  };
  buildingsOpenSlots: {
    buildingId: string;
    nome: string;
    openSlotsCount: number;
    breakdown: { horas: number; count: number }[];
  }[];
  openSlotsByHours: {
    horas: number;
    count: number;
    buildings: { buildingId: string; nome: string; count: number }[];
  }[];
  totalOpenSlots: number;
  buildingsHoursBalance: {
    buildingId: string;
    nome: string;
    horasDisponiveis: number;
    horasGastas: number;
    hoursDelta: number;
  }[];
  grandTotal: {
    horasDisponiveis: number;
    horasGastas: number;
    hoursDelta: number;
    buildingsCounted: number;
  };
};

// BigInt não serializa em JSON.stringify por padrão — convertendo recursivamente para string.
export function toJSONSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => (typeof v === "bigint" ? v.toString() : v))
  );
}
