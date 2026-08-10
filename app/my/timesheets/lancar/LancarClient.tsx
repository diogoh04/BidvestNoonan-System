"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Send, Copy, FilePlus, Rocket } from "lucide-react";
import { getMonday, toISODate, formatWeekRange, formatFortnightRange, isWithinFortnight } from "@/lib/week";
import CombinedTimesheetEditor from "@/components/timesheets/CombinedTimesheetEditor";
import { getTimesheetDayKeys } from "@/lib/types";
import type { TimesheetDTO, TimesheetPeriodType, TimesheetEntries, FortnightPlanDTO } from "@/lib/types";

type MyBuilding = { id: string; nome: string };
type MyProfile = { id: string; nome: string | null; staffNumber: string | null; buildings: MyBuilding[] };
type ExistingPeriod = { weekStart: string; periodType: TimesheetPeriodType };
type FortnightSource = { fortnightStart: string; entries: TimesheetEntries };

// Mesma lógica de cloneEntriesForNewWeek (lib/timesheetSnapshot.ts), mas
// reescrita aqui porque aquele arquivo importa Prisma (server-only) e não
// pode entrar num componente client. Mantém as linhas (staff/vaga/cover) e
// zera os horários — nunca copia horas de verdade, só a forma das linhas.
function cloneRowsZeroed(source: TimesheetEntries, periodType: TimesheetPeriodType): TimesheetEntries {
  const emptyDays = Object.fromEntries(getTimesheetDayKeys(periodType).map((d) => [d, { in: null, out: null }]));
  return { rows: source.rows.map((r) => ({ ...r, days: { ...emptyDays } })) };
}

export default function LancarClient({ initialWeek }: { initialWeek: string | null }) {
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [existingWeeks, setExistingWeeks] = useState<ExistingPeriod[]>([]);
  // Lista completa (não deduplicada) — precisa pra achar, POR PRÉDIO, o
  // rascunho biweekly anterior ainda não lançado (ver findPriorFortnightSource).
  const [allTimesheets, setAllTimesheets] = useState<TimesheetDTO[]>([]);
  const [fortnightPlans, setFortnightPlans] = useState<FortnightPlanDTO[]>([]);
  const [weekStart, setWeekStart] = useState(initialWeek ?? toISODate(getMonday(new Date())));
  const [timesheets, setTimesheets] = useState<TimesheetDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendingAll, setSendingAll] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launchInfo, setLaunchInfo] = useState<{ week2Start: string; planId: string } | null>(null);
  const [pendingChoice, setPendingChoice] = useState(false);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    const [profileRes, allRes, plansRes] = await Promise.all([
      fetch("/api/my/buildings"),
      fetch("/api/timesheets"),
      fetch("/api/timesheets/fortnight-plans"),
    ]);
    if (profileRes.ok) setProfile(await profileRes.json());
    if (allRes.ok) {
      const all: TimesheetDTO[] = await allRes.json();
      setAllTimesheets(all);
      setExistingWeeks(dedupePeriods(all));
    }
    if (plansRes.ok) setFortnightPlans(await plansRes.json());
  }

  function dedupePeriods(all: TimesheetDTO[]): ExistingPeriod[] {
    const byWeek = new Map<string, TimesheetPeriodType>();
    for (const t of all) if (!byWeek.has(t.weekStart)) byWeek.set(t.weekStart, t.periodType);
    return Array.from(byWeek.entries())
      .map(([ws, periodType]) => ({ weekStart: ws, periodType }))
      .sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  }

  // Acha o período (semanal ou quinzenal) que já cobre essa data — batendo
  // exatamente o início, ou caindo dentro da 2ª semana de uma quinzena ainda
  // não lançada (ela não tem weekStart próprio, só existe dentro da 1ª —
  // depois do Launch, a 2ª semana vira uma linha real e passa a bater exato).
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
      loadExistingWeek(found.weekStart, found.periodType);
    } else {
      setTimesheets([]);
      setPendingChoice(true);
      setLaunchInfo(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, weekStart]);

  // Mais recente quinzenal anterior de UM prédio específico, antes da data
  // dada — prioriza o plano já lançado (histórico, forecastEntries) e cai
  // pro rascunho ainda não lançado se não houver plano. Usado só por "Copy
  // from previous fortnight".
  function findPriorFortnightSource(buildingId: string, beforeWeek: string): FortnightSource | null {
    const plan = fortnightPlans
      .filter((p) => p.buildingId === buildingId && p.fortnightStart < beforeWeek)
      .sort((a, b) => b.fortnightStart.localeCompare(a.fortnightStart))[0];
    if (plan) return { fortnightStart: plan.fortnightStart, entries: plan.forecastEntries };

    const draft = allTimesheets
      .filter((t) => t.buildingId === buildingId && t.periodType === "biweekly" && t.weekStart < beforeWeek)
      .sort((a, b) => b.weekStart.localeCompare(a.weekStart))[0];
    if (draft) return { fortnightStart: draft.weekStart, entries: draft.entries };

    return null;
  }

  // GET-or-create pra um período que JÁ existe (achado por
  // findExistingPeriod, ou logo depois de um Launch) — mantém o periodType
  // que a folha já tem, nunca cria com um tipo diferente.
  async function loadExistingWeek(week: string, periodType: TimesheetPeriodType) {
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
            body: JSON.stringify({ buildingId: b.id, weekStart: week, periodType }),
          });
          if (!res.ok) throw new Error(`Could not load the timesheet for ${b.nome}`);
          return (await res.json()) as TimesheetDTO;
        })
      );
      created.sort((a, b) => a.buildingNome.localeCompare(b.buildingNome));
      setTimesheets(created);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Começa uma quinzenal nova (Start New é sempre quinzenal — não existe
  // mais criar semana avulsa) — em branco, ou copiando (só a forma das
  // linhas, nunca os horários) a quinzenal anterior de cada prédio.
  async function startNewFortnight(week: string, copyPrior: boolean) {
    if (!profile) return;
    setLoading(true);
    setError(null);
    setPendingChoice(false);
    setLaunchInfo(null);
    try {
      const created = await Promise.all(
        profile.buildings.map(async (b) => {
          const res = await fetch("/api/timesheets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ buildingId: b.id, weekStart: week, periodType: "biweekly" }),
          });
          if (!res.ok) throw new Error(`Could not load the timesheet for ${b.nome}`);
          let ts = (await res.json()) as TimesheetDTO;

          if (copyPrior) {
            const source = findPriorFortnightSource(b.id, week);
            if (source) {
              const cloned = cloneRowsZeroed(source.entries, "biweekly");
              const patchRes = await fetch(`/api/timesheets/${ts.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ entries: cloned }),
              });
              if (patchRes.ok) ts = await patchRes.json();
            }
          }
          return ts;
        })
      );
      created.sort((a, b) => a.buildingNome.localeCompare(b.buildingNome));
      setTimesheets(created);
      setExistingWeeks((prev) => {
        if (prev.some((w) => w.weekStart === week)) return prev;
        const next: ExistingPeriod = { weekStart: week, periodType: "biweekly" };
        return [next, ...prev].sort((a, b) => b.weekStart.localeCompare(a.weekStart));
      });
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

  // "Lança" a quinzenal: o servidor converte a própria linha na folha da
  // semana 1 e cria a folha da semana 2, guardando o histórico num
  // FortnightPlan. Depois, recarrega tudo e cai na semana 1 (agora uma
  // folha semanal comum).
  async function launchFortnight() {
    setLaunching(true);
    setError(null);
    try {
      const res = await fetch("/api/timesheets/fortnight/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fortnightStart: weekStart }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Could not launch the fortnight");
      }
      const data = (await res.json()) as { fortnightStart: string; plans: FortnightPlanDTO[] };
      const firstPlan = data.plans[0];
      await init();
      if (firstPlan) {
        setLaunchInfo({ week2Start: firstPlan.week2.weekStart, planId: firstPlan.id });
        await loadExistingWeek(weekStart, "weekly");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLaunching(false);
    }
  }

  const periodType = timesheets[0]?.periodType;
  const isBiweeklyDraft = periodType === "biweekly" && timesheets.length > 0 && timesheets.every((t) => t.status === "draft");
  const pendingDrafts = periodType === "biweekly" ? 0 : timesheets.filter((t) => t.status === "draft").length;

  const priorSources = profile?.buildings.map((b) => findPriorFortnightSource(b.id, weekStart)).filter(Boolean) as
    | FortnightSource[]
    | undefined;
  const priorFortnightStart =
    priorSources && priorSources.length > 0
      ? priorSources.map((s) => s.fortnightStart).sort().reverse()[0]
      : null;

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

        {isBiweeklyDraft && (
          <button
            type="button"
            onClick={launchFortnight}
            disabled={launching}
            className="ml-auto flex items-center gap-2 rounded-md bg-petrol px-4 py-2 text-sm font-medium text-white hover:bg-petrolDark disabled:opacity-50"
          >
            <Rocket size={16} />
            {launching ? "Launching..." : "Launch"}
          </button>
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

      {launchInfo && (
        <div className="mb-4 rounded-md border border-success bg-green-50 px-4 py-3 text-sm text-success print:hidden">
          Launched — this is Week 1 of your fortnight.{" "}
          <Link href={`/my/timesheets/lancar?week=${launchInfo.week2Start}`} className="underline">
            View Week 2
          </Link>
          {" · "}
          <Link href={`/my/timesheets/fortnights/${launchInfo.planId}`} className="underline">
            View the fortnight plan
          </Link>
        </div>
      )}

      {error && <p className="mb-4 text-sm text-danger print:hidden">{error}</p>}

      {pendingChoice && (
        <div className="mb-6 rounded-md border border-dashed border-line bg-surface px-4 py-8 text-center print:hidden">
          <p className="text-sm text-ink/60">
            No fortnight logged for the fortnight of {formatFortnightRange(weekStart)} yet.
          </p>

          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => startNewFortnight(weekStart, false)}
              className="flex items-center gap-2 rounded-md bg-petrol px-4 py-2 text-sm font-medium text-white hover:bg-petrolDark"
            >
              <FilePlus size={16} />
              Start blank
            </button>
            {priorFortnightStart && (
              <button
                type="button"
                onClick={() => startNewFortnight(weekStart, true)}
                className="flex items-center gap-2 rounded-md border border-line px-4 py-2 text-sm font-medium text-ink hover:border-petrol hover:text-petrol"
              >
                <Copy size={16} />
                Copy from previous fortnight ({formatFortnightRange(priorFortnightStart)})
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
