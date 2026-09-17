"use client";

import { useState } from "react";
import { RotateCcw, Trash2, User } from "lucide-react";
import { formatWeekRange } from "@/lib/week";
import type { TimesheetDTO, TimesheetStatus } from "@/lib/types";

const STATUS_LABEL: Record<TimesheetStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  done: "Done",
};

const STATUS_CLASS: Record<TimesheetStatus, string> = {
  draft: "bg-surface text-ink/60",
  submitted: "bg-amber-50 text-amber-700",
  done: "bg-green-50 text-success",
};

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" });
}

export default function ExcluidasListClient({ initialTimesheets }: { initialTimesheets: TimesheetDTO[] }) {
  const [timesheets, setTimesheets] = useState(initialTimesheets);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  // Confirmação antes de excluir de vez — ação sem volta (tira do banco de
  // verdade), diferente de mover pra lixeira, que sempre dá pra desfazer.
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [deletingForeverId, setDeletingForeverId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function restore(id: string) {
    setError(null);
    setRestoringId(id);
    try {
      const res = await fetch(`/api/timesheets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restore: true }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Could not restore the timesheet");
      }
      setTimesheets((prev) => prev.filter((t) => t.id !== id));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRestoringId(null);
    }
  }

  async function deleteForever(id: string) {
    setError(null);
    setDeletingForeverId(id);
    try {
      const res = await fetch(`/api/timesheets/${id}?permanent=1`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Could not permanently delete the timesheet");
      }
      setTimesheets((prev) => prev.filter((t) => t.id !== id));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeletingForeverId(null);
      setConfirmingDeleteId(null);
    }
  }

  // Agrupado por team leader (mesmo padrão de /review/[weekStart]) — "none"
  // é a conta de quem enviou já ter sido excluída depois.
  const byLeader = new Map<string, { username: string; items: TimesheetDTO[] }>();
  for (const t of timesheets) {
    const key = t.submittedByUserId ?? "none";
    const entry = byLeader.get(key) ?? { username: t.submittedByNome ?? "Removed account", items: [] };
    entry.items.push(t);
    byLeader.set(key, entry);
  }
  const leaders = Array.from(byLeader.entries()).sort((a, b) => a[1].username.localeCompare(b[1].username));
  for (const [, entry] of leaders) {
    entry.items.sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  }

  return (
    <div className="mt-6 space-y-4">
      {error && <p className="text-sm text-danger">{error}</p>}

      {leaders.map(([userId, { username, items }]) => (
        <div key={userId} className="overflow-hidden rounded-md border border-line bg-white">
          <div className="flex items-center gap-2 border-b border-line bg-surface px-4 py-2">
            <User size={16} className="text-petrol" />
            <span className="font-medium text-ink">{username}</span>
            <span className="text-xs text-ink/40">({items.length})</span>
          </div>
          <div className="divide-y divide-line">
            {items.map((t) =>
              confirmingDeleteId === t.id ? (
                <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 bg-red-50/40 px-4 py-3">
                  <span className="text-sm text-danger">
                    Permanently delete {t.buildingNome} · Week {formatWeekRange(t.weekStart)}? This cannot be undone.
                  </span>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => deleteForever(t.id)}
                      disabled={deletingForeverId === t.id}
                      className="rounded-md bg-danger px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmingDeleteId(null)}
                      className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-surface"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm text-ink">
                      {t.buildingNome}
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[t.status]}`}>
                        {STATUS_LABEL[t.status]}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-ink/50">
                      Week {formatWeekRange(t.weekStart)} · Deleted by {t.deletedByNome ?? "—"} on{" "}
                      {formatDateTime(t.deletedAt)}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => restore(t.id)}
                      disabled={restoringId === t.id}
                      className="flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink transition hover:border-petrol hover:text-petrol disabled:opacity-50"
                    >
                      <RotateCcw size={14} />
                      Restore
                    </button>
                    <button
                      onClick={() => setConfirmingDeleteId(t.id)}
                      className="flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-sm font-medium text-danger transition hover:border-danger hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                      Delete forever
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      ))}

      {leaders.length === 0 && <p className="text-sm text-ink/40">No timesheet deleted.</p>}
    </div>
  );
}
