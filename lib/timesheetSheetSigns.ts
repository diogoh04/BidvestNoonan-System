// Client helper pra /api/timesheet-signs — o texto digitado nas colunas
// SIGN IN/SIGN OUT da folha impressa por prédio (ver TimesheetView). Mesmo
// esquema de lib/timesheetSheetOverrides.ts, tabela separada
// (TimesheetSheetSign): nunca escreve em Building/Timesheet.

export type SignValue = { in: string; out: string };

export type SignRow = {
  subjectType: string;
  subjectId: string;
  scope: string;
  signIn: string | null;
  signOut: string | null;
};

// Busca todos os Sign In/Out (qualquer scope) de um ou mais "assuntos" de
// uma vez só.
export async function fetchSignEntries(subjectType: string, subjectIds: string[]): Promise<SignRow[]> {
  const ids = subjectIds.filter(Boolean);
  if (ids.length === 0) return [];
  try {
    const res = await fetch(
      `/api/timesheet-signs?subjectType=${encodeURIComponent(subjectType)}&subjectIds=${ids
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

// Agrupa a resposta de fetchSignEntries por "subjectId:scope" pra consulta
// rápida na tela.
export function indexSignEntries(rows: SignRow[]): Record<string, SignRow> {
  return Object.fromEntries(rows.map((r) => [`${r.subjectId}:${r.scope}`, r]));
}

export async function saveSignEntry(subjectType: string, subjectId: string, scope: string, value: SignValue) {
  try {
    await fetch("/api/timesheet-signs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subjectType, subjectId, scope, signIn: value.in, signOut: value.out }),
    });
  } catch {
    // Best-effort — se falhar o usuário só perde o que digitou nessa célula,
    // nada crítico.
  }
}
