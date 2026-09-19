"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { MessageSquarePlus, MessageCircle, Pencil, Trash2, X, History as HistoryIcon, Paperclip } from "lucide-react";
import { toWhatsAppHref } from "@/lib/phone";
import {
  HISTORY_KIND_LABELS,
  historyTargetLabel,
  formatHistoryRange,
  formatHistoryDuration,
  type StaffHistoryDTO,
} from "@/lib/historyFormat";
import { useLanguage } from "@/lib/i18n/LanguageContext";

type StaffRowProps = {
  id: string;
  nome: string | null;
  staffNumber: string | null;
  telefone: string | null;
  subtitle?: string;
  buildingId?: string;
  // id do vínculo StaffBuilding — identifica exatamente qual vínculo remover
  // quando o staff tem mais de um no mesmo prédio (dois turnos/postos).
  sbId?: string;
  // Papel deste vínculo específico ("cleaner" | "team_leader") — fallback do
  // DELETE quando não há `sbId`.
  role?: "cleaner" | "team_leader";
  // Recebe o `sbId` removido (ou o id do staff, se não houver vínculo).
  onDeleted?: (key: string) => void;
  // Team Leader vê e comenta, mas não edita staff nem abre o histórico (isso
  // é admin, exclusivo do Master).
  canManage?: boolean;
  // Remover o vínculo (tirar a pessoa deste prédio) — separado de
  // `canManage` pra dar essa ação ao Team Leader (ver /my) sem liberar
  // editar/histórico junto. Default = canManage (Master sempre pôde).
  canRemove?: boolean;
};

type Observation = { id: string; texto: string | null; data: string | null; fotos?: string[] };
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
  sbId,
  role,
  onDeleted,
  canManage = true,
  canRemove = canManage,
}: StaffRowProps) {
  const { t } = useLanguage();
  const [panel, setPanel] = useState<Panel>(null);
  const [obsText, setObsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fotos escolhidas mas ainda não enviadas — só sobem pro Blob (ver POST
  // /api/upload) no momento de salvar a nota, não na hora de escolher o
  // arquivo (evita anexo órfão se a pessoa desistir de salvar).
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  function addPendingFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const picked = Array.from(files);
    setPendingFiles((prev) => [...prev, ...picked]);
    setPendingPreviews((prev) => [...prev, ...picked.map((f) => URL.createObjectURL(f))]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePendingFile(index: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
    setPendingPreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function saveObservation() {
    if (!obsText.trim()) return;
    setSaving(true);
    setError(null);
    try {
      // Sobe as fotos primeiro (uma por vez é suficiente aqui — não é um
      // volume que justifique paralelizar) pra só criar a nota com os
      // pathnames já prontos (ver GET /api/files pra como isso vira imagem).
      const fotos: string[] = [];
      for (const file of pendingFiles) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error ?? "Failed to upload photo");
        fotos.push(body.pathname);
      }

      const res = await fetch(`/api/staff/${id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: obsText, fotos }),
      });
      if (!res.ok) throw new Error("Failed to save note");
      setObsText("");
      pendingPreviews.forEach((url) => URL.revokeObjectURL(url));
      setPendingFiles([]);
      setPendingPreviews([]);
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
        buildingId && sbId
          ? `/api/buildings/${buildingId}/staff/${id}?sbId=${sbId}`
          : buildingId && role
            ? `/api/buildings/${buildingId}/staff/${id}?role=${role}`
            : buildingId
              ? `/api/buildings/${buildingId}/staff/${id}`
              : `/api/staff/${id}`;
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      onDeleted?.(sbId ?? id);
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
            title={t("Notes")}
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
            </>
          )}
          {canRemove && (
            <button
              title="Delete"
              onClick={() => setConfirmingDelete(true)}
              className="rounded-md p-2 text-ink/60 transition hover:bg-red-50 hover:text-danger"
            >
              <Trash2 size={18} />
            </button>
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
              placeholder={t("Write a note...")}
              rows={2}
              className="flex-1 rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-petrol"
            />
            <button
              onClick={saveObservation}
              disabled={saving}
              className="rounded-md bg-petrol px-3 py-2 text-sm font-medium text-white transition hover:bg-petrolDark disabled:opacity-50"
            >
              {saving ? t("Saving...") : t("Save")}
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => addPendingFiles(e.target.files)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-md border border-dashed border-line px-2 py-1 text-xs text-ink/50 transition hover:border-petrol hover:text-petrol"
            >
              <Paperclip size={12} />
              {t("Attach photo")}
            </button>
            {pendingPreviews.map((src, i) => (
              <div key={src} className="group relative h-10 w-10 shrink-0 overflow-hidden rounded border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePendingFile(i)}
                  title={t("Remove")}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition group-hover:opacity-100"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-3">
            {loadingHistory && <p className="text-sm text-ink/40">{t("Loading...")}</p>}
            {!loadingHistory && history && history.length === 0 && (
              <p className="text-sm text-ink/40">{t("No notes yet.")}</p>
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
                      {obs.fotos && obs.fotos.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {obs.fotos.map((pathname) => {
                            // Store do Blob é privado — não dá pra apontar
                            // direto pra URL do blob, tem que passar pelo
                            // proxy autenticado (ver GET /api/files).
                            const src = `/api/files?pathname=${encodeURIComponent(pathname)}`;
                            return (
                              <a key={pathname} href={src} target="_blank" rel="noopener noreferrer">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={src}
                                  alt=""
                                  className="h-12 w-12 rounded border border-line object-cover transition hover:opacity-80"
                                />
                              </a>
                            );
                          })}
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

      {error && <p className="mt-2 text-xs text-danger">{t(error)}</p>}
    </div>
  );
}
