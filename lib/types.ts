export type Role = "cleaner" | "team_leader";

export type StaffStatus = "p45" | "le" | "blocked" | "sick";

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

// BigInt não serializa em JSON.stringify por padrão — convertendo recursivamente para string.
export function toJSONSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => (typeof v === "bigint" ? v.toString() : v))
  );
}
