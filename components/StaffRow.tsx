"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageSquarePlus, Pencil, Trash2, X } from "lucide-react";

type StaffRowProps = {
  id: string;
  nome: string | null;
  staffNumber: string | null;
  telefone: string | null;
  subtitle?: string;
  buildingId?: string;
  onDeleted?: (id: string) => void;
};

type Observation = { id: string; texto: string | null; data: string | null };

export default function StaffRow({
  id,
  nome,
  staffNumber,
  telefone,
  subtitle,
  buildingId,
  onDeleted,
}: StaffRowProps) {
  const [showPanel, setShowPanel] = useState(false);
  const [obsText, setObsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [history, setHistory] = useState<Observation[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  async function togglePanel() {
    if (showPanel) {
      setShowPanel(false);
      return;
    }
    setShowPanel(true);
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
      if (!res.ok) throw new Error("Falha ao salvar observação");
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
      if (!res.ok) throw new Error("Falha ao excluir observação");
      setHistory((prev) => (prev ? prev.filter((o) => o.id !== obsId) : prev));
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function deleteStaff() {
    setSaving(true);
    setError(null);
    try {
      const url = buildingId ? `/api/buildings/${buildingId}/staff/${id}` : `/api/staff/${id}`;
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error("Falha ao excluir");
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
            <span>#{staffNumber || "s/n"}</span>
            {telefone && <span>{telefone}</span>}
            {subtitle && <span className="text-petrol">{subtitle}</span>}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            title="Observações"
            onClick={togglePanel}
            className={`rounded-md p-2 transition hover:bg-petrolLight hover:text-petrol ${
              showPanel ? "bg-petrolLight text-petrol" : "text-ink/60"
            }`}
          >
            <MessageSquarePlus size={18} />
          </button>
          <Link
            href={`/staff/${id}/edit`}
            title="Editar"
            className="rounded-md p-2 text-ink/60 transition hover:bg-petrolLight hover:text-petrol"
          >
            <Pencil size={18} />
          </Link>
          <button
            title="Excluir"
            onClick={() => setConfirmingDelete(true)}
            className="rounded-md p-2 text-ink/60 transition hover:bg-red-50 hover:text-danger"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {showPanel && (
        <div className="mt-3 border-t border-line pt-3">
          <div className="flex items-start gap-2">
            <textarea
              autoFocus
              value={obsText}
              onChange={(e) => setObsText(e.target.value)}
              placeholder="Escreva a observação..."
              rows={2}
              className="flex-1 rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-petrol"
            />
            <button
              onClick={saveObservation}
              disabled={saving}
              className="rounded-md bg-petrol px-3 py-2 text-sm font-medium text-white transition hover:bg-petrolDark disabled:opacity-50"
            >
              Salvar
            </button>
          </div>

          <div className="mt-3">
            {loadingHistory && <p className="text-sm text-ink/40">Carregando...</p>}
            {!loadingHistory && history && history.length === 0 && (
              <p className="text-sm text-ink/40">Nenhuma observação registrada ainda.</p>
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
                          {new Date(obs.data).toLocaleString("pt-BR")}
                        </div>
                      )}
                    </div>
                    <button
                      title="Excluir observação"
                      onClick={() => deleteObservation(obs.id)}
                      className="shrink-0 rounded p-1 text-ink/30 transition hover:bg-red-50 hover:text-danger"
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

      {confirmingDelete && (
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
          <span className="text-sm text-danger">
            {buildingId
              ? `Remover ${nome} deste prédio?`
              : `Excluir ${nome}? Essa ação não pode ser desfeita.`}
          </span>
          <div className="flex gap-2">
            <button
              onClick={deleteStaff}
              disabled={saving}
              className="rounded-md bg-danger px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              Confirmar
            </button>
            <button
              onClick={() => setConfirmingDelete(false)}
              className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-surface"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}