export type Role = "cleaner" | "team_leader";

export type StaffStatus = "p45" | "le" | "blocked" | "sick";

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

export type TimesheetStatus = "draft" | "submitted" | "done";

export type TimesheetDayValue = { in: string | null; out: string | null };

export type TimesheetRow = {
  kind: "staff" | "openSlot" | "cover";
  refId: string | null;
  nome: string | null;
  staffNumber: string | null;
  horas: number | null;
  days: Record<TimesheetDayKey, TimesheetDayValue>;
};

export type TimesheetEntries = { rows: TimesheetRow[] };

export type TimesheetDTO = {
  id: string;
  buildingId: string;
  buildingNome: string;
  buildingWorkOrder: string | null;
  weekStart: string;
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
  createdAt: string | null;
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
  buildingsOpenSlots: { buildingId: string; nome: string; openSlotsCount: number }[];
  openSlotsByHours: { horas: number; count: number }[];
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
