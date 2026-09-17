"use client";

import { useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { formatPeriodRange } from "@/lib/week";
import type { TimesheetDTO } from "@/lib/types";

type Row = { weekStart: string; userId: string; items: TimesheetDTO[] };

// Excluir aqui move pra lixeira (mesmo DELETE de sempre) — dá pra restaurar
// em /review/excluidas. A "linha" reúne todas as folhas (um por prédio) da
// mesma submissão (mesmo TL + mesma semana), então excluir apaga todas elas
// juntas de uma vez.
export default function ReviewWeeksListClient({ initialRows }: { initialRows: Row[] }) {
  const [rows, setRows] = useState(initialRows);
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function deleteRow(key: string, items: TimesheetDTO[]) {
    setDeletingKey(key);
    setError(null);
    try {
      const results = await Promise.all(items.map((t) => fetch(`/api/timesheets/${t.id}`, { method: "DELETE" })));
      if (results.some((r) => !r.ok)) throw new Error("Could not delete some buildings from this submission");
      setRows((prev) => prev.filter((r) => `${r.weekStart}|${r.userId}` !== key));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeletingKey(null);
      setConfirmingKey(null);
    }
  }

  return (
    <div className="mt-6 space-y-2">
      {error && <p className="text-sm text-danger">{error}</p>}

      {rows.map((r) => {
        const key = `${r.weekStart}|${r.userId}`;
        const first = r.items[0];
        const pending = r.items.some((t) => t.status === "submitted");
        const teamNum = first.submittedByTeamNumber;
        const range =
          first.periodType === "biweekly"
            ? formatPeriodRange(r.weekStart, first.weekEnd, first.periodType)
            : `Week ${formatPeriodRange(r.weekStart, first.weekEnd, first.periodType)}`;

        if (confirmingKey === key) {
          return (
            <div
              key={key}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-danger bg-white px-4 py-3"
            >
              <span className="text-sm text-danger">
                Move this submission ({range}, {r.items.length} building{r.items.length !== 1 ? "s" : ""}) to the
                trash?
              </span>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => deleteRow(key, r.items)}
                  disabled={deletingKey === key}
                  className="rounded-md bg-danger px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmingKey(null)}
                  className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-surface"
                >
                  Cancel
                </button>
              </div>
            </div>
          );
        }

        return (
          <div key={key} className="flex items-center gap-2">
            <Link
              href={`/review/${r.weekStart}/${r.userId}`}
              className="flex flex-1 items-center justify-between rounded-md border border-line bg-white px-4 py-3 transition hover:border-petrol"
            >
              <div>
                <div className="font-medium text-ink">
                  {teamNum != null ? `Team ${teamNum} · ` : ""}
                  {first.submittedByNome ?? "Removed account"}
                </div>
                <div className="text-xs text-ink/40">
                  {range} · {r.items.length} building{r.items.length !== 1 ? "s" : ""}
                </div>
              </div>
              {pending ? (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">Pending</span>
              ) : (
                <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-success">Done</span>
              )}
            </Link>
            <button
              type="button"
              onClick={() => setConfirmingKey(key)}
              title="Delete"
              className="shrink-0 rounded-md border border-line p-2.5 text-ink/40 hover:border-danger hover:text-danger"
            >
              <Trash2 size={16} />
            </button>
          </div>
        );
      })}
      {rows.length === 0 && <p className="text-sm text-ink/40">No timesheet submitted yet.</p>}
    </div>
  );
}
