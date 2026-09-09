"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Send, X } from "lucide-react";
import StaffSearchInput from "@/components/StaffSearchInput";
import AdjustmentReportView from "@/components/AdjustmentReportView";
import { getMonday, toISODate } from "@/lib/week";
import {
  ADJUSTMENT_ACTIONS,
  ADJUSTMENT_ACTION_LABELS,
  ADJUSTMENT_ACTIONS_FROM_FORECAST,
  ADJUSTMENT_ACTIONS_WITH_REASON,
  ADJUSTMENT_ACTIONS_WITH_TIME,
  ABSENCE_CODES,
  ABSENCE_CODE_LABELS,
} from "@/lib/types";
import type { AdjustmentReportDTO, AdjustmentAction, AbsenceCode } from "@/lib/types";

type MyBuilding = { id: string; nome: string };
type ForecastPerson = { nome: string; staffNumber: string | null; staffId: string | null };

type EditItem = {
  key: string;
  action: AdjustmentAction;
  buildingId: string;
  staffId: string | null;
  staffNome: string;
  staffNumber: string;
  dateFrom: string;
  dateTo: string;
  timeFrom: string;
  timeTo: string;
  reasonCode: AbsenceCode | "";
  isCover: boolean;
  note: string;
};

function newItem(buildingId: string, weekStart: string): EditItem {
  return {
    key: "new-" + Math.random().toString(36).slice(2),
    action: "add_hours",
    buildingId,
    staffId: null,
    staffNome: "",
    staffNumber: "",
    dateFrom: weekStart,
    dateTo: weekStart,
    timeFrom: "",
    timeTo: "",
    reasonCode: "",
    isCover: false,
    note: "",
  };
}

function fromDTO(report: AdjustmentReportDTO): EditItem[] {
  return report.groups.flatMap((g) =>
    g.items.map((it) => ({
      key: it.id,
      action: it.action,
      buildingId: it.buildingId,
      staffId: it.staffId,
      staffNome: it.staffNome ?? "",
      staffNumber: it.staffNumber ?? "",
      dateFrom: it.dateFrom,
      dateTo: it.dateTo,
      timeFrom: it.timeFrom ?? "",
      timeTo: it.timeTo ?? "",
      reasonCode: (it.reasonCode as AbsenceCode | null) ?? "",
      isCover: it.isCover,
      note: it.note ?? "",
    }))
  );
}

// Item pronto pra salvar.
function isReady(it: EditItem): boolean {
  if (!it.buildingId || !(it.staffNome.trim() || it.staffId) || !it.dateFrom || !it.dateTo) return false;
  if (ADJUSTMENT_ACTIONS_WITH_TIME.includes(it.action) && !(it.timeFrom && it.timeTo)) return false;
  return true;
}

function toPayload(it: EditItem) {
  const withTime = ADJUSTMENT_ACTIONS_WITH_TIME.includes(it.action);
  const withReason = ADJUSTMENT_ACTIONS_WITH_REASON.includes(it.action);
  return {
    action: it.action,
    buildingId: it.buildingId,
    staffId: it.staffId,
    staffNome: it.staffNome.trim() || null,
    staffNumber: it.staffNumber.trim() || null,
    dateFrom: it.dateFrom,
    dateTo: it.dateTo,
    timeFrom: withTime && it.timeFrom ? it.timeFrom : null,
    timeTo: withTime && it.timeTo ? it.timeTo : null,
    reasonCode: withReason && it.reasonCode ? it.reasonCode : null,
    isCover: it.action === "add_hours" ? it.isCover : false,
    note: it.note.trim() || null,
  };
}

export default function AdjustmentReportEditorClient({
  initialReport,
  myBuildings,
}: {
  initialReport: AdjustmentReportDTO | null;
  myBuildings: MyBuilding[];
}) {
  const router = useRouter();
  const [report, setReport] = useState<AdjustmentReportDTO | null>(initialReport);
  const [weekStart, setWeekStart] = useState(initialReport?.weekStart ?? toISODate(getMonday(new Date())));
  const [items, setItems] = useState<EditItem[]>(initialReport ? fromDTO(initialReport) : []);
  // O card de formulário: null = fechado.
  const [draft, setDraft] = useState<EditItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forecast, setForecast] = useState<Record<string, ForecastPerson[]>>({});

  const readOnly = !!report && report.status !== "draft";

  // Busca quem está na previsão do prédio do draft (pros REMOVE).
  useEffect(() => {
    if (!report || !draft) return;
    if (!ADJUSTMENT_ACTIONS_FROM_FORECAST.includes(draft.action)) return;
    const bid = draft.buildingId;
    if (!bid || forecast[bid]) return;
    fetch(`/api/adjustment-reports/forecast-staff?buildingId=${bid}&weekStart=${report.weekStart}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((people: ForecastPerson[]) => setForecast((prev) => ({ ...prev, [bid]: people })))
      .catch(() => {});
  }, [draft, report, forecast]);

  async function save(next: EditItem[]) {
    if (!report) return null;
    setSaving(true);
    try {
      const res = await fetch(`/api/adjustment-reports/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: next.map(toPayload) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Could not save");
      }
      const fresh: AdjustmentReportDTO = await res.json();
      setReport(fresh);
      setItems(fromDTO(fresh));
      return fresh;
    } catch (e: any) {
      setError(e.message);
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function createReport() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/adjustment-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart }),
      });
      if (!res.ok) throw new Error("Could not create the report");
      const r: AdjustmentReportDTO = await res.json();
      setReport(r);
      setItems(fromDTO(r));
      router.replace(`/my/timesheets/adjustments/${r.id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  function updateDraft(patch: Partial<EditItem>) {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  }

  async function saveDraft() {
    if (!draft || !isReady(draft)) return;
    const exists = items.some((it) => it.key === draft.key);
    const next = exists ? items.map((it) => (it.key === draft.key ? draft : it)) : [...items, draft];
    setError(null);
    const ok = await save(next);
    if (ok) setDraft(null); // card volta a ficar limpo
  }

  async function deleteItem(id: string) {
    await save(items.filter((it) => it.key !== id));
  }

  function editItem(id: string) {
    const it = items.find((x) => x.key === id);
    if (it) setDraft({ ...it });
  }

  async function sendToSupervisor() {
    if (!report) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/adjustment-reports/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "submitted" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Could not send");
      }
      setReport(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  // --- Sem report ainda: escolher a semana e criar ---
  if (!report) {
    return (
      <div className="rounded-md border border-line bg-white p-5">
        <label className="mb-1 block text-sm font-medium text-ink">Week (Monday)</label>
        <input
          type="date"
          value={weekStart}
          onChange={(e) => e.target.value && setWeekStart(toISODate(getMonday(new Date(e.target.value + "T00:00:00Z"))))}
          className="rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-petrol"
        />
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <div className="mt-4">
          <button
            type="button"
            onClick={createReport}
            disabled={creating}
            className="rounded-md bg-petrol px-4 py-2 text-sm font-medium text-white hover:bg-petrolDark disabled:opacity-50"
          >
            {creating ? "Creating..." : "Start report"}
          </button>
        </div>
      </div>
    );
  }

  const fromForecast = draft ? ADJUSTMENT_ACTIONS_FROM_FORECAST.includes(draft.action) : false;
  const withTime = draft ? ADJUSTMENT_ACTIONS_WITH_TIME.includes(draft.action) : false;
  const withReason = draft ? ADJUSTMENT_ACTIONS_WITH_REASON.includes(draft.action) : false;
  const people = draft ? forecast[draft.buildingId] ?? [] : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-ink/60">
          <span>Week starting {report.weekStart}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              report.status === "done"
                ? "bg-green-50 text-success"
                : report.status === "submitted"
                ? "bg-amber-50 text-amber-700"
                : "bg-surface text-ink/60"
            }`}
          >
            {report.status}
          </span>
          {saving && <span className="text-xs text-ink/40">Saving…</span>}
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={sendToSupervisor}
            disabled={sending || items.length === 0 || !!draft}
            title={draft ? "Save or cancel the open item first" : undefined}
            className="flex items-center gap-2 rounded-md bg-petrol px-4 py-2 text-sm font-medium text-white hover:bg-petrolDark disabled:opacity-50"
          >
            <Send size={15} />
            {sending ? "Sending..." : "Send to supervisor"}
          </button>
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {/* ---- Card do formulário (1 só) ---- */}
      {!readOnly && (
        <div>
          {draft ? (
            <div className="rounded-md border border-petrol bg-white p-4">
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col text-xs text-ink/50">
                  Building
                  <select
                    value={draft.buildingId}
                    onChange={(e) => updateDraft({ buildingId: e.target.value })}
                    className="mt-0.5 rounded-md border border-line px-2 py-1.5 text-sm text-ink outline-none focus:border-petrol"
                  >
                    {myBuildings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nome}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col text-xs text-ink/50">
                  Action
                  <select
                    value={draft.action}
                    onChange={(e) =>
                      updateDraft({
                        action: e.target.value as AdjustmentAction,
                        staffId: null,
                        staffNome: "",
                        staffNumber: "",
                      })
                    }
                    className="mt-0.5 rounded-md border border-line px-2 py-1.5 text-sm text-ink outline-none focus:border-petrol"
                  >
                    {ADJUSTMENT_ACTIONS.map((a) => (
                      <option key={a} value={a}>
                        {ADJUSTMENT_ACTION_LABELS[a]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col text-xs text-ink/50">
                  Staff
                  {fromForecast ? (
                    <select
                      value={draft.staffNome}
                      onChange={(e) => {
                        const p = people.find((x) => x.nome === e.target.value);
                        updateDraft({
                          staffNome: e.target.value,
                          staffNumber: p?.staffNumber ?? "",
                          staffId: p?.staffId ?? null,
                        });
                      }}
                      className="mt-0.5 min-w-[160px] rounded-md border border-line px-2 py-1.5 text-sm text-ink outline-none focus:border-petrol"
                    >
                      <option value="">Select from forecast...</option>
                      {people.map((p) => (
                        <option key={p.nome} value={p.nome}>
                          {p.nome}
                          {p.staffNumber ? ` (${p.staffNumber})` : ""}
                        </option>
                      ))}
                    </select>
                  ) : draft.staffNome ? (
                    <span className="mt-0.5 flex items-center gap-1.5 rounded-md border border-petrol bg-petrolLight px-2 py-1.5 text-sm text-petrol">
                      {draft.staffNome}
                      {draft.staffNumber ? ` (${draft.staffNumber})` : ""}
                      <button
                        type="button"
                        onClick={() => updateDraft({ staffNome: "", staffNumber: "", staffId: null })}
                        className="text-petrol/70 hover:text-petrolDark"
                      >
                        ×
                      </button>
                    </span>
                  ) : (
                    <div className="mt-0.5">
                      <StaffSearchInput
                        onSelect={(s) =>
                          updateDraft({ staffNome: s.nome, staffNumber: s.staffNumber ?? "", staffId: s.id })
                        }
                      />
                    </div>
                  )}
                </label>

                <label className="flex flex-col text-xs text-ink/50">
                  {withTime ? "From date" : "Effective date"}
                  <input
                    type="date"
                    value={draft.dateFrom}
                    onChange={(e) =>
                      updateDraft({
                        dateFrom: e.target.value,
                        dateTo: draft.dateTo < e.target.value ? e.target.value : draft.dateTo,
                      })
                    }
                    className="mt-0.5 rounded-md border border-line px-2 py-1.5 text-sm text-ink outline-none focus:border-petrol"
                  />
                </label>

                {withTime && (
                  <>
                    <label className="flex flex-col text-xs text-ink/50">
                      To date
                      <input
                        type="date"
                        value={draft.dateTo}
                        min={draft.dateFrom}
                        onChange={(e) => updateDraft({ dateTo: e.target.value })}
                        className="mt-0.5 rounded-md border border-line px-2 py-1.5 text-sm text-ink outline-none focus:border-petrol"
                      />
                    </label>
                    <label className="flex flex-col text-xs text-ink/50">
                      Time
                      <span className="mt-0.5 flex items-center gap-1">
                        <input
                          type="time"
                          value={draft.timeFrom}
                          onChange={(e) => updateDraft({ timeFrom: e.target.value })}
                          className="rounded-md border border-line px-2 py-1.5 text-sm text-ink outline-none focus:border-petrol"
                        />
                        <span className="text-ink/40">–</span>
                        <input
                          type="time"
                          value={draft.timeTo}
                          onChange={(e) => updateDraft({ timeTo: e.target.value })}
                          className="rounded-md border border-line px-2 py-1.5 text-sm text-ink outline-none focus:border-petrol"
                        />
                      </span>
                    </label>
                  </>
                )}

                {withReason && (
                  <label className="flex flex-col text-xs text-ink/50">
                    Reason
                    <select
                      value={draft.reasonCode}
                      onChange={(e) => updateDraft({ reasonCode: e.target.value as AbsenceCode | "" })}
                      className="mt-0.5 rounded-md border border-line px-2 py-1.5 text-sm text-ink outline-none focus:border-petrol"
                    >
                      <option value="">—</option>
                      {ABSENCE_CODES.map((c) => (
                        <option key={c} value={c}>
                          {c} · {ABSENCE_CODE_LABELS[c]}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {draft.action === "add_hours" && (
                  <label className="flex items-center gap-1.5 pb-1.5 text-xs text-ink/60">
                    <input
                      type="checkbox"
                      checked={draft.isCover}
                      onChange={(e) => updateDraft({ isCover: e.target.checked })}
                      className="h-4 w-4 rounded border-line"
                    />
                    cover
                  </label>
                )}
              </div>

              <input
                value={draft.note}
                onChange={(e) => updateDraft({ note: e.target.value })}
                placeholder="Note (optional)"
                className="mt-2 w-full rounded-md border border-line px-2 py-1.5 text-sm text-ink outline-none focus:border-petrol"
              />

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={saveDraft}
                  disabled={!isReady(draft) || saving}
                  className="rounded-md bg-petrol px-4 py-2 text-sm font-medium text-white hover:bg-petrolDark disabled:opacity-50"
                >
                  Save adjustment
                </button>
                <button
                  type="button"
                  onClick={() => setDraft(null)}
                  className="flex items-center gap-1 rounded-md border border-line px-3 py-2 text-sm text-ink hover:bg-surface"
                >
                  <X size={14} />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setDraft(newItem(myBuildings[0]?.id ?? "", report.weekStart))}
              disabled={myBuildings.length === 0}
              className="flex items-center gap-1 rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink transition hover:border-petrol hover:text-petrol disabled:opacity-50"
            >
              <Plus size={14} />
              Add adjustment
            </button>
          )}
        </div>
      )}

      {/* ---- Lista do que já foi salvo (agrupado por prédio e por staff) ---- */}
      <div>
        <h2 className="mb-2 font-mono text-xs uppercase tracking-widest text-ink/40">
          {readOnly ? "Report" : "Saved"}
        </h2>
        <AdjustmentReportView
          report={report}
          editable={readOnly ? undefined : { onEdit: editItem, onDelete: deleteItem }}
        />
      </div>
    </div>
  );
}
