import { weekdayShort, workingDaysInRange } from "./week";

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
  // Conta "team_leader": o time que ela lidera.
  teamId: string | null;
  teamLabel: string | null; // "Team 5 — João, Maria"
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

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Lista ordenada de chaves do quadro de dias, conforme o período da folha —
// caminho LEGADO: 5 ou 10 chaves simbólicas fixas ("MONDAY".."W2_FRIDAY").
// Ainda usado pelas folhas antigas (sem weekEnd) e pelos moldes em branco de
// impressão (TimesheetView/LeaderTimesheetView, que não têm data real). Pra
// folhas com data real e duração livre, ver getTimesheetDates abaixo.
export function getTimesheetDayKeys(periodType: TimesheetPeriodType): readonly string[] {
  return periodType === "biweekly" ? TIMESHEET_DAYS_BIWEEKLY : TIMESHEET_DAYS;
}

// Lista ordenada das chaves REAIS de dia de uma folha: quando `weekEnd`
// existe (folhas novas, ver /my/timesheets/lancar), a folha tem duração
// livre e cada chave já é a própria data ISO do dia útil ("2026-09-16") em
// vez de um símbolo fixo — permite qualquer início/fim, não só 5 ou 10 dias.
// Sem `weekEnd` (folhas antigas), cai no comportamento de sempre.
export function getTimesheetDates(weekStart: string, weekEnd: string | null, periodType: TimesheetPeriodType): readonly string[] {
  if (weekEnd) return workingDaysInRange(weekStart, weekEnd);
  return getTimesheetDayKeys(periodType);
}

// Rótulo exibido no cabeçalho da coluna — dia da semana (MON/TUE/...) tanto
// pra uma data ISO real (folha de duração livre) quanto pra uma chave
// simbólica legada ("MONDAY"/"W1_MONDAY"...).
export function timesheetDayLabel(dayKey: string): string {
  if (ISO_DATE_RE.test(dayKey)) return weekdayShort(dayKey);
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
  // Building/WO próprios desta linha (ver StaffBuilding.predioLabel/workOrder
  // e o botão "Sheet labels" em BuildingStaffClient) — só em linhas "staff",
  // fotografado na criação da folha (lib/timesheetSnapshot.ts) e
  // resincronizado quando editado depois (ver /api/buildings/[id]/staff/sheet).
  // Vazio/null = usa buildingNome/buildingWorkOrder do timesheet.
  predioLabel?: string | null;
  workOrder?: string | null;
};

export type TimesheetEntries = { rows: TimesheetRow[] };

export type TimesheetDTO = {
  id: string;
  buildingId: string;
  buildingNome: string;
  buildingWorkOrder: string | null;
  weekStart: string;
  // Fim real do período — só presente nas folhas novas (duração livre, ver
  // getTimesheetDates). Nulo nas folhas antigas (duração fixa por periodType).
  weekEnd: string | null;
  periodType: TimesheetPeriodType;
  status: TimesheetStatus;
  entries: TimesheetEntries;
  submittedByUserId: string | null;
  // Nome exibido de quem enviou (líder(es) do time, ou fallback) e o número
  // do time da conta — é o que o supervisor vê, não o login técnico.
  submittedByNome: string | null;
  submittedByTeamNumber: number | null;
  submittedAt: string | null;
  reviewedByNome: string | null;
  reviewedAt: string | null;
  deletedAt: string | null;
  deletedByNome: string | null;
  // Preenchido quando esta linha nasceu de um Launch de quinzenal (é week1
  // ou week2 de um FortnightPlan) — legado (o Launch foi removido), usado só
  // pra mostrar o badge "From fortnight" nas folhas semanais antigas.
  fortnightPlanId: string | null;
  // "A folha como foi salva a primeira vez" (Timesheet.submittedSnapshot) —
  // o que o supervisor revê. null enquanto ainda é draft.
  submittedEntries: TimesheetEntries | null;
};

// Histórico de uma quinzenal lançada — congelado no momento do Launch, nunca
// mais editado. Ver POST /api/timesheets/fortnight/launch e a aba
// "Fortnightly sheets" em /my/timesheets.
export type FortnightPlanDTO = {
  id: string;
  buildingId: string;
  buildingNome: string;
  fortnightStart: string;
  forecastEntries: TimesheetEntries;
  week1: TimesheetDTO;
  week2: TimesheetDTO;
  launchedByNome: string | null;
  launchedAt: string;
};

// ---------- Relatório de ajuste semanal (ver model AdjustmentReport) ----------

export type AdjustmentReportStatus = "draft" | "submitted" | "done";

// Códigos de motivo — os mesmos da legenda da folha de ponto.
export const ABSENCE_CODES = ["S", "BH", "AA", "AU", "P45", "HU", "HP"] as const;
export type AbsenceCode = (typeof ABSENCE_CODES)[number];
export const ABSENCE_CODE_LABELS: Record<AbsenceCode, string> = {
  S: "Sick",
  BH: "Bank Holiday",
  AA: "Absent Authorized",
  AU: "Absent Unauthorized",
  P45: "Leaving",
  HU: "Holiday Unpaid",
  HP: "Holiday Paid",
};

export const ADJUSTMENT_ACTIONS = [
  "add_hours",
  "remove_hours",
  "remove_from_building",
  "add_to_building",
] as const;
export type AdjustmentAction = (typeof ADJUSTMENT_ACTIONS)[number];
export const ADJUSTMENT_ACTION_LABELS: Record<AdjustmentAction, string> = {
  add_hours: "ADD",
  remove_hours: "REMOVE",
  remove_from_building: "REMOVE FROM BUILDING",
  add_to_building: "ADD TO BUILDING",
};
// Ações cujo staff sai da previsão do prédio (dropdown) vs. busca livre.
export const ADJUSTMENT_ACTIONS_FROM_FORECAST: AdjustmentAction[] = ["remove_hours", "remove_from_building"];
// Ações que usam código de motivo.
export const ADJUSTMENT_ACTIONS_WITH_REASON: AdjustmentAction[] = ["remove_hours", "remove_from_building"];
// Ações que usam faixa de horário (dia); as de vínculo usam só a data efetiva.
export const ADJUSTMENT_ACTIONS_WITH_TIME: AdjustmentAction[] = ["add_hours", "remove_hours"];

export type AdjustmentItemDTO = {
  id: string;
  action: AdjustmentAction;
  buildingId: string;
  staffId: string | null;
  staffNome: string | null;
  staffNumber: string | null;
  dateFrom: string;
  dateTo: string;
  timeFrom: string | null;
  timeTo: string | null;
  reasonCode: AbsenceCode | null;
  isCover: boolean;
  note: string | null;
};

export type AdjustmentReportBuildingGroup = {
  buildingId: string;
  buildingNome: string;
  buildingWorkOrder: string | null;
  items: AdjustmentItemDTO[];
};

export type AdjustmentReportDTO = {
  id: string;
  weekStart: string;
  status: AdjustmentReportStatus;
  submittedByNome: string | null;
  submittedByTeamNumber: number | null;
  submittedAt: string | null;
  reviewedByNome: string | null;
  reviewedAt: string | null;
  itemCount: number;
  groups: AdjustmentReportBuildingGroup[];
};

export type StaffDTO = {
  id: string;
  nome: string | null;
  telefone: string | null;
  staffNumber: string | null;
  // `sbId` = id do vínculo StaffBuilding (o mesmo staff pode ter mais de um
  // vínculo "cleaner" no mesmo prédio — ver schema.prisma).
  buildings: { id: string; sbId: string; nome: string; role: Role; horas: number | null }[];
  // Times que este staff lidera hoje (ver Team.leaderId) — desconectado do
  // conceito de prédio: o vínculo é com o Team, que já carrega os prédios
  // dele (ver /teams). Também alimenta o formulário de edição do staff.
  teamsLed: { teamId: string; number: number | null; horas: number | null }[];
  status: StaffStatus | null;
  blockedAt: string | null;
  // Detalhes da saída — só preenchidos quando status === "p45" (ver
  // Staff.lastWorkingDay/voluntaryLeave/leaveReasons/leaveReasonNote no schema).
  lastWorkingDay: string | null;
  voluntaryLeave: boolean | null;
  // Pode ter mais de um motivo (ex.: Absences + Transport juntos).
  leaveReasons: LeaveReason[];
  leaveReasonNote: string | null;
  // Último prédio (StaffBuilding) antes da saída — capturado quando o
  // status vira "p45", já que os vínculos de prédio são apagados nesse
  // momento. Só faz sentido quando status === "p45".
  lastBuildingName: string | null;
  // Só faz sentido quando status === "le" — pra qual empresa o staff está
  // indo (sempre opcional, quem preenche pode não saber ainda).
  leDestinationCompany: string | null;
  createdAt: string | null;
};

// Relatório de motivos de saída do P45 — calculado no client a partir da
// lista já buscada (ver components/P45ReportChart.tsx), sem endpoint
// próprio. Cada fatia é "% do total de P45 que inclui essa categoria" —
// como um staff pode ter mais de um motivo, as fatias podem se sobrepor e a
// soma pode passar de 100% (não é mais parte-do-todo). "voluntary" cobre
// quem saiu por conta própria; "unknown" cobre registros antigos sem
// voluntaryLeave preenchido.
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
  // Balanço "fixo" (valor ao vivo, não por semana como em /hours-control):
  // UCD Hours (o que a faculdade libera) vs Building Hours (o que a gente
  // de fato repassa pro team leader, Building.horasDisponiveis). hoursDelta
  // positivo = ainda sobra UCD pra repassar; negativo = já repassamos mais
  // do que a UCD liberou.
  buildingsUcdBalance: {
    buildingId: string;
    nome: string;
    ucdHours: number;
    horasDisponiveis: number;
    hoursDelta: number;
  }[];
  grandTotalUcd: {
    ucdHours: number;
    horasDisponiveis: number;
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
