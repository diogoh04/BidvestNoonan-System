"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Copy, FilePlus } from "lucide-react";
import {
  toISODate,
  formatPeriodRange,
  isWithinRange,
  snapToWorkingDay,
  fortnightEndISO,
  allDaysInRange,
} from "@/lib/week";
import CombinedTimesheetEditor from "@/components/timesheets/CombinedTimesheetEditor";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { getTimesheetDates } from "@/lib/types";
import type {
  TimesheetDTO,
  TimesheetPeriodType,
  TimesheetEntries,
  TimesheetRow,
  FortnightPlanDTO,
} from "@/lib/types";

type MyBuilding = { id: string; nome: string };
type MyProfile = { id: string; nome: string | null; staffNumber: string | null; buildings: MyBuilding[] };
type ExistingPeriod = { weekStart: string; weekEnd: string | null; periodType: TimesheetPeriodType };
type FortnightSource = { fortnightStart: string; fortnightEnd: string | null; entries: TimesheetEntries };

// Mesma lógica de cloneEntriesForNewWeek (lib/timesheetSnapshot.ts), mas
// reescrita aqui porque aquele arquivo importa Prisma (server-only) e não
// pode entrar num componente client. Mantém as linhas (staff/vaga/cover) e
// zera os horários — nunca copia horas de verdade, só a forma das linhas.
function cloneRowsZeroed(
  source: TimesheetEntries,
  periodType: TimesheetPeriodType,
  weekStart: string,
  weekEnd: string | null
): TimesheetEntries {
  const emptyDays = Object.fromEntries(getTimesheetDates(weekStart, weekEnd, periodType).map((d) => [d, { in: null, out: null }]));
  return { rows: source.rows.map((r) => ({ ...r, days: { ...emptyDays } })) };
}

export default function LancarClient({
  initialWeek,
  forceNew = false,
}: {
  initialWeek: string | null;
  forceNew?: boolean;
}) {
  const { t } = useLanguage();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [existingWeeks, setExistingWeeks] = useState<ExistingPeriod[]>([]);
  // Lista completa (não deduplicada) — precisa pra achar, POR PRÉDIO, a
  // quinzenal anterior (ver findPriorFortnightSource).
  const [allTimesheets, setAllTimesheets] = useState<TimesheetDTO[]>([]);
  const [fortnightPlans, setFortnightPlans] = useState<FortnightPlanDTO[]>([]);
  // Início e fim do período — qualquer dia útil pra início (não é forçado a
  // segunda), e o fim agora é escolhido livremente pelo Team Leader (antes
  // era sempre 10 dias úteis fixos a partir do início — ver fortnightEndISO,
  // ainda usado só como sugestão inicial ao trocar o início).
  const initialStart = initialWeek ?? snapToWorkingDay(toISODate(new Date()));
  const [weekStart, setWeekStart] = useState(initialStart);
  const [weekEnd, setWeekEnd] = useState(fortnightEndISO(initialStart));
  const [timesheets, setTimesheets] = useState<TimesheetDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [pendingChoice, setPendingChoice] = useState(false);
  // Só depois de init() (perfil + folhas carregados, e o salto pra quinzena
  // mais recente já feito) o efeito que carrega o período pode rodar.
  const [bootstrapped, setBootstrapped] = useState(false);

  // "New fortnight" (forceNew) parte da data de hoje — mas hoje quase sempre
  // já cai dentro da quinzenal atual em andamento, e sem isto o efeito de
  // baixo "achava" essa quinzenal existente e pulava direto pra ela, em vez
  // de deixar o Team Leader escolher as datas de uma nova. Fica true só até
  // a pessoa mexer numa data de propósito (changeWeek/changeWeekEnd/dropdown)
  // — a partir daí, digitar uma data que já existe volta a abrir ela
  // normalmente (isso é intencional, não o bug do "New fortnight").
  const skipAutoMatch = useRef(forceNew);

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
          ? t("Your account isn't linked to a team yet. Ask the Master to link it in Users.")
          : t("Could not load your profile. Please try again.")
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
        const latestSheet = all
          .filter((t) => t.periodType === "biweekly")
          .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
          .pop();
        if (latestSheet) {
          setWeekStart(latestSheet.weekStart);
          setWeekEnd(latestSheet.weekEnd ?? fortnightEndISO(latestSheet.weekStart));
        }
      }
    }
    if (plansRes.ok) setFortnightPlans(await plansRes.json());
    setBootstrapped(true);
  }

  function dedupePeriods(all: TimesheetDTO[]): ExistingPeriod[] {
    const byWeek = new Map<string, { periodType: TimesheetPeriodType; weekEnd: string | null }>();
    for (const t of all) if (!byWeek.has(t.weekStart)) byWeek.set(t.weekStart, { periodType: t.periodType, weekEnd: t.weekEnd });
    return Array.from(byWeek.entries())
      .map(([ws, v]) => ({ weekStart: ws, periodType: v.periodType, weekEnd: v.weekEnd }))
      .sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  }

  // Acha o período (semanal ou quinzenal) que já cobre essa data. Usa o
  // weekEnd real de cada período quando ele existe (folha de duração livre);
  // sem weekEnd (folha antiga), isWithinRange cai no cálculo fixo de sempre.
  function findExistingPeriod(dateStr: string): ExistingPeriod | null {
    const exact = existingWeeks.find((w) => w.weekStart === dateStr);
    if (exact) return exact;
    return (
      existingWeeks.find(
        (w) => w.periodType === "biweekly" && isWithinRange(w.weekStart, w.weekEnd ?? fortnightEndISO(w.weekStart), dateStr)
      ) ?? null
    );
  }

  useEffect(() => {
    if (!profile || !bootstrapped) return;
    const found = skipAutoMatch.current ? null : findExistingPeriod(weekStart);
    if (found) {
      if (found.weekStart !== weekStart) {
        setWeekStart(found.weekStart); // recai no início real do período; o efeito roda de novo
        return;
      }
      // O fim mostrado passa a ser o real da folha já lançada, não mais o
      // que o usuário estava digitando — o período, uma vez criado, é fixo.
      setWeekEnd(found.weekEnd ?? fortnightEndISO(found.weekStart));
      setPendingChoice(false);
      loadExistingWeek(found.weekStart, found.periodType, found.weekEnd);
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
    if (plan) return { fortnightStart: plan.fortnightStart, fortnightEnd: null, entries: plan.forecastEntries };

    const prior = allTimesheets
      .filter((t) => t.buildingId === buildingId && t.periodType === "biweekly" && t.weekStart < beforeWeek)
      .sort((a, b) => b.weekStart.localeCompare(a.weekStart))[0];
    if (prior) return { fortnightStart: prior.weekStart, fortnightEnd: prior.weekEnd, entries: prior.entries };

    return null;
  }

  // GET-or-create pra um período que JÁ existe — mantém o periodType e o
  // weekEnd da folha (não deixa a criação re-derivar um fim diferente).
  async function loadExistingWeek(week: string, periodType: TimesheetPeriodType, existingWeekEnd: string | null) {
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
            body: JSON.stringify({ buildingId: b.id, weekStart: week, weekEnd: existingWeekEnd ?? undefined, periodType }),
          });
          if (!res.ok) throw new Error(`Could not load the timesheet for ${b.nome}`);
          return (await res.json()) as TimesheetDTO;
        })
      );
      // Promise.all preserva a ordem de profile.buildings (já vem em
      // teamOrder, igual /my e /teams/[id] — ver /api/my/buildings) — NÃO
      // reordenar por nome aqui, senão diverge da ordem que o time leader
      // configurou.
      liveRows.current = {};
      setTimesheets(created);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Começa uma quinzenal nova — em branco, ou copiando (só a forma das
  // linhas, nunca os horários) a quinzenal anterior de cada prédio. `end` é
  // a data que o Team Leader escolheu no campo "End date" — o período fica
  // com essa duração exata, não mais travado em 10 dias úteis.
  async function startNewFortnight(week: string, end: string, copyPrior: boolean) {
    if (!profile) return;
    // Quinzena de verdade = 14 dias corridos (contando sábado/domingo), não
    // só dias úteis — barra aqui em vez de deixar criar um período mais
    // curto sem querer.
    if (allDaysInRange(week, end).length < 14) {
      alert(t("A fortnight must be at least 14 days (including weekends). Please adjust the end date."));
      return;
    }
    setLoading(true);
    setError(null);
    setPendingChoice(false);
    try {
      const created = await Promise.all(
        profile.buildings.map(async (b) => {
          const res = await fetch("/api/timesheets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ buildingId: b.id, weekStart: week, weekEnd: end, periodType: "biweekly" }),
          });
          if (!res.ok) throw new Error(`Could not load the timesheet for ${b.nome}`);
          let ts = (await res.json()) as TimesheetDTO;

          if (copyPrior) {
            const source = findPriorFortnightSource(b.id, week);
            if (source) {
              const cloned = cloneRowsZeroed(source.entries, "biweekly", week, end);
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
      // Mesmo motivo do loadExistingWeek acima: manter a ordem de
      // profile.buildings (teamOrder), não reordenar por nome.
      liveRows.current = {};
      setTimesheets(created);
      setExistingWeeks((prev) => {
        if (prev.some((w) => w.weekStart === week)) return prev;
        const next: ExistingPeriod = { weekStart: week, weekEnd: end, periodType: "biweekly" };
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
    skipAutoMatch.current = false;
    // Fim de semana empurra pra segunda; qualquer dia útil vale como início.
    // Não mexe mais em weekEnd aqui — antes recalculava uma sugestão (10 dias
    // úteis) toda vez que o início mudava, o que sobrescrevia sem avisar uma
    // data final que o Team Leader já tivesse ajustado. Agora início e fim
    // são dois campos totalmente independentes; se essa data já cair dentro
    // de um período existente, o efeito acima carrega o fim real assim que
    // encontra.
    setWeekStart(snapToWorkingDay(dateStr));
  }

  function changeWeekEnd(dateStr: string) {
    if (!dateStr) return;
    setWeekEnd(dateStr);
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
  const priorSource =
    priorSources && priorSources.length > 0
      ? priorSources.slice().sort((a, b) => b.fortnightStart.localeCompare(a.fortnightStart))[0]
      : null;
  const priorFortnightStart = priorSource?.fortnightStart ?? null;

  // Só deixa o fim livre enquanto ainda não existe período pra essa data —
  // uma vez lançado, início e fim ficam fixos (igual weekStart já era).
  const endEditable = pendingChoice;
  // Conta dias corridos (seg a dom), não dias úteis — a folha em si
  // continua só seg-sex (getTimesheetDates), isso aqui é só o texto de apoio
  // ao lado do seletor de datas.
  const dayCount = allDaysInRange(weekStart, weekEnd).length;

  return (
    <div>
      {/* Uma vez enviada, a tela vira só um preview do que foi mandado — sem
          seletor de data, sem "abrir outra quinzena", sem botão de enviar.
          Pra ver outra semana, volta pra lista em /my/timesheets. */}
      {!anySubmitted && (
        <div className="mb-6 space-y-3 print:hidden">
          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end sm:gap-4">
            <label className="flex flex-col gap-1 text-xs font-medium text-ink/60">
              {t("Start date")}
              <input
                type="date"
                value={weekStart}
                onChange={(e) => changeWeek(e.target.value)}
                className="w-full rounded-md border border-line px-3 py-2 text-base outline-none focus:border-petrol sm:w-auto sm:py-1.5 sm:text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-ink/60">
              {t("End date")}
              <input
                type="date"
                value={weekEnd}
                min={weekStart}
                disabled={!endEditable}
                onChange={(e) => changeWeekEnd(e.target.value)}
                className="w-full rounded-md border border-line px-3 py-2 text-base outline-none focus:border-petrol disabled:bg-surface disabled:text-ink/40 sm:w-auto sm:py-1.5 sm:text-sm"
              />
            </label>
            <span className="pb-2 text-sm text-ink/40 sm:pb-1.5">
              ({dayCount} {t("days")})
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {allDraft && periodType === "biweekly" && (
              <button
                type="button"
                onClick={sendToSupervisor}
                disabled={sending}
                className="ml-auto flex items-center gap-2 rounded-md bg-petrol px-4 py-2 text-sm font-medium text-white hover:bg-petrolDark disabled:opacity-50"
              >
                <Send size={16} />
                {sending ? t("Sending...") : t("Send to supervisor")}
              </button>
            )}
          </div>
        </div>
      )}

      {error && <p className="mb-4 text-sm text-danger print:hidden">{t(error)}</p>}

      {pendingChoice && (
        <div className="mb-6 rounded-md border border-dashed border-line bg-surface px-4 py-8 text-center print:hidden">
          <p className="text-sm text-ink/60">
            {t("No fortnight logged for")} {formatPeriodRange(weekStart, weekEnd, "biweekly")} {t("yet.")}
          </p>

          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => startNewFortnight(weekStart, weekEnd, false)}
              className="flex items-center gap-2 rounded-md bg-petrol px-4 py-2 text-sm font-medium text-white hover:bg-petrolDark"
            >
              <FilePlus size={16} />
              {t("Start blank")}
            </button>
            {priorFortnightStart && (
              <button
                type="button"
                onClick={() => startNewFortnight(weekStart, weekEnd, true)}
                className="flex items-center gap-2 rounded-md border border-line px-4 py-2 text-sm font-medium text-ink hover:border-petrol hover:text-petrol"
              >
                <Copy size={16} />
                {t("Copy from previous fortnight")} ({formatPeriodRange(priorFortnightStart, priorSource?.fortnightEnd ?? null, "biweekly")})
              </button>
            )}
          </div>
        </div>
      )}

      {loading && <p className="text-sm text-ink/40 print:hidden">{t("Loading...")}</p>}

      {!pendingChoice && !loading && timesheets.length > 0 && (
        <>
          {anySubmitted && (
            <div className="mb-4 rounded-md border border-line bg-surface px-4 py-3 text-sm text-ink/70 print:hidden">
              {t("Sent to the supervisor — the forecast is locked. Changes during the fortnight go in an")}{" "}
              <a href="/my/timesheets" className="text-petrol underline">
                {t("adjustment report")}
              </a>
              .
            </div>
          )}

          <CombinedTimesheetEditor
            // Não puxa mais automático do time (TeamLeader/Team.leaders) —
            // o campo na folha fica em branco até o Team Leader digitar o
            // próprio nome (ver CombinedTimesheetEditor, salvo por folha).
            teamLeaderNome={null}
            timesheets={timesheets}
            onChanged={updateOne}
            onRowsChange={handleRowsChange}
            printable={false}
          />
        </>
      )}
    </div>
  );
}
