"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, User, Trash2 } from "lucide-react";
import type { TimesheetDTO } from "@/lib/types";

export default function WeekLeadersListClient({
  weekStart,
  initialTimesheets,
}: {
  weekStart: string;
  initialTimesheets: TimesheetDTO[];
}) {
  const [timesheets, setTimesheets] = useState(initialTimesheets);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const byLeader = new Map<string, { username: string; items: TimesheetDTO[] }>();
  for (const t of timesheets) {
    // Sem submittedByUserId = a conta de quem enviou foi excluída depois do
    // envio. A folha continua valendo, só agrupamos num bucket à parte em
    // vez de esconder (ver /api/timesheets, filtro submittedByUserId=none).
    const key = t.submittedByUserId ?? "none";
    const entry = byLeader.get(key) ?? { username: t.submittedByNome ?? "Conta removida", items: [] };
    entry.items.push(t);
    byLeader.set(key, entry);
  }
  const leaders = Array.from(byLeader.entries()).sort((a, b) => a[1].username.localeCompare(b[1].username));

  async function deleteLeaderWeek(userId: string, items: TimesheetDTO[]) {
    setError(null);
    setDeletingId(userId);
    try {
      const results = await Promise.all(items.map((t) => fetch(`/api/timesheets/${t.id}`, { method: "DELETE" })));
      if (results.some((r) => !r.ok)) throw new Error("Não foi possível excluir algumas folhas dessa semana");
      const idsToRemove = new Set(items.map((t) => t.id));
      setTimesheets((prev) => prev.filter((t) => !idsToRemove.has(t.id)));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeletingId(null);
      setConfirmingId(null);
    }
  }

  return (
    <div className="mt-6 space-y-2">
      {error && <p className="text-sm text-danger">{error}</p>}

      {leaders.map(([userId, { username, items }]) => {
        const pending = items.filter((t) => t.status === "submitted").length;

        if (confirmingId === userId) {
          return (
            <div
              key={userId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-danger bg-white px-4 py-3"
            >
              <span className="text-sm text-danger">
                Excluir as {items.length} folha(s) de {username} nesta semana? Dá pra restaurar depois em "Ver
                excluídas".
              </span>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => deleteLeaderWeek(userId, items)}
                  disabled={deletingId === userId}
                  className="rounded-md bg-danger px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  Confirmar
                </button>
                <button
                  onClick={() => setConfirmingId(null)}
                  className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-surface"
                >
                  Cancelar
                </button>
              </div>
            </div>
          );
        }

        return (
          <div
            key={userId}
            className="flex items-center justify-between rounded-md border border-line bg-white px-4 py-3 transition hover:border-petrol"
          >
            <Link href={`/review/${weekStart}/${userId}`} className="flex flex-1 items-center gap-3">
              <User size={18} className="text-petrol" />
              <div>
                <div className="font-medium text-ink">{username}</div>
                <div className="text-xs text-ink/40">{items.length} prédio(s)</div>
              </div>
            </Link>

            <div className="flex shrink-0 items-center gap-2">
              {pending > 0 ? (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                  Pendente
                </span>
              ) : (
                <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-success">
                  Concluído
                </span>
              )}
              <button
                type="button"
                onClick={() => setConfirmingId(userId)}
                title="Excluir folhas desta semana"
                className="rounded-md p-1.5 text-ink/40 hover:bg-red-50 hover:text-danger"
              >
                <Trash2 size={16} />
              </button>
              <Link href={`/review/${weekStart}/${userId}`} className="text-ink/30 hover:text-petrol">
                <ChevronRight size={18} />
              </Link>
            </div>
          </div>
        );
      })}

      {leaders.length === 0 && (
        <p className="rounded-md border border-dashed border-line px-4 py-8 text-center text-sm text-ink/50">
          Todas as folhas desta semana foram excluídas.
        </p>
      )}
    </div>
  );
}
