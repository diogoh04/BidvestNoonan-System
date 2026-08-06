"use client";

import { useEffect, useState } from "react";
import { Send, Copy, FilePlus } from "lucide-react";
import { getMonday, toISODate, formatWeekRange, formatFortnightRange, isWithinFortnight } from "@/lib/week";
import CombinedTimesheetEditor from "@/components/timesheets/CombinedTimesheetEditor";
import type { TimesheetDTO, TimesheetPeriodType } from "@/lib/types";

type MyBuilding = { id: string; nome: string };
type MyProfile = { id: string; nome: string | null; staffNumber: string | null; buildings: MyBuilding[] };
type ExistingPeriod = { weekStart: string; periodType: TimesheetPeriodType };

export default function LancarClient({ initialWeek }: { initialWeek: string | null }) {
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [existingWeeks, setExistingWeeks] = useState<ExistingPeriod[]>([]);
  const [weekStart, setWeekStart] = useState(initialWeek ?? toISODate(getMonday(new Date())));
  const [timesheets, setTimesheets] = useState<TimesheetDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendingAll, setSendingAll] = useState(false);
  const [pendingChoice, setPendingChoice] = useState(false);
  // Só usado ao começar um período novo (pendingChoice) — pra um já
  // existente, o periodType vem de `existingWeeks`, não muda depois de criado.
  const [newPeriodType, setNewPeriodType] = useState<TimesheetPeriodType>("weekly");

  useEffect(() => {
    init();
  }, []);

  async function init() {
    const [profileRes, allRes] = await Promise.all([fetch("/api/my/buildings"), fetch("/api/timesheets")]);
    if (profileRes.ok) setProfile(await profileRes.json());
    if (allRes.ok) {
      const all: TimesheetDTO[] = await allRes.json();
      setExistingWeeks(dedupePeriods(all));
    }
  }

  function dedupePeriods(all: TimesheetDTO[]): ExistingPeriod[] {
    const byWeek = new Map<string, TimesheetPeriodType>();
    for (const t of all) if (!byWeek.has(t.weekStart)) byWeek.set(t.weekStart, t.periodType);
    return Array.from(byWeek.entries())
      .map(([ws, periodType]) => ({ weekStart: ws, periodType }))
      .sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  }

  // Acha o período (semanal ou quinzenal) que já cobre essa data — batendo
  // exatamente o início, ou caindo dentro da 2ª semana de uma quinzena já
  // criada (ela não tem weekStart próprio, só existe dentro da 1ª).
  function findExistingPeriod(dateStr: string): ExistingPeriod | null {
    const exact = existingWeeks.find((w) => w.weekStart === dateStr);
    if (exact) return exact;
    return existingWeeks.find((w) => w.periodType === "biweekly" && isWithinFortnight(w.weekStart, dateStr)) ?? null;
  }

  useEffect(() => {
    if (!profile) return;
    const found = findExistingPeriod(weekStart);
    if (found) {
      if (found.weekStart !== weekStart) {
        setWeekStart(found.weekStart); // recai no início real do período; o efeito roda de novo
        return;
      }
      setPendingChoice(false);
      loadWeek(found.weekStart, null, found.periodType);
    } else {
      setTimesheets([]);
      setPendingChoice(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, weekStart]);

  function priorPeriod(week: string, periodType: TimesheetPeriodType) {
    return existingWeeks.find((w) => w.periodType === periodType && w.weekStart < week) ?? null;
  }

  async function loadWeek(week: string, copyFrom: string | null, periodType: TimesheetPeriodType) {
    if (!profile) return;
    setLoading(true);
    setError(null);
    setPendingChoice(false);
    try {
      const created = await Promise.all(
        profile.buildings.map(async (b) => {
          const res = await fetch("/api/timesheets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              buildingId: b.id,
              weekStart: week,
              periodType,
              ...(copyFrom ? { copyFromWeekStart: copyFrom } : {}),
            }),
          });
          if (!res.ok) throw new Error(`Could not load the timesheet for ${b.nome}`);
          return (await res.json()) as TimesheetDTO;
        })
      );
      created.sort((a, b) => a.buildingNome.localeCompare(b.buildingNome));
      setTimesheets(created);
      setExistingWeeks((prev) =>
        prev.some((w) => w.weekStart === week)
          ? prev
          : [{ weekStart: week, periodType }, ...prev].sort((a, b) => b.weekStart.localeCompare(a.weekStart))
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function changeWeek(dateStr: string) {
    const monday = toISODate(getMonday(new Date(dateStr + "T00:00:00Z")));
    setWeekStart(monday);
  }

  function updateOne(updated: TimesheetDTO) {
    setTimesheets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }

  async function sendAllDrafts() {
    setSendingAll(true);
    try {
      const drafts = timesheets.filter((t) => t.status === "draft");
      const results = await Promise.all(
        drafts.map((t) =>
          fetch(`/api/timesheets/${t.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "submitted" }),
          }).then((r) => (r.ok ? r.json() : null))
        )
      );
      results.forEach((r) => r && updateOne(r));
    } finally {
      setSendingAll(false);
    }
  }

  const pendingDrafts = timesheets.filter((t) => t.status === "draft").length;
  const prior = priorPeriod(weekStart, newPeriodType);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3 print:hidden">
        <label className="text-sm font-medium text-ink">Week:</label>
        <input
          type="date"
          value={weekStart}
          onChange={(e) => changeWeek(e.target.value)}
          className="rounded-md border border-line px-3 py-1.5 text-sm outline-none focus:border-petrol"
        />

        {existingWeeks.length > 0 && (
          <>
            <span className="text-xs text-ink/40">or import timesheet:</span>
            <select
              value={existingWeeks.some((w) => w.weekStart === weekStart) ? weekStart : ""}
              onChange={(e) => e.target.value && setWeekStart(e.target.value)}
              className="rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-petrol"
            >
              <option value="">Select an already logged week...</option>
              {existingWeeks.map((w) => (
                <option key={w.weekStart} value={w.weekStart}>
                  {w.periodType === "biweekly"
                    ? `${formatFortnightRange(w.weekStart)} (Fortnight)`
                    : formatWeekRange(w.weekStart)}
                </option>
              ))}
            </select>
          </>
        )}

        {pendingDrafts > 0 && (
          <button
            type="button"
            onClick={sendAllDrafts}
            disabled={sendingAll}
            className="ml-auto flex items-center gap-2 rounded-md bg-petrol px-4 py-2 text-sm font-medium text-white hover:bg-petrolDark disabled:opacity-50"
          >
            <Send size={16} />
            Send all pending ({pendingDrafts})
          </button>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-danger print:hidden">{error}</p>}

      {pendingChoice && (
        <div className="mb-6 rounded-md border border-dashed border-line bg-surface px-4 py-8 text-center print:hidden">
          <p className="text-sm text-ink/60">
            No timesheet logged for the week of {formatWeekRange(weekStart)} yet.
          </p>

          <div className="mt-3 flex justify-center gap-2">
            {(["weekly", "biweekly"] as TimesheetPeriodType[]).map((pt) => (
              <button
                key={pt}
                type="button"
                onClick={() => setNewPeriodType(pt)}
                className={`rounded-md border px-4 py-1.5 text-sm font-medium transition ${
                  newPeriodType === pt
                    ? "border-petrol bg-petrol text-white"
                    : "border-line bg-white text-ink hover:border-petrol"
                }`}
              >
                {pt === "weekly" ? "Weekly" : "Biweekly"}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => loadWeek(weekStart, null, newPeriodType)}
              className="flex items-center gap-2 rounded-md bg-petrol px-4 py-2 text-sm font-medium text-white hover:bg-petrolDark"
            >
              <FilePlus size={16} />
              Start blank
            </button>
            {prior && (
              <button
                type="button"
                onClick={() => loadWeek(weekStart, prior.weekStart, newPeriodType)}
                className="flex items-center gap-2 rounded-md border border-line px-4 py-2 text-sm font-medium text-ink hover:border-petrol hover:text-petrol"
              >
                <Copy size={16} />
                Copy from previous {newPeriodType === "biweekly" ? "fortnight" : "week"} (
                {newPeriodType === "biweekly" ? formatFortnightRange(prior.weekStart) : formatWeekRange(prior.weekStart)}
                )
              </button>
            )}
          </div>
        </div>
      )}

      {loading && <p className="text-sm text-ink/40 print:hidden">Loading...</p>}

      {!pendingChoice && !loading && timesheets.length > 0 && (
        <CombinedTimesheetEditor teamLeaderNome={profile?.nome ?? null} timesheets={timesheets} onChanged={updateOne} />
      )}
    </div>
  );
}
