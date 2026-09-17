"use client";

import { useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { formatWeekRange } from "@/lib/week";
import type { AdjustmentReportDTO } from "@/lib/types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB");
}

// Excluir aqui é DEFINITIVO — ajuste não tem lixeira (ver DELETE em
// app/api/adjustment-reports/[id]/route.ts). Só Master/Supervisor, só num
// relatório já enviado (submitted/done) — pro TL apagar o próprio rascunho
// o fluxo continua sendo o de sempre em /my/timesheets/adjustments.
export default function ReviewAdjustmentsListClient({ initialReports }: { initialReports: AdjustmentReportDTO[] }) {
  const [reports, setReports] = useState(initialReports);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function deleteReport(id: string) {
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/adjustment-reports/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Could not delete the report");
      }
      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeletingId(null);
      setConfirmingId(null);
    }
  }

  const pending = reports.filter((r) => r.status === "submitted");
  const done = reports.filter((r) => r.status === "done");

  function row(r: AdjustmentReportDTO) {
    if (confirmingId === r.id) {
      return (
        <div
          key={r.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-danger bg-white px-4 py-3"
        >
          <span className="text-sm text-danger">
            Permanently delete this adjustment report ({r.submittedByNome ?? "—"}, week{" "}
            {formatWeekRange(r.weekStart)})? This cannot be undone.
          </span>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => deleteReport(r.id)}
              disabled={deletingId === r.id}
              className="rounded-md bg-danger px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirmingId(null)}
              className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-surface"
            >
              Cancel
            </button>
          </div>
        </div>
      );
    }

    return (
      <div key={r.id} className="flex items-center gap-2">
        <Link
          href={`/review/adjustments/${r.id}`}
          className="flex flex-1 items-center justify-between gap-3 rounded-md border border-line bg-white px-4 py-3 transition hover:border-petrol"
        >
          <div>
            <div className="font-medium text-ink">
              {r.submittedByTeamNumber != null ? `Team ${r.submittedByTeamNumber} · ` : ""}
              {r.submittedByNome ?? "—"} · Week {formatWeekRange(r.weekStart)}
            </div>
            <div className="text-xs text-ink/40">
              {r.itemCount} item{r.itemCount !== 1 ? "s" : ""}
              {r.groups.length > 0 ? ` · ${r.groups.map((g) => g.buildingNome).join(", ")}` : ""}
              {r.submittedAt ? ` · sent ${formatDate(r.submittedAt)}` : ""}
            </div>
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
              r.status === "done" ? "bg-green-50 text-success" : "bg-amber-50 text-amber-700"
            }`}
          >
            {r.status === "done" ? "Done" : "Pending"}
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setConfirmingId(r.id)}
          title="Delete"
          className="shrink-0 rounded-md border border-line p-2.5 text-ink/40 hover:border-danger hover:text-danger"
        >
          <Trash2 size={16} />
        </button>
      </div>
    );
  }

  return (
    <>
      {error && <p className="mt-4 text-sm text-danger">{error}</p>}
      {reports.length === 0 && <p className="mt-6 text-sm text-ink/40">No adjustment reports yet.</p>}

      {pending.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 font-mono text-xs uppercase tracking-widest text-ink/40">Pending</h2>
          <div className="space-y-2">{pending.map(row)}</div>
        </div>
      )}

      {done.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 font-mono text-xs uppercase tracking-widest text-ink/40">Done</h2>
          <div className="space-y-2">{done.map(row)}</div>
        </div>
      )}
    </>
  );
}
