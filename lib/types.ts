export type Role = "cleaner" | "team_leader";

export type StaffDTO = {
  id: string;
  nome: string | null;
  telefone: string | null;
  staffNumber: string | null;
  role: Role;
  buildingId: string | null;
  buildingNome: string | null;
  buildings?: { id: string; nome: string }[]; // usado quando role = team_leader
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
