"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageSquarePlus, MessageCircle, Pencil, Trash2, X, History as HistoryIcon } from "lucide-react";
import { toWhatsAppHref } from "@/lib/phone";
import {
  HISTORY_KIND_LABELS,
  historyTargetLabel,
  formatHistoryRange,
  formatHistoryDuration,
  type StaffHistoryDTO,
} from "@/lib/historyFormat";

type StaffRowProps = {
  id: string;
  nome: string | null;
  staffNumber: string | null;
  telefone: string | null;
  subtitle?: string;
  buildingId?: string;
  // Papel deste vínculo específico ("cleaner" | "team_leader") — necessário
  // pro DELETE quando o staff tem dois vínculos no mesmo prédio.
  role?: "cleaner" | "team_leader";
  onDeleted?: (id: string) => void;
  // Team Leader vê e comenta, mas não edita/exclui staff (isso é admin,
  // exclusivo do Master) — o painel de histórico também é exclusivo dele.
  canManage?: boolean;
};

type Observation = { id: string; texto: string | null; data: string | null };
type Panel = null | "notes" | "history";

const HISTORY_KIND_STYLE: Record<StaffHistoryDTO["kind"], string> = {
  building: "bg-petrolLight text-petrol",
  team_leader: "bg-petrolLight text-petrol",
  team_leader_cover: "border border-dashed border-amber-400 bg-amber-50 text-amber-700",
};

export default function StaffRow({
  id,
  nome,
  staffNumber,
  telefone,
  subtitle,
  buildingId,
  role,
  onDeleted,
  canManage = true,
}: StaffRowProps) {
  const [panel, setPanel] = useState<Panel>(null);
  const [obsText, setObsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [history, setHistory] = useState<Observation[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [entries, setEntries] = useState<StaffHistoryDTO[] | null>(null);
  const [loadingEntries, setLoadingEntries] = useState(false);

  async function togglePanel(next: "notes" | "history") {
    if (panel === next) {
      setPanel(null);
      return;
    }
    setPanel(next);

    if (next === "notes" && history === null) {
      setLoadingHistory(true);
      try {
        const res = await fetch(`/api/staff/${id}/feedback`);
        const data = await res.json();
        setHistory(data);
      } catch {
        setHistory([]);
      } finally {
        setLoadingHistory(false);
      }
    }

    if (next === "history" && entries === null) {
      setLoadingEntries(true);
      try {
        const res = await fetch(`/api/staff/${id}/history`);
        const data = await res.json();
        setEntries(data);
      } catch {
        setEntries([]);
      } finally {
        setLoadingEntries(false);
      }
    }
  }

  async function saveObservation() {
    if (!obsText.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/staff/${id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: obsText }),
      });
      if (!res.ok) throw new Error("Failed to save note");
      setObsText("");
      const updated = await fetch(`/api/staff/${id}/feedback`).then((r) => r.json());
      setHistory(updated);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteObservation(obsId: string) {
    try {
      const res = await fetch(`/api/staff/${id}/feedback/${obsId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete note");
      setHistory((prev) => (prev ? prev.filter((o) => o.id !== obsId) : prev));
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function deleteEntry(entryId: string) {
    try {
      const res = await fetch(`/api/staff-history/${entryId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete entry");
      setEntries((prev) => (prev ? prev.filter((e) => e.id !== entryId) : prev));
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function deleteStaff() {
    setSaving(true);
    setError(null);
    try {
      const url =
        buildingId && role
          ? `/api/buildings/${buildingId}/staff/${id}?role=${role}`
          : buildingId
            ? `/api/buildings/${buildingId}/staff/${id}`
            : `/api/staff/${id}`;
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      onDeleted?.(id);
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  }

  return (
    <div className="rounded-md border border-line bg-white px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-medium text-ink">{nome || "—"}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-xs text-ink/50">
            <span>#{staffNumber || "n/a"}</span>
            {telefone &&
              (toWhatsAppHref(telefone) ? (
                <a
                  href={toWhatsAppHref(telefone)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-petrol hover:underline"
                >
                  <MessageCircle size={12} />
                  {telefone}
                </a>
              ) : (
                <span>{telefone}</span>
              ))}
            {subtitle && <span className="text-petrol">{subtitle}</span>}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            title="Notes"
            onClick={() => togglePanel("notes")}
            className={`rounded-md p-2 transition hover:bg-petrolLight hover:text-petrol ${
              panel === "notes" ? "bg-petrolLight text-petrol" : "text-ink/60"
            }`}
          >
            <MessageSquarePlus size={18} />
          </button>
          {canManage && (
            <>
              <button
                title="Building & team history"
                onClick={() => togglePanel("history")}
                className={`rounded-md p-2 transition hover:bg-petrolLight hover:text-petrol ${
                  panel === "history" ? "bg-petrolLight text-petrol" : "text-ink/60"
                }`}
              >
                <HistoryIcon size={18} />
              </button>
              <Link
                href={`/staff/${id}/edit`}
                title="Edit"
                className="rounded-md p-2 text-ink/60 transition hover:bg-petrolLight hover:text-petrol"
              >
                <Pencil size={18} />
              </Link>
              <button
                title="Delete"
                onClick={() => setConfirmingDelete(true)}
                className="rounded-md p-2 text-ink/60 transition hover:bg-red-50 hover:text-danger"
              >
                <Trash2 size={18} />
              </button>
            </>
          )}
        </div>
      </div>

      {panel === "notes" && (
        <div className="mt-3 border-t border-line pt-3">
          <div className="flex items-start gap-2">
            <textarea
              autoFocus
              value={obsText}
              onChange={(e) => setObsText(e.target.value)}
              placeholder="Write a note..."
              rows={2}
              className="flex-1 rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-petrol"
            />
            <button
              onClick={saveObservation}
              disabled={saving}
              className="rounded-md bg-petrol px-3 py-2 text-sm font-medium text-white transition hover:bg-petrolDark disabled:opacity-50"
            >
              Save
            </button>
          </div>

          <div className="mt-3">
            {loadingHistory && <p className="text-sm text-ink/40">Loading...</p>}
            {!loadingHistory && history && history.length === 0 && (
              <p className="text-sm text-ink/40">No notes yet.</p>
            )}
            {!loadingHistory && history && history.length > 0 && (
              <ul className="space-y-2">
                {history.map((obs) => (
                  <li
                    key={obs.id}
                    className="flex items-start justify-between gap-2 rounded-md bg-surface px-3 py-2 text-sm"
                  >
                    <div>
                      <div className="text-ink">{obs.texto}</div>
                      {obs.data && (
                        <div className="mt-0.5 font-mono text-xs text-ink/40">
                          {new Date(obs.data).toLocaleString("en-GB")}
                        </div>
                      )}
                    </div>
                    <button
                      title="Delete note"
                      onClick={() => deleteObservation(obs.id)}
                      className={`shrink-0 rounded p-1 text-ink/30 transition hover:bg-red-50 hover:text-danger ${
                        canManage ? "" : "hidden"
                      }`}
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {panel === "history" && (
        <div className="mt-3 border-t border-line pt-3">
          {loadingEntries && <p className="text-sm text-ink/40">Loading...</p>}
          {!loadingEntries && entries && entries.length === 0 && (
            <p className="text-sm text-ink/40">No history yet.</p>
          )}
          {!loadingEntries && entries && entries.length > 0 && (
            <ul className="space-y-2">
              {entries.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 rounded-md bg-surface px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${HISTORY_KIND_STYLE[e.kind]}`}>
                      {HISTORY_KIND_LABELS[e.kind]}
                    </span>
                    <span className="text-ink">{historyTargetLabel(e)}</span>
                    {!e.endedAt && (
                      <span className="rounded bg-success/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-success">
                        current
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right font-mono text-xs text-ink/40">
                      <div>{formatHistoryRange(e)}</div>
                      <div>{formatHistoryDuration(e.startedAt, e.endedAt)}</div>
                    </div>
                    <button
                      title="Delete entry (wrong change or test)"
                      onClick={() => deleteEntry(e.id)}
                      className="shrink-0 rounded p-1 text-ink/30 transition hover:bg-red-50 hover:text-danger"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {confirmingDelete && (
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
          <span className="text-sm text-danger">
            {buildingId
              ? `Remove ${nome} from this building?`
              : `Delete ${nome}? This action cannot be undone.`}
          </span>
          <div className="flex gap-2">
            <button
              onClick={deleteStaff}
              disabled={saving}
              className="rounded-md bg-danger px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirmingDelete(false)}
              className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-surface"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
