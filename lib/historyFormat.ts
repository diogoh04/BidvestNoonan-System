// Tipos/formatadores puros (sem Prisma) compartilhados entre o painel de
// histórico em StaffRow e o relatório geral em /staff-history, pra garantir
// que os dois mostram a mesma coisa do mesmo jeito.

export type HistoryKind = "building" | "team_leader" | "team_leader_cover";

export type StaffHistoryDTO = {
  id: string;
  kind: HistoryKind;
  staffId: string;
  // Só vem preenchido no relatório geral (/api/staff-history), que lista
  // várias pessoas — no painel por staff (/api/staff/[id]/history) já se
  // sabe de quem é.
  staffNome?: string | null;
  staffNumber?: string | null;
  buildingId: string | null;
  buildingName: string | null;
  teamId: string | null;
  teamNumber: number | null;
  horas: number | null;
  startedAt: string;
  endedAt: string | null;
  note: string | null;
};

export const HISTORY_KIND_LABELS: Record<HistoryKind, string> = {
  building: "Building",
  team_leader: "Team leader",
  team_leader_cover: "Cover",
};

export function historyTargetLabel(h: Pick<StaffHistoryDTO, "kind" | "buildingName" | "teamNumber">): string {
  if (h.kind === "building") return h.buildingName ?? "—";
  return h.teamNumber != null ? `Team ${h.teamNumber}` : "Team —";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatHistoryRange(h: Pick<StaffHistoryDTO, "startedAt" | "endedAt">): string {
  const start = formatDate(h.startedAt);
  return h.endedAt ? `${start} → ${formatDate(h.endedAt)}` : `${start} → current`;
}

export function formatHistoryDuration(startedAt: string, endedAt: string | null): string {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const days = Math.max(0, Math.round((end - start) / 86_400_000));

  if (days < 1) return "< 1 day";
  if (days < 30) return `${days} day${days !== 1 ? "s" : ""}`;
  if (days < 365) {
    const months = Math.round(days / 30);
    return `${months} mo${months !== 1 ? "s" : ""}`;
  }
  const years = Math.floor(days / 365);
  const months = Math.round((days % 365) / 30);
  return months > 0 ? `${years}y ${months}mo` : `${years}y`;
}
