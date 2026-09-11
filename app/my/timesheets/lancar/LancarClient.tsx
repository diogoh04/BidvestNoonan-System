"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Copy, FilePlus } from "lucide-react";
import {
  toISODate,
  formatWeekRange,
  formatFortnightRange,
  formatDDMM,
  isWithinFortnight,
  snapToWorkingDay,
  fortnightEndISO,
} from "@/lib/week";
import CombinedTimesheetEditor from "@/components/timesheets/CombinedTimesheetEditor";
import { getTimesheetDayKeys } from "@/lib/types";
import type {
  TimesheetDTO,
  TimesheetPeriodType,
  TimesheetEntries,
  TimesheetRow,
  FortnightPlanDTO,
} from "@/lib/types";

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

export default function LancarClient({
  initialWeek,
  forceNew = false,
}: {
  initialWeek: string | null;
  forceNew?: boolean;
}) {
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [existingWeeks, setExistingWeeks] = useState<ExistingPeriod[]>([]);
  // Lista completa (não deduplicada) — precisa pra achar, POR PRÉDIO, a
  // quinzenal anterior (ver findPriorFortnightSource).
  const [allTimesheets, setAllTimesheets] = useState<TimesheetDTO[]>([]);
  const [fortnightPlans, setFortnightPlans] = useState<FortnightPlanDTO[]>([]);
  // Início da quinzena — qualquer dia útil (não é forçado a segunda). As 10
  // colunas da folha são os 10 dias úteis a partir daqui.
  const [weekStart, setWeekStart] = useState(initialWeek ?? snapToWorkingDay(toISODate(new Date())));
  const [timesheets, setTimesheets] = useState<TimesheetDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [pendingChoice, setPendingChoice] = useState(false);
  // Só depois de init() (perfil + folhas carregados, e o salto pra quinzena
  // mais recente já feito) o efeito que carrega o período pode rodar.
  const [bootstrapped, setBootstrapped] = useState(false);

  // Linhas ao vivo do editor (antes do auto-save chegar ao servidor) — usado
  // pra "Send to supervisor" não perder a última tecla digitada.
  const liveRows = useRef<Record<string, TimesheetRow[]>>({});
  function currentEntries(t: TimesheetDTO): TimesheetEntries {
    return { rows: liveRows.current[t.id] ?? t.entries.rows };
  }

  useEffect(() => {
    init();
  }, []);

  async function init() {
    const [profileRes, allRes, plansRes] = await Promise.all([
      fetch("/api/my/buildings"),
      fetch("/api/timesheets"),
      fetch("/api/timesheets/fortnight-plans"),
    ]);
    if (profileRes.ok) {
      setProfile(await profileRes.json());
    } else {
      // Conta "team_leader" sem time vinculado (ver User.teamId) devolve 403
      // aqui — sem isto a tela ficava só com o seletor de data, sem
      // explicação nenhuma do motivo.
      setError(
        profileRes.status === 403
          ? "Your account isn't linked to a team yet. Ask the Master to link it in Users."
          : "Could not load your profile. Please try again."
      );
    }
    if (allRes.ok) {
      const all: TimesheetDTO[] = await allRes.json();
      setAllTimesheets(all);
      setExistingWeeks(dedupePeriods(all));
      // Abre direto na quinzena mais recente que já existe (a menos que a URL
      // peça uma data específica, ou "New fortnight"). Sem nenhuma → cai no
      // "Start Blank" da data de hoje.
      if (!initialWeek && !forceNew) {
        const latest = all
          .filter((t) => t.periodType === "biweekly")
          .map((t) => t.weekStart)
          .sort()
          .pop();
        if (latest) setWeekStart(latest);
      }
    }
    if (plansRes.ok) setFortnightPlans(await plansRes.json());
    setBootstrapped(true);
  }

  function dedupePeriods(all: TimesheetDTO[]): ExistingPeriod[] {
    const byWeek = new Map<string, TimesheetPeriodType>();
    for (const t of all) if (!byWeek.has(t.weekStart)) byWeek.set(t.weekStart, t.periodType);
    return Array.from(byWeek.entries())
      .map(([ws, periodType]) => ({ weekStart: ws, periodType }))
      .sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  }

  // Acha o período (semanal ou quinzenal) que já cobre essa data.
  function findExistingPeriod(dateStr: string): ExistingPeriod | null {
    const exact = existingWeeks.find((w) => w.weekStart === dateStr);
    if (exact) return exact;
    return existingWeeks.find((w) => w.periodType === "biweekly" && isWithinFortnight(w.weekStart, dateStr)) ?? null;
  }

  useEffect(() => {
    if (!profile || !bootstrapped) return;
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, bootstrapped, weekStart]);

  // Mais recente quinzenal anterior de UM prédio específico, antes da data
  // dada — prioriza o plano lançado (legado) e cai pra folha anterior. Usado
  // só por "Copy from previous fortnight".
  function findPriorFortnightSource(buildingId: string, beforeWeek: string): FortnightSource | null {
    const plan = fortnightPlans
      .filter((p) => p.buildingId === buildingId && p.fortnightStart < beforeWeek)
      .sort((a, b) => b.fortnightStart.localeCompare(a.fortnightStart))[0];
    if (plan) return { fortnightStart: plan.fortnightStart, entries: plan.forecastEntries };

    const prior = allTimesheets
      .filter((t) => t.buildingId === buildingId && t.periodType === "biweekly" && t.weekStart < beforeWeek)
      .sort((a, b) => b.weekStart.localeCompare(a.weekStart))[0];
    if (prior) return { fortnightStart: prior.weekStart, entries: prior.entries };

    return null;
  }

  // GET-or-create pra um período que JÁ existe — mantém o periodType da folha.
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
      liveRows.current = {};
      setTimesheets(created);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Começa uma quinzenal nova — em branco, ou copiando (só a forma das
  // linhas, nunca os horários) a quinzenal anterior de cada prédio.
  async function startNewFortnight(week: string, copyPrior: boolean) {
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
      liveRows.current = {};
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
    if (!dateStr) return;
    // Fim de semana empurra pra segunda; qualquer dia útil vale como início.
    setWeekStart(snapToWorkingDay(dateStr));
  }

  function updateOne(updated: TimesheetDTO) {
    setTimesheets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }

  function handleRowsChange(id: string, rows: TimesheetRow[]) {
    liveRows.current = { ...liveRows.current, [id]: rows };
  }

  // "Send to supervisor": envia a previsão (draft -> submitted). Manda o
  // entries ao vivo junto, pra congelar exatamente o que está na tela.
  async function sendToSupervisor() {
    setSending(true);
    setError(null);
    try {
      const drafts = timesheets.filter((t) => t.status === "draft");
      const results = await Promise.all(
        drafts.map((t) =>
          fetch(`/api/timesheets/${t.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ entries: currentEntries(t), status: "submitted" }),
          }).then((r) => (r.ok ? r.json() : null))
        )
      );
      setTimesheets((prev) => prev.map((t) => results.find((r) => r && r.id === t.id) ?? t));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  const periodType = timesheets[0]?.periodType;
  const allDraft = timesheets.length > 0 && timesheets.every((t) => t.status === "draft");
  const anySubmitted = timesheets.some((t) => t.status !== "draft");

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
        <label className="text-sm font-medium text-ink">Fortnight start:</label>
        <input
          type="date"
          value={weekStart}
          onChange={(e) => changeWeek(e.target.value)}
          className="rounded-md border border-line px-3 py-2 text-base outline-none focus:border-petrol sm:py-1.5 sm:text-sm"
        />
        <span className="text-sm text-ink/60">
          → {formatDDMM(fortnightEndISO(weekStart))} <span className="text-ink/40">(10 working days)</span>
        </span>

        {existingWeeks.length > 0 && (
          <>
            <span className="text-xs text-ink/40">or open a logged one:</span>
            <select
              value={existingWeeks.some((w) => w.weekStart === weekStart) ? weekStart : ""}
              onChange={(e) => e.target.value && setWeekStart(e.target.value)}
              className="max-w-full rounded-md border border-line px-2 py-2 text-base outline-none focus:border-petrol sm:py-1.5 sm:text-sm"
            >
              <option value="">Select an already logged fortnight...</option>
              {existingWeeks.map((w) => (
                <option key={w.weekStart} value={w.weekStart}>
                  {w.periodType === "biweekly"
                    ? formatFortnightRange(w.weekStart)
                    : `${formatWeekRange(w.weekStart)} (weekly, legacy)`}
                </option>
              ))}
            </select>
          </>
        )}

        {allDraft && periodType === "biweekly" && (
          <button
            type="button"
            onClick={sendToSupervisor}
            disabled={sending}
            className="ml-auto flex items-center gap-2 rounded-md bg-petrol px-4 py-2 text-sm font-medium text-white hover:bg-petrolDark disabled:opacity-50"
          >
            <Send size={16} />
            {sending ? "Sending..." : "Send to supervisor"}
          </button>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-danger print:hidden">{error}</p>}

      {pendingChoice && (
        <div className="mb-6 rounded-md border border-dashed border-line bg-surface px-4 py-8 text-center print:hidden">
          <p className="text-sm text-ink/60">No fortnight logged for {formatFortnightRange(weekStart)} yet.</p>

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
        <>
          {anySubmitted && (
            <div className="mb-4 rounded-md border border-line bg-surface px-4 py-3 text-sm text-ink/70 print:hidden">
              Sent to the supervisor — the forecast is locked. Changes during the fortnight go in an{" "}
              <a href="/my/timesheets" className="text-petrol underline">
                adjustment report
              </a>
              .
            </div>
          )}

          <CombinedTimesheetEditor
            teamLeaderNome={profile?.nome ?? null}
            timesheets={timesheets}
            onChanged={updateOne}
            onRowsChange={handleRowsChange}
          />
        </>
      )}
    </div>
  );
}
