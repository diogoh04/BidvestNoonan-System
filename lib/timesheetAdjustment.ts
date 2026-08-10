import type { TimesheetEntries } from "./types";

// Uma célula (linha+dia+campo) que mudou entre o que foi enviado (draft ->
// submitted, ver Timesheet.submittedSnapshot) e uma edição posterior. Ver
// PATCH /api/timesheets/[id], que chama computeTimesheetDiff pra decidir se
// grava/atualiza um Adjustment.
export type TimesheetDiffEntry = {
  rowIndex: number;
  kind: string;
  nome: string | null;
  day: string;
  field: "in" | "out";
  before: string | null;
  after: string | null;
};

// Compara duas TimesheetEntries linha a linha por índice — a identidade e a
// ordem das linhas não mudam entre o primeiro envio e uma edição posterior
// (só os valores de `days`), com exceção de covers adicionados/removidos
// depois do envio, tratados como "ausente" (null) do lado que não tem a
// linha. Só retorna as células que realmente mudaram.
export function computeTimesheetDiff(before: TimesheetEntries, after: TimesheetEntries): TimesheetDiffEntry[] {
  const diffs: TimesheetDiffEntry[] = [];
  const maxLen = Math.max(before.rows.length, after.rows.length);

  for (let i = 0; i < maxLen; i++) {
    const b = before.rows[i];
    const a = after.rows[i];
    const dayKeys = new Set([...(b ? Object.keys(b.days) : []), ...(a ? Object.keys(a.days) : [])]);

    for (const day of dayKeys) {
      for (const field of ["in", "out"] as const) {
        const beforeVal = b?.days[day]?.[field] ?? null;
        const afterVal = a?.days[day]?.[field] ?? null;
        if (beforeVal !== afterVal) {
          diffs.push({
            rowIndex: i,
            kind: (a ?? b)!.kind,
            nome: (a ?? b)!.nome,
            day,
            field,
            before: beforeVal,
            after: afterVal,
          });
        }
      }
    }
  }

  return diffs;
}
