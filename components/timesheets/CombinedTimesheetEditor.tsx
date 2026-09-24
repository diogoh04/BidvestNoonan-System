"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Printer, Plus, X, Wand2 } from "lucide-react";
import {
  getTimesheetDates,
  timesheetDayLabel,
  type TimesheetDTO,
  type TimesheetRow,
  type TimesheetPeriodType,
} from "@/lib/types";
import {
  formatPeriodRange,
  formatDDMM,
  timesheetDayOffset,
  fortnightWorkingDays,
  weekdayShort,
  toISODate,
} from "@/lib/week";
import StaffSearchInput from "@/components/StaffSearchInput";
import { fetchSheetOverrides, indexSheetOverrides, saveSheetOverride } from "@/lib/timesheetSheetOverrides";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const ESTATES_EVENTS_WO = "515736";
const MIN_COVER_ROWS = 7;
const EMPTY_DAY: DayValue = { in: null, out: null };
// Coluna vazia entre a sexta da semana 1 e a segunda da semana 2, só na
// quinzenal — sem borda/conteúdo, só pra separar visualmente as semanas.
const SPACER_CLASS = "w-2 border-0 bg-white p-0 print:bg-transparent";

// Tabela fixa horas semanais → sign in/out — usada pelo botão "Auto-fill
// hours" (ver autoFillHours abaixo). De propósito é só isso, sem fórmula
// genérica pra outros valores: quem tiver uma carga fora daqui fica de fora
// do preenchimento automático (decisão do usuário, não é um bug).
// Formato "H" pra hora cheia (sem zero à esquerda nem ":00") e "H:MM" só
// quando tem minuto quebrado (ex.: "9:30") — decisão do usuário.
const HOURS_SIGN_TIMES: Record<number, { in: string; out: string }> = {
  20: { in: "6", out: "10" },
  15: { in: "6", out: "9" },
  10: { in: "6", out: "8" },
};

const STATUS_LABEL: Record<TimesheetDTO["status"], string> = {
  draft: "Draft",
  submitted: "Submitted",
  done: "Done",
};

const STATUS_CLASS: Record<TimesheetDTO["status"], string> = {
  draft: "bg-surface text-ink/60",
  submitted: "bg-amber-50 text-amber-700",
  done: "bg-green-50 text-success",
};

function emptyDays(periodType: TimesheetPeriodType, weekStart?: string, weekEnd?: string | null): TimesheetRow["days"] {
  return Object.fromEntries(getTimesheetDates(weekStart ?? "", weekEnd ?? null, periodType).map((d) => [d, { in: null, out: null }]));
}

// Na tela, tamanho fixo e confortável pra usar no celular (a tabela rola
// na horizontal em vez de encolher) — text-base (16px) evita o zoom
// automático do Safari/iOS ao tocar num input de hora e é mais fácil de
// mirar com o dedo. Na impressão, encolhe conforme o número de linhas pra
// caber numa página só — daí os pares de classe base + print:.
function frontTableSizing(rowCount: number) {
  if (rowCount <= 10) return { text: "text-base print:text-xs", pad: "p-1.5 print:p-1", cellH: "h-11 print:h-8" };
  if (rowCount <= 16) return { text: "text-base print:text-[10px]", pad: "p-1.5 print:p-0.5", cellH: "h-11 print:h-6" };
  if (rowCount <= 24) return { text: "text-base print:text-[9px]", pad: "p-1.5 print:p-0.5", cellH: "h-11 print:h-5" };
  if (rowCount <= 32) return { text: "text-base print:text-[8px]", pad: "p-1.5 print:p-[2px]", cellH: "h-11 print:h-4" };
  if (rowCount <= 45) return { text: "text-base print:text-[7px]", pad: "p-1.5 print:p-px", cellH: "h-11 print:h-3" };
  return { text: "text-base print:text-[6px]", pad: "p-1.5 print:p-0", cellH: "h-11 print:h-3" };
}

function backTableSizing(rowCount: number) {
  if (rowCount <= 19) return { text: "text-base print:text-[10px]", pad: "p-1 print:p-0.5", cellH: "h-10 print:h-6" };
  if (rowCount <= 24) return { text: "text-base print:text-[9px]", pad: "p-1 print:p-[2px]", cellH: "h-10 print:h-5" };
  if (rowCount <= 32) return { text: "text-base print:text-[8px]", pad: "p-1 print:p-0", cellH: "h-10 print:h-4" };
  return { text: "text-base print:text-[7px]", pad: "p-1 print:p-0", cellH: "h-10 print:h-3" };
}

// Larguras (%) das colunas fixas (Building/Hours/WO/Name/Staff Number) do
// colgroup. Quanto mais colunas de dia (folha de duração livre — ver
// getTimesheetDates), menos espaço sobra pra elas — reduz as fixas
// proporcionalmente, senão os dias ficam minúsculos. Fórmula interpolada
// nos dois pontos calibrados visualmente antes desta folha ter duração
// livre: 5 dias (semanal) → fator 1; 10 dias (quinzenal de sempre) → fator
// 2/3. Fora desses dois pontos é extrapolação — vale conferir visualmente
// pra períodos bem curtos (poucos dias) ou bem longos.
function scaleFixedCols(pct: number[], dayCount: number): number[] {
  const factor = Math.max(0.4, 1 - (dayCount - 5) / 15);
  return pct.map((p) => p * factor);
}

// As colunas do colgroup são em % — numa tabela `w-full` isso sempre cabe na
// tela, só que espremendo cada coluna até o texto vazar por cima da vizinha.
// O que faz a tabela realmente rolar de lado em vez de espremer é ter uma
// largura MÍNIMA em px maior que a tela — as % do colgroup passam a
// distribuir espaço dentro desse mínimo, não mais dentro da tela toda. Só
// conta pra tela: no print a classe `ts-table` zera esse mínimo (ver
// <style jsx global> no fim do arquivo).
// Hours e WO ganharam mais espaço (60→70 / 60→80) porque um WO de 6 dígitos
// ("514161") ou o cabeçalho "Xh total" não cabiam — vinha de Name (150→130 /
// 130→110), que sobrava de longe.
const FRONT_FIXED_MIN_PX = [60, 70, 80, 130, 90]; // Building, Hours, WO, Name, Staff Number
const BACK_FIXED_MIN_PX = [80, 70, 80, 110, 90]; // Building Covers, Hours, WO, Name, Staff Number
const DAY_COL_MIN_PX = 120; // célula com IN+OUT lado a lado, ~60px cada - "06:00" (5 char) não cabia em 48px
const SPACER_MIN_PX = 8;

function minTableWidthPx(fixedPx: number[], dayCount: number, spacerCount: number): number {
  return fixedPx.reduce((a, b) => a + b, 0) + dayCount * DAY_COL_MIN_PX + spacerCount * SPACER_MIN_PX;
}

function BlankRow({
  n,
  cell,
  signCell,
  textClass,
  days,
  spacerAfter,
}: {
  n: number;
  cell: string;
  signCell: string;
  textClass: string;
  days: readonly string[];
  spacerAfter: Set<number>;
}) {
  return (
    <>
      {Array.from({ length: n }).map((_, i) => (
        <tr key={"blank-" + i}>
          <td className={signCell}></td>
          <td className={cell}></td>
          <td className={cell}></td>
          <td className={cell}></td>
          <td className={cell}></td>
          {days.map((d, di) => (
            <>
              <td key={d} className={signCell} colSpan={1}></td>
              {spacerAfter.has(di) && <td key={d + "-spacer"} className={SPACER_CLASS}></td>}
            </>
          ))}
        </tr>
      ))}
    </>
  );
}

type DayValue = { in: string | null; out: string | null };

// Componente de módulo (fora do pai) de propósito: se fosse declarado
// dentro de CombinedTimesheetEditor, a cada tecla digitada o React recebe
// uma função de componente NOVA (recriada no render) e trata o <input>
// como um elemento diferente — desmonta e remonta o DOM, perdendo o foco
// depois de cada caractere. Aqui ele recebe só o valor + callbacks, sem
// fechar sobre o state do pai, então a identidade do componente é estável
// entre renders e o input mantém o foco.
function SignCell({
  value,
  editable,
  onChangeIn,
  onChangeOut,
  className,
  textClass,
}: {
  value: DayValue;
  editable: boolean;
  onChangeIn: (v: string) => void;
  onChangeOut: (v: string) => void;
  className: string;
  textClass: string;
}) {
  return (
    <td className={className}>
      <div className="flex h-full items-stretch justify-center">
        <input
          value={value.in ?? ""}
          onChange={(e) => onChangeIn(e.target.value)}
          disabled={!editable}
          maxLength={5}
          className={`h-full w-1/2 border-0 border-r border-ink/40 bg-transparent p-0 text-center leading-none text-inherit outline-none focus:bg-petrolLight disabled:text-ink/60 ${textClass}`}
        />
        <input
          value={value.out ?? ""}
          onChange={(e) => onChangeOut(e.target.value)}
          disabled={!editable}
          maxLength={5}
          className={`h-full w-1/2 border-0 bg-transparent p-0 text-center leading-none text-inherit outline-none focus:bg-petrolLight disabled:text-ink/60 ${textClass}`}
        />
      </div>
    </td>
  );
}

export default function CombinedTimesheetEditor({
  teamLeaderNome,
  timesheets,
  onChanged,
  onRowsChange,
  readOnly = false,
  preview = false,
  printable = true,
}: {
  teamLeaderNome: string | null;
  timesheets: TimesheetDTO[];
  onChanged: (t: TimesheetDTO) => void;
  // Disparado SÍNCRONO a cada edição (antes do auto-save chegar ao servidor)
  // — deixa o pai (LancarClient) com as linhas mais recentes pra "Send to
  // supervisor" não perder a última tecla digitada.
  onRowsChange?: (timesheetId: string, rows: TimesheetRow[]) => void;
  readOnly?: boolean;
  // true só em /my/preview — versão enxuta pra só olhar quem está no prédio
  // hoje: esconde status/auto-fill/print (topo), FORTNIGHT+legenda+Team
  // Leader e a página de verso (covers) — nada disso importa pra essa
  // pergunta específica ("quem tá alocado"), e como não é uma folha real
  // (não tem semana, não foi enviada), mostrar esses campos só confundiria.
  preview?: boolean;
  // false nas telas do Team Leader (Log timesheet / quinzenal / preview) —
  // impressão oficial acontece só pelo lado do Master, em /timesheets (ver
  // TimesheetView/LeaderTimesheetView). Só esconde o botão "Print / Export
  // PDF"; as classes print:* continuam no JSX (inofensivas — nunca disparam
  // sem alguém chamar window.print()) porque são as MESMAS usadas pelo lado
  // do Master/Supervisor (review), então não dá pra remover só daqui.
  printable?: boolean;
}) {
  // Apelidado `tr` (não `t`) porque `t` já é o nome-padrão da variável de
  // timesheet neste arquivo inteiro (`timesheets.map((t) => ...)`) — usar
  // `t` aqui sombrearia a função de tradução dentro de cada callback.
  const { t: tr } = useLanguage();
  const [rowsByTimesheet, setRowsByTimesheet] = useState<Record<string, TimesheetRow[]>>({});
  const [error, setError] = useState<string | null>(null);
  const saveTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Modo edição: permite personalizar o nome do prédio (topo) e, por linha,
  // o nome do prédio + WO — só nesta folha. Salvo numa tabela separada
  // (TimesheetSheetOverride, via /api/timesheet-overrides), uma por
  // Timesheet (prédio+semana) — nunca escreve em Building/Team, então
  // editar aqui nunca altera o cadastro.
  // Edição do nome do prédio/WO por linha na folha impressa foi removida —
  // a folha é a previsão, sem personalização. Constante pra manter os
  // caminhos de render que checam editMode (sempre no ramo de leitura).
  const editMode = false;
  const [headerNome, setHeaderNome] = useState(() => timesheets.map((t) => t.buildingNome).join(", "));
  // Nome digitado à mão pelo Team Leader (ver pedido: parar de puxar
  // automaticamente de TeamLeader/Team.leaders — cada folha guarda o seu
  // próprio, salvo junto do override "header", igual o nome do prédio).
  const [teamLeaderNomeInput, setTeamLeaderNomeInput] = useState(teamLeaderNome ?? "");
  const [rowOverrides, setRowOverrides] = useState<Record<string, { nomePredio: string; wo: string }>>({});
  const [coverOverrides, setCoverOverrides] = useState<Record<string, { nomePredio: string; wo: string }>>({});
  const overrideSaveTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  function scheduleSaveOverride(
    debounceKey: string,
    subjectId: string,
    scope: string,
    value: { nomePredio: string; wo: string; teamLeaderNome?: string }
  ) {
    if (overrideSaveTimeouts.current[debounceKey]) clearTimeout(overrideSaveTimeouts.current[debounceKey]);
    overrideSaveTimeouts.current[debounceKey] = setTimeout(() => {
      saveSheetOverride("timesheet", subjectId, scope, value);
    }, 500);
  }
  function scheduleSaveHeader(value: { nomePredio: string; wo: string; teamLeaderNome?: string }) {
    const firstId = timesheets[0]?.id;
    if (!firstId) return;
    scheduleSaveOverride("header", firstId, "header", value);
  }

  // Carrega as personalizações salvas (se houver) assim que a folha abre.
  useEffect(() => {
    (async () => {
      const ids = timesheets.map((t) => t.id);
      const overrides = indexSheetOverrides(await fetchSheetOverrides("timesheet", ids));

      const firstId = timesheets[0]?.id;
      if (firstId) {
        const header = overrides[`${firstId}:header`];
        if (header) {
          setHeaderNome(header.nomePredio ?? timesheets.map((t) => t.buildingNome).join(", "));
          if (header.teamLeaderNome != null) setTeamLeaderNomeInput(header.teamLeaderNome);
        }
      }

      setRowOverrides((prev) => {
        const next = { ...prev };
        timesheets.forEach((t) => {
          const tRows = t.entries.rows.filter((r) => r.kind !== "cover");
          tRows.forEach((_, i) => {
            const r = overrides[`${t.id}:row:${i}`];
            if (r) next[`${t.id}:${i}`] = { nomePredio: r.nomePredio ?? t.buildingNome, wo: r.workOrder ?? t.buildingWorkOrder ?? "" };
          });
        });
        return next;
      });

      setCoverOverrides((prev) => {
        const next = { ...prev };
        timesheets.forEach((t) => {
          t.entries.rows.forEach((row, idx) => {
            if (row.kind !== "cover") return;
            const r = overrides[`${t.id}:cover:${idx}`];
            if (r) next[`${t.id}:${idx}`] = { nomePredio: r.nomePredio ?? t.buildingNome, wo: r.workOrder ?? t.buildingWorkOrder ?? "" };
          });
        });
        return next;
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })();
  }, [timesheets.map((t) => t.id).join(",")]);

  const [coverTimesheetId, setCoverTimesheetId] = useState(timesheets[0]?.id ?? "");
  const [coverNome, setCoverNome] = useState("");
  const [coverStaffNumber, setCoverStaffNumber] = useState("");
  const [coverHoras, setCoverHoras] = useState("");
  const [savingCover, setSavingCover] = useState(false);

  useEffect(() => {
    setRowsByTimesheet(Object.fromEntries(timesheets.map((t) => [t.id, t.entries.rows])));
    setCoverTimesheetId((prev) => (timesheets.some((t) => t.id === prev) ? prev : timesheets[0]?.id ?? ""));
  }, [timesheets.map((t) => t.id).join(",")]);

  // A previsão só é editável enquanto `draft` — depois de enviada congela (as
  // mudanças do meio da quinzena viram AdjustmentReport). O supervisor sempre
  // recebe readOnly=true.
  function isEditable(t: TimesheetDTO) {
    return !readOnly && t.status === "draft";
  }

  function scheduleSave(timesheetId: string, nextRows: TimesheetRow[]) {
    setRowsByTimesheet((prev) => ({ ...prev, [timesheetId]: nextRows }));
    onRowsChange?.(timesheetId, nextRows);
    if (saveTimeouts.current[timesheetId]) clearTimeout(saveTimeouts.current[timesheetId]);
    saveTimeouts.current[timesheetId] = setTimeout(() => save(timesheetId, nextRows), 500);
  }

  async function save(timesheetId: string, nextRows: TimesheetRow[]) {
    setError(null);
    try {
      const res = await fetch(`/api/timesheets/${timesheetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: { rows: nextRows } }),
      });
      if (!res.ok) throw new Error("Could not save");
      const updated = await res.json();
      onChanged(updated);
    } catch (e: any) {
      setError(e.message);
    }
  }

  function updateCell(
    timesheetId: string,
    rowIndex: number,
    day: string,
    field: "in" | "out",
    value: string
  ) {
    const rows = rowsByTimesheet[timesheetId] ?? [];
    const next = rows.map((r, i) =>
      i === rowIndex ? { ...r, days: { ...r.days, [day]: { ...r.days[day], [field]: value || null } } } : r
    );
    scheduleSave(timesheetId, next);
  }

  // Botão "Auto-fill hours": preenche entrada/saída de todo staff cuja carga
  // horária bate com HOURS_SIGN_TIMES, em todos os dias do período — só nas
  // células ainda vazias (nunca sobrescreve o que o Team Leader já digitou).
  // Cover/openSlot ficam de fora (só kind === "staff"). Um scheduleSave por
  // timesheet, não por célula, pra não disparar dezenas de saves em série.
  function autoFillHours() {
    timesheets.forEach((t) => {
      if (!isEditable(t)) return;
      const rows = rowsByTimesheet[t.id] ?? [];
      let changed = false;
      const next = rows.map((r) => {
        if (r.kind !== "staff" || r.horas == null) return r;
        const times = HOURS_SIGN_TIMES[r.horas];
        if (!times) return r;
        const nextDays = { ...r.days };
        for (const d of DAYS) {
          const cur = r.days[d] ?? EMPTY_DAY;
          const filled = { in: cur.in || times.in, out: cur.out || times.out };
          if (filled.in !== cur.in || filled.out !== cur.out) {
            nextDays[d] = filled;
            changed = true;
          }
        }
        return { ...r, days: nextDays };
      });
      if (changed) scheduleSave(t.id, next);
    });
  }

  async function addCover() {
    if (!coverNome.trim() || !coverTimesheetId) return;
    setSavingCover(true);
    try {
      const row: TimesheetRow = {
        kind: "cover",
        refId: null,
        nome: coverNome.trim(),
        staffNumber: coverStaffNumber.trim() || null,
        horas: coverHoras.trim() === "" ? null : Number(coverHoras.replace(",", ".")),
        days: emptyDays(periodType, weekStart, weekEnd),
      };
      const rows = rowsByTimesheet[coverTimesheetId] ?? [];
      const next = [...rows, row];
      setRowsByTimesheet((prev) => ({ ...prev, [coverTimesheetId]: next }));
      onRowsChange?.(coverTimesheetId, next);
      await save(coverTimesheetId, next);
      setCoverNome("");
      setCoverStaffNumber("");
      setCoverHoras("");
    } finally {
      setSavingCover(false);
    }
  }

  function removeCover(timesheetId: string, rowIndex: number) {
    const rows = rowsByTimesheet[timesheetId] ?? [];
    scheduleSave(
      timesheetId,
      rows.filter((_, i) => i !== rowIndex)
    );
  }

  // Os prédios de um mesmo lote (mesmo Team Leader, mesma semana) sempre
  // compartilham o período — basta olhar o primeiro.
  const periodType: TimesheetPeriodType = timesheets[0]?.periodType ?? "weekly";
  const weekStart = timesheets[0]?.weekStart;
  const weekEnd = timesheets[0]?.weekEnd ?? null;
  const DAYS = weekStart ? getTimesheetDates(weekStart, weekEnd, periodType) : getTimesheetDates("", null, periodType);

  // Datas reais de cada coluna, pra data+dia da semana no cabeçalho e pra
  // achar onde entra o espaçador visual (todo pulo de mais de 1 dia no
  // calendário = fim de semana/feriado no meio do período — pode acontecer
  // mais de uma vez numa folha de duração livre, ver getTimesheetDates em
  // lib/types.ts). `weekEnd` presente → DAYS já É a lista de datas reais.
  // Sem `weekEnd` (folha antiga): quinzenal recalcula os 10 dias úteis reais
  // via fortnightWorkingDays; semanal é sempre segunda+offset direto.
  const realDates: readonly string[] | null = !weekStart
    ? null
    : weekEnd
    ? DAYS
    : periodType === "biweekly"
    ? fortnightWorkingDays(weekStart)
    : DAYS.map((_, i) => {
        const d = new Date(weekStart + "T00:00:00Z");
        d.setUTCDate(d.getUTCDate() + timesheetDayOffset(i));
        return toISODate(d);
      });

  function colDate(i: number): string {
    return realDates ? formatDDMM(realDates[i]) : "";
  }
  function colLabel(dayKey: string, i: number): string {
    return realDates ? weekdayShort(realDates[i]) : timesheetDayLabel(dayKey);
  }

  const spacerAfter = new Set<number>();
  if (realDates) {
    for (let i = 0; i < realDates.length - 1; i++) {
      const a = new Date(realDates[i] + "T00:00:00Z").getTime();
      const b = new Date(realDates[i + 1] + "T00:00:00Z").getTime();
      if ((b - a) / 86400000 > 1) spacerAfter.add(i);
    }
  } else if (periodType === "biweekly") {
    // Sem nenhuma data real pra calcular o pulo (não deveria acontecer na
    // prática) — mantém a regra fixa de sempre como fallback de segurança.
    spacerAfter.add(4);
  }
  const spacerCount = spacerAfter.size;
  const frontMinWidthPx = minTableWidthPx(FRONT_FIXED_MIN_PX, DAYS.length, spacerCount);
  const backMinWidthPx = minTableWidthPx(BACK_FIXED_MIN_PX, DAYS.length, spacerCount);

  const totalFrontRows = timesheets.reduce((sum, t) => {
    const rows = (rowsByTimesheet[t.id] ?? t.entries.rows).filter((r) => r.kind !== "cover");
    return sum + Math.max(rows.length, 1);
  }, 0);
  const grandTotalHours = timesheets.reduce((sum, t) => {
    const rows = (rowsByTimesheet[t.id] ?? t.entries.rows).filter((r) => r.kind !== "cover");
    return sum + rows.reduce((s, r) => s + (r.horas ?? 0), 0);
  }, 0);
  const sz = frontTableSizing(totalFrontRows);
  const cell = `border border-ink ${sz.pad}`;
  const signCell = `border border-ink ${sz.pad} ${sz.cellH}`;

  const coversFlat = timesheets.flatMap((t) =>
    (rowsByTimesheet[t.id] ?? t.entries.rows)
      .map((r, i) => ({ t, row: r, rowIndex: i }))
      .filter((x) => x.row.kind === "cover")
  );
  const coverItems = timesheets.map((t) => `${t.buildingNome} - WO ${t.buildingWorkOrder ?? "—"}`);
  const backRowCount = coversFlat.length + Math.max(MIN_COVER_ROWS - coversFlat.length, 1) + 12;
  const backSz = backTableSizing(backRowCount);
  const backCell = `border border-ink ${backSz.pad}`;
  const backSignCell = `border border-ink ${backSz.pad} ${backSz.cellH}`;

  const anyEditable = timesheets.some(isEditable);

  return (
    <div className="bg-white print:px-8 print:py-4">
      {!preview && (
        <div className="mb-6 flex items-center justify-between gap-3 print:hidden">
          <div className="flex flex-wrap gap-2">
            {timesheets.map((t) => (
              <span key={t.id} className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_CLASS[t.status]}`}>
                {t.buildingNome}: {tr(STATUS_LABEL[t.status])}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {timesheets.some((t) => isEditable(t)) && (
              <button
                onClick={autoFillHours}
                className="flex items-center gap-2 rounded-md border border-line px-4 py-2 text-sm font-medium text-ink hover:border-petrol hover:text-petrol"
              >
                <Wand2 size={16} />
                {tr("Auto-fill hours")}
              </button>
            )}
            {printable && (
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 rounded-md bg-petrol px-4 py-2 text-sm font-medium text-white hover:bg-petrolDark"
              >
                <Printer size={16} />
                {tr("Print / Export PDF")}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 border-b-2 border-ink pb-3 sm:grid sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-6 print:grid print:grid-cols-[auto_1fr_auto] print:items-center print:gap-6 print:pb-1">
        <div className="flex items-center justify-between gap-3 sm:contents print:contents">
          <Image src="/logo.jpg" alt="Bidvest Noonan" width={160} height={50} className="h-10 w-auto shrink-0 object-contain print:h-6" />
          <h1 className="text-right font-display text-sm font-bold uppercase tracking-wide text-ink sm:text-center sm:text-xl print:text-sm">
            Sign In &amp; Sign Out Book
          </h1>
        </div>
        {/* Linha própria no celular — junto com logo+título, o nome do
            prédio (que pode ser bem comprido) não cabia numa coluna só e
            estourava a tela; numa linha dedicada, ele quebra pro logo da UCD
            ir pra baixo em vez de vazar horizontalmente. */}
        <div className="flex min-w-0 flex-wrap items-center gap-3 sm:flex-nowrap sm:gap-6 print:flex-nowrap print:gap-6">
          {/* Sempre editável (não precisa clicar em "Edit") — só o nome, não
              mexe no resto da folha. */}
          <input
            type="text"
            value={headerNome}
            onChange={(e) => {
              setHeaderNome(e.target.value);
              scheduleSaveHeader({ nomePredio: e.target.value, wo: "" });
            }}
            size={Math.max(headerNome.length, 1)}
            className="min-w-0 max-w-full flex-1 border-0 bg-transparent font-display text-lg font-bold text-ink outline-none focus:bg-petrolLight print:text-xs"
          />
          <Image src="/logoUCD.png" alt="Client logo" width={56} height={56} className="h-14 w-14 shrink-0 object-contain print:h-6 print:w-6" />
        </div>
      </div>

      {!preview && (
      <>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4 text-sm print:mt-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-ink">{periodType === "biweekly" ? "FORTNIGHT" : "WEEK"}</span>
          <span className="border-b border-ink px-2">
            {weekStart ? formatPeriodRange(weekStart, weekEnd, periodType) : "—"}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-x-6 gap-y-1 text-xs print:grid-cols-7 print:gap-x-2 print:gap-y-0 print:text-[7px]">
          <span><strong>HP</strong> - Holiday Paid</span>
          <span><strong>AA</strong> - Absent Autorized</span>
          <span><strong>S</strong> - Sick</span>
          <span><strong>HU</strong> - Holiday Unpaid</span>
          <span><strong>AU</strong> - Absent Unautorized</span>
          <span><strong>BH</strong> - Bank Holiday</span>
          <span className="col-span-3 print:col-span-1"><strong>P45</strong> - Leaving</span>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-sm print:mt-1">
        <span className="font-medium text-ink">Team Leader</span>
        {readOnly ? (
          <span className="inline-block min-w-[220px] border-b border-ink px-2">{teamLeaderNomeInput || " "}</span>
        ) : (
          <input
            type="text"
            value={teamLeaderNomeInput}
            onChange={(e) => {
              setTeamLeaderNomeInput(e.target.value);
              scheduleSaveHeader({ nomePredio: headerNome, wo: "", teamLeaderNome: e.target.value });
            }}
            placeholder={tr("Type the Team Leader's name")}
            className="min-w-[220px] flex-1 border-0 border-b border-ink bg-transparent px-2 text-ink outline-none focus:bg-petrolLight print:text-xs"
          />
        )}
      </div>
      </>
      )}

      <p className="mt-4 text-xs text-ink/40 sm:hidden print:hidden">{tr("Swipe the table sideways to see all days →")}</p>

      <div className="mt-2 -mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0 print:mx-0 print:overflow-visible print:px-0">
      <table
        className={`ts-table w-full table-fixed border-collapse print:mt-2 ${sz.text}`}
        style={{ minWidth: `${frontMinWidthPx}px` }}
      >
        <colgroup>
          {scaleFixedCols([9, 6, 9, 18, 9], DAYS.length).map((w, i) => (
            <col key={i} style={{ width: `${w}%` }} />
          ))}
          {DAYS.map((d, i) => (
            <>
              <col key={d + "-col"} />
              {spacerAfter.has(i) && <col key={d + "-spacer-col"} className="w-2" />}
            </>
          ))}
        </colgroup>
        <thead>
          <tr>
            <th rowSpan={2} className={`${cell} align-middle`}>Building</th>
            <th rowSpan={2} className={`${cell} align-middle`}>
              <span className="text-[11px] leading-tight print:text-[7px]">{grandTotalHours}h total</span>
            </th>
            <th rowSpan={2} className={`${cell} align-middle`}>WO</th>
            <th rowSpan={2} className={`${cell} align-middle`}>Name</th>
            <th rowSpan={2} className={`${cell} align-middle`}>Staff Number</th>
            {DAYS.map((d, i) => (
              <>
                <th key={d} className={`${cell} text-center`}>
                  <div className="flex flex-col items-center leading-tight">
                    {weekStart && <span className="font-normal text-ink/50">{colDate(i)}</span>}
                    <span>{colLabel(d, i)}</span>
                  </div>
                </th>
                {spacerAfter.has(i) && <th key={d + "-spacer"} className={SPACER_CLASS}></th>}
              </>
            ))}
          </tr>
          <tr>
            {DAYS.map((d, i) => (
              <>
                <th key={d} className={`${cell} p-0 text-center font-normal`}>
                  <div className="flex items-stretch justify-center">
                    <span className="w-1/2 border-r border-ink/40 py-0.5">IN</span>
                    <span className="w-1/2 py-0.5">OUT</span>
                  </div>
                </th>
                {spacerAfter.has(i) && <th key={d + "-spacer2"} className={SPACER_CLASS}></th>}
              </>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={5 + DAYS.length + spacerCount} className="h-3 border-0"></td>
          </tr>
          {timesheets.length === 0 && (
            <tr>
              <td colSpan={5 + DAYS.length + spacerCount} className={`${cell} text-center text-ink/40`}>
                No building assigned to you.
              </td>
            </tr>
          )}
          {timesheets.map((t, buildingIndex) => {
            const rows = (rowsByTimesheet[t.id] ?? t.entries.rows).filter((r) => r.kind !== "cover");
            const allRows = rowsByTimesheet[t.id] ?? t.entries.rows;
            const spacerRow =
              buildingIndex > 0 ? (
                <tr key={t.id + "-spacer"}>
                  <td colSpan={5 + DAYS.length + spacerCount} className="h-3 border-0"></td>
                </tr>
              ) : null;

            if (rows.length === 0) {
              const emptyKey = `${t.id}:empty`;
              return (
                <>
                  {spacerRow}
                  <tr key={t.id}>
                    <td className={`${cell} text-center font-medium`}>
                      {editMode ? (
                        <input
                          type="text"
                          value={rowOverrides[emptyKey]?.nomePredio ?? t.buildingNome}
                          onChange={(e) => {
                            const next = {
                              nomePredio: e.target.value,
                              wo: rowOverrides[emptyKey]?.wo ?? t.buildingWorkOrder ?? "",
                            };
                            setRowOverrides((prev) => ({ ...prev, [emptyKey]: next }));
                            scheduleSaveOverride(emptyKey, t.id, "empty", next);
                          }}
                          className="w-full min-w-0 border-0 bg-transparent p-0 text-center outline-none focus:bg-petrolLight"
                        />
                      ) : (
                        rowOverrides[emptyKey]?.nomePredio ?? t.buildingNome
                      )}
                    </td>
                    <td className={cell}></td>
                    <td className={`${cell} text-center`}>
                      {editMode ? (
                        <input
                          type="text"
                          value={rowOverrides[emptyKey]?.wo ?? t.buildingWorkOrder ?? ""}
                          onChange={(e) => {
                            const next = {
                              nomePredio: rowOverrides[emptyKey]?.nomePredio ?? t.buildingNome,
                              wo: e.target.value,
                            };
                            setRowOverrides((prev) => ({ ...prev, [emptyKey]: next }));
                            scheduleSaveOverride(emptyKey, t.id, "empty", next);
                          }}
                          className="w-full min-w-0 border-0 bg-transparent p-0 text-center outline-none focus:bg-petrolLight"
                        />
                      ) : (
                        rowOverrides[emptyKey]?.wo ?? (t.buildingWorkOrder ?? "")
                      )}
                    </td>
                    <td className={`${cell} text-ink/30`} colSpan={2}>
                      no cleaner or slot registered
                    </td>
                    {DAYS.map((d, di) => (
                      <>
                        <td key={d} className={signCell}></td>
                        {spacerAfter.has(di) && <td key={d + "-spacer"} className={SPACER_CLASS}></td>}
                      </>
                    ))}
                  </tr>
                </>
              );
            }

            // Enquanto ninguém mexeu (ou editou igual pra todo mundo), continua
            // mesclado igual antes. Só separa de verdade quando alguma linha
            // ficou diferente das outras — assim o que foi digitado não some
            // ao sair do modo edição. `r.predioLabel`/`r.workOrder` é o rótulo
            // por pessoa ("Sheet labels" em BuildingStaffClient/StaffBuilding,
            // fotografado na criação da folha — ver lib/timesheetSnapshot.ts);
            // `rowOverrides` é o mecanismo antigo por índice de linha
            // (editMode na folha, hoje desligado) — mantido só por
            // compatibilidade com o que já foi salvo assim antes.
            const tNomes = rows.map(
              (r, i) => rowOverrides[`${t.id}:${i}`]?.nomePredio ?? (r.predioLabel?.trim() || t.buildingNome)
            );
            const buildingAllSame = tNomes.every((v) => v === tNomes[0]);
            const tWos = rows.map(
              (r, i) => rowOverrides[`${t.id}:${i}`]?.wo ?? ((r.workOrder?.trim() || t.buildingWorkOrder) ?? "")
            );
            const woAllSame = tWos.every((v) => v === tWos[0]);

            return (
              <>
                {spacerRow}
                {rows.map((r, i) => {
                  const rowIndex = allRows.indexOf(r);
                  const key = `${t.id}:${i}`;
                  return (
                    <tr key={t.id + i}>
                      {editMode ? (
                        <td className={`${cell} text-center font-bold align-middle break-words`}>
                          <input
                            type="text"
                            value={rowOverrides[key]?.nomePredio ?? t.buildingNome}
                            onChange={(e) => {
                              const next = { nomePredio: e.target.value, wo: rowOverrides[key]?.wo ?? t.buildingWorkOrder ?? "" };
                              setRowOverrides((prev) => ({ ...prev, [key]: next }));
                              scheduleSaveOverride(key, t.id, `row:${i}`, next);
                            }}
                            className="w-full min-w-0 border-0 bg-transparent p-0 text-center font-bold outline-none focus:bg-petrolLight"
                          />
                        </td>
                      ) : buildingAllSame ? (
                        i === 0 && (
                          <td rowSpan={rows.length} className={`${cell} text-center font-bold align-middle break-words`}>
                            {tNomes[0]}
                          </td>
                        )
                      ) : (
                        <td className={`${cell} text-center font-bold align-middle break-words`}>{tNomes[i]}</td>
                      )}
                      <td className={`${cell} text-center`}>{r.horas ?? ""}</td>
                      {editMode ? (
                        <td className={`${cell} text-center font-bold align-middle overflow-hidden whitespace-nowrap text-ellipsis`}>
                          <input
                            type="text"
                            value={rowOverrides[key]?.wo ?? t.buildingWorkOrder ?? ""}
                            onChange={(e) => {
                              const next = { nomePredio: rowOverrides[key]?.nomePredio ?? t.buildingNome, wo: e.target.value };
                              setRowOverrides((prev) => ({ ...prev, [key]: next }));
                              scheduleSaveOverride(key, t.id, `row:${i}`, next);
                            }}
                            className="w-full min-w-0 border-0 bg-transparent p-0 text-center font-bold outline-none focus:bg-petrolLight"
                          />
                        </td>
                      ) : woAllSame ? (
                        i === 0 && (
                          <td rowSpan={rows.length} className={`${cell} text-center font-bold align-middle overflow-hidden whitespace-nowrap text-ellipsis`}>
                            {tWos[0]}
                          </td>
                        )
                      ) : (
                        <td className={`${cell} text-center font-bold align-middle overflow-hidden whitespace-nowrap text-ellipsis`}>{tWos[i]}</td>
                      )}
                      <td className={cell}>{r.nome ?? <span className="text-ink/30">Open slot</span>}</td>
                      <td className={`${cell} text-center`}>{r.staffNumber ?? ""}</td>
                      {DAYS.map((d, di) => (
                        <>
                          <SignCell
                            key={d}
                            value={r.days[d] ?? EMPTY_DAY}
                            editable={isEditable(t)}
                            onChangeIn={(v) => updateCell(t.id, rowIndex, d, "in", v)}
                            onChangeOut={(v) => updateCell(t.id, rowIndex, d, "out", v)}
                            className={signCell}
                            textClass={sz.text}
                          />
                          {spacerAfter.has(di) && <td key={d + "-spacer"} className={SPACER_CLASS}></td>}
                        </>
                      ))}
                    </tr>
                  );
                })}
              </>
            );
          })}
        </tbody>
      </table>
      </div>

      {!preview && (
      <div className="mt-10 print:mt-0 break-before-page">
        {!readOnly && (
        <div className="mb-2 flex flex-wrap items-center gap-2 print:hidden">
          <select
            value={coverTimesheetId}
            onChange={(e) => setCoverTimesheetId(e.target.value)}
            className="rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-petrol"
          >
            {timesheets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.buildingNome}
              </option>
            ))}
          </select>
          {coverNome ? (
            <span className="flex items-center gap-1.5 rounded-md border border-petrol bg-petrolLight px-2.5 py-1.5 text-xs text-petrol">
              {coverNome} {coverStaffNumber && `#${coverStaffNumber}`}
              <button type="button" onClick={() => setCoverNome("")} className="hover:text-petrolDark">
                <X size={12} />
              </button>
            </span>
          ) : (
            <StaffSearchInput
              onSelect={(staff) => {
                setCoverNome(staff.nome);
                setCoverStaffNumber(staff.staffNumber ?? "");
              }}
              placeholder={tr("Search staff...")}
            />
          )}
          <input
            type="number"
            min={0}
            step={0.25}
            value={coverHoras}
            onChange={(e) => setCoverHoras(e.target.value)}
            placeholder={tr("Hours")}
            className="w-24 rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-petrol"
          />
          <button
            type="button"
            onClick={addCover}
            disabled={savingCover}
            className="flex items-center gap-1 rounded-md bg-petrol px-3 py-1.5 text-sm font-medium text-white hover:bg-petrolDark disabled:opacity-50"
          >
            <Plus size={14} />
            {tr("Add cover")}
          </button>
        </div>
        )}

        <p className="mb-1 text-xs text-ink/40 sm:hidden print:hidden">{tr("Swipe the table sideways to see all days →")}</p>

        <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0 print:mx-0 print:overflow-visible print:px-0">
        <table
          className={`ts-table w-full table-fixed border-collapse ${backSz.text}`}
          style={{ minWidth: `${backMinWidthPx}px` }}
        >
          <colgroup>
            {scaleFixedCols([9, 6, 9, 14, 13], DAYS.length).map((w, i) => (
              <col key={i} style={{ width: `${w}%` }} />
            ))}
            {DAYS.map((d, i) => (
              <>
                <col key={d + "-col"} />
                {spacerAfter.has(i) && <col key={d + "-spacer-col"} className="w-2" />}
              </>
            ))}
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2} className={`${backCell} align-middle`}>Building Covers</th>
              <th rowSpan={2} className={`${backCell} align-middle`}>Hours</th>
              <th rowSpan={2} className={`${backCell} align-middle`}>WO</th>
              <th rowSpan={2} className={`${backCell} align-middle`}>Name</th>
              <th rowSpan={2} className={`${backCell} align-middle`}>Staff Number</th>
              {DAYS.map((d, i) => (
                <>
                  <th key={d} className={`${backCell} text-center`}>
                    <div className="flex flex-col items-center leading-tight">
                      {weekStart && <span className="font-normal text-ink/50">{colDate(i)}</span>}
                      <span>{colLabel(d, i)}</span>
                    </div>
                  </th>
                  {spacerAfter.has(i) && <th key={d + "-spacer"} className={SPACER_CLASS}></th>}
                </>
              ))}
            </tr>
            <tr>
              {DAYS.map((d, i) => (
                <>
                  <th key={d} className={`${backCell} p-0 text-center font-normal`}>
                    <div className="flex items-stretch justify-center">
                      <span className="w-1/2 border-r border-ink/40 py-0.5">IN</span>
                      <span className="w-1/2 bg-ink/[0.035] py-0.5">OUT</span>
                    </div>
                  </th>
                  {spacerAfter.has(i) && <th key={d + "-spacer2"} className={SPACER_CLASS}></th>}
                </>
              ))}
            </tr>
          </thead>
          <tbody>
            {coversFlat.map(({ t, row, rowIndex }) => {
              const coverKey = `${t.id}:${rowIndex}`;
              return (
              <tr key={t.id + rowIndex}>
                <td className={`${backSignCell} text-center`}>
                  {editMode ? (
                    <input
                      type="text"
                      value={coverOverrides[coverKey]?.nomePredio ?? t.buildingNome}
                      onChange={(e) => {
                        const next = {
                          nomePredio: e.target.value,
                          wo: coverOverrides[coverKey]?.wo ?? t.buildingWorkOrder ?? "",
                        };
                        setCoverOverrides((prev) => ({ ...prev, [coverKey]: next }));
                        scheduleSaveOverride(coverKey, t.id, `cover:${rowIndex}`, next);
                      }}
                      className="w-full min-w-0 border-0 bg-transparent p-0 text-center outline-none focus:bg-petrolLight"
                    />
                  ) : (
                    coverOverrides[coverKey]?.nomePredio ?? t.buildingNome
                  )}
                </td>
                <td className={`${backCell} text-center`}>{row.horas ?? ""}</td>
                <td className={`${backCell} overflow-hidden whitespace-nowrap text-ellipsis text-center`}>
                  {editMode ? (
                    <input
                      type="text"
                      value={coverOverrides[coverKey]?.wo ?? t.buildingWorkOrder ?? ""}
                      onChange={(e) => {
                        const next = {
                          nomePredio: coverOverrides[coverKey]?.nomePredio ?? t.buildingNome,
                          wo: e.target.value,
                        };
                        setCoverOverrides((prev) => ({ ...prev, [coverKey]: next }));
                        scheduleSaveOverride(coverKey, t.id, `cover:${rowIndex}`, next);
                      }}
                      className="w-full min-w-0 border-0 bg-transparent p-0 text-center outline-none focus:bg-petrolLight"
                    />
                  ) : (
                    coverOverrides[coverKey]?.wo ?? (t.buildingWorkOrder ?? "")
                  )}
                </td>
                <td className={backCell}>
                  <span className="flex items-center justify-between gap-2">
                    {row.nome ?? ""}
                    {isEditable(t) && (
                      <button
                        type="button"
                        onClick={() => removeCover(t.id, rowIndex)}
                        title="Remove cover"
                        className="rounded p-0.5 text-ink/30 hover:text-danger print:hidden"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </span>
                </td>
                <td className={`${backCell} text-center`}>{row.staffNumber ?? ""}</td>
                {DAYS.map((d, di) => (
                  <>
                    <SignCell
                      key={d}
                      value={row.days[d] ?? EMPTY_DAY}
                      editable={isEditable(t)}
                      onChangeIn={(v) => updateCell(t.id, rowIndex, d, "in", v)}
                      onChangeOut={(v) => updateCell(t.id, rowIndex, d, "out", v)}
                      className={backSignCell}
                      textClass={backSz.text}
                    />
                    {spacerAfter.has(di) && <td key={d + "-spacer"} className={SPACER_CLASS}></td>}
                  </>
                ))}
              </tr>
              );
            })}
            <BlankRow
              n={Math.max(MIN_COVER_ROWS - coversFlat.length, 1)}
              cell={backCell}
              signCell={backSignCell}
              textClass={backSz.text}
              days={DAYS}
              spacerAfter={spacerAfter}
            />

            <tr>
              <td className={`${backCell} font-medium`}>ESTATES ADDITIONAL</td>
              <td className={backCell}></td>
              {(() => {
                const total = 3 + DAYS.length + spacerCount;
                const per = Math.floor(total / Math.max(coverItems.length, 1));
                return coverItems.length === 0 ? (
                  <td colSpan={total} className={`${backCell} text-center font-medium`}></td>
                ) : (
                  coverItems.map((item, idx) => (
                    <td
                      key={idx}
                      colSpan={idx === coverItems.length - 1 ? total - per * (coverItems.length - 1) : per}
                      className={`${backCell} text-center font-medium`}
                    >
                      {item}
                    </td>
                  ))
                );
              })()}
            </tr>

            <BlankRow n={6} cell={backCell} signCell={backSignCell} textClass={backSz.text} days={DAYS} spacerAfter={spacerAfter} />

            <tr>
              <td className={`${backCell} font-medium`}>ESTATES EVENTS</td>
              <td className={backCell}></td>
              <td className={`${backCell} text-center font-medium`}>{ESTATES_EVENTS_WO}</td>
              <td className={backCell}></td>
              <td className={backCell}></td>
              {DAYS.map((d, di) => (
                <>
                  <td key={d} className={backSignCell}></td>
                  {spacerAfter.has(di) && <td key={d + "-spacer"} className={SPACER_CLASS}></td>}
                </>
              ))}
            </tr>

            <BlankRow n={4} cell={backCell} signCell={backSignCell} textClass={backSz.text} days={DAYS} spacerAfter={spacerAfter} />
          </tbody>
        </table>
        </div>
      </div>
      )}

      {error && <p className="mt-3 text-sm text-danger print:hidden">{tr(error)}</p>}

      <style jsx global>{`
        @media print {
          @page {
            size: landscape;
            margin: 10mm;
          }
          .break-before-page {
            break-before: page;
          }
          .ts-table {
            min-width: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
