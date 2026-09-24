// Client helper pra /api/timesheet-overrides — as personalizações de
// Building/WO feitas direto na folha impressa (ver TimesheetView,
// LeaderTimesheetView e CombinedTimesheetEditor). Nunca escreve em
// predios/team/timesheet, só nessa tabela separada (TimesheetSheetOverride).

export type SheetOverrideValue = { nomePredio: string; wo: string; teamLeaderNome?: string };

export type SheetOverrideRow = {
  subjectType: string;
  subjectId: string;
  scope: string;
  nomePredio: string | null;
  workOrder: string | null;
  // Só preenchido no scope "header" (ver CombinedTimesheetEditor) — nome
  // digitado à mão pelo Team Leader nessa folha específica.
  teamLeaderNome: string | null;
};

// Busca todas as personalizações (qualquer scope) de um ou mais "assuntos"
// (prédios, times ou folhas) de uma vez só.
export async function fetchSheetOverrides(subjectType: string, subjectIds: string[]): Promise<SheetOverrideRow[]> {
  const ids = subjectIds.filter(Boolean);
  if (ids.length === 0) return [];
  try {
    const res = await fetch(
      `/api/timesheet-overrides?subjectType=${encodeURIComponent(subjectType)}&subjectIds=${ids
        .map(encodeURIComponent)
        .join(",")}`,
      { cache: "no-store" }
    );
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

// Agrupa a resposta de fetchSheetOverrides por "subjectId:scope" pra
// consulta rápida na tela.
export function indexSheetOverrides(rows: SheetOverrideRow[]): Record<string, SheetOverrideRow> {
  return Object.fromEntries(rows.map((r) => [`${r.subjectId}:${r.scope}`, r]));
}

export async function saveSheetOverride(
  subjectType: string,
  subjectId: string,
  scope: string,
  value: SheetOverrideValue
) {
  try {
    await fetch("/api/timesheet-overrides", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subjectType,
        subjectId,
        scope,
        nomePredio: value.nomePredio,
        workOrder: value.wo,
        teamLeaderNome: value.teamLeaderNome,
      }),
    });
  } catch {
    // Best-effort — igual o resto da folha, se falhar o usuário só perde a
    // personalização, nada crítico (dado real de predios/team intacto).
  }
}
