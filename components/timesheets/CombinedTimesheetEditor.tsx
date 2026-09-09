"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Printer, Plus, X } from "lucide-react";
import {
  getTimesheetDayKeys,
  timesheetDayLabel,
  type TimesheetDTO,
  type TimesheetRow,
  type TimesheetPeriodType,
} from "@/lib/types";
import {
  formatWeekRange,
  formatFortnightRange,
  formatShortDate,
  formatDDMM,
  timesheetDayOffset,
  fortnightWorkingDays,
  weekdayShort,
} from "@/lib/week";
import StaffSearchInput from "@/components/StaffSearchInput";
import { fetchSheetOverrides, indexSheetOverrides, saveSheetOverride } from "@/lib/timesheetSheetOverrides";

const ESTATES_EVENTS_WO = "515736";
const MIN_COVER_ROWS = 7;
const EMPTY_DAY: DayValue = { in: null, out: null };
// Coluna vazia entre a sexta da semana 1 e a segunda da semana 2, só na
// quinzenal — sem borda/conteúdo, só pra separar visualmente as semanas.
const SPACER_CLASS = "w-2 border-0 bg-white p-0 print:bg-transparent";
// Índice do dia depois do qual entra a coluna espaçadora (sexta da semana 1).
const SPACER_AFTER_INDEX = 4;

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

function emptyDays(periodType: TimesheetPeriodType): TimesheetRow["days"] {
  return Object.fromEntries(getTimesheetDayKeys(periodType).map((d) => [d, { in: null, out: null }]));
}

// Na tela, tamanho fixo e confortável pra usar no celular (a tabela rola
// na horizontal em vez de encolher). Na impressão, encolhe conforme o
// número de linhas pra caber numa página só — daí os pares de classe
// base + print:.
function frontTableSizing(rowCount: number) {
  if (rowCount <= 10) return { text: "text-xs print:text-xs", pad: "p-1.5 print:p-1", cellH: "h-9 print:h-8" };
  if (rowCount <= 16) return { text: "text-xs print:text-[10px]", pad: "p-1.5 print:p-0.5", cellH: "h-9 print:h-6" };
  if (rowCount <= 24) return { text: "text-xs print:text-[9px]", pad: "p-1.5 print:p-0.5", cellH: "h-9 print:h-5" };
  if (rowCount <= 32) return { text: "text-xs print:text-[8px]", pad: "p-1.5 print:p-[2px]", cellH: "h-9 print:h-4" };
  if (rowCount <= 45) return { text: "text-xs print:text-[7px]", pad: "p-1.5 print:p-px", cellH: "h-9 print:h-3" };
  return { text: "text-xs print:text-[6px]", pad: "p-1.5 print:p-0", cellH: "h-9 print:h-3" };
}

function backTableSizing(rowCount: number) {
  if (rowCount <= 19) return { text: "text-xs print:text-[10px]", pad: "p-1 print:p-0.5", cellH: "h-8 print:h-6" };
  if (rowCount <= 24) return { text: "text-xs print:text-[9px]", pad: "p-1 print:p-[2px]", cellH: "h-8 print:h-5" };
  if (rowCount <= 32) return { text: "text-xs print:text-[8px]", pad: "p-1 print:p-0", cellH: "h-8 print:h-4" };
  return { text: "text-xs print:text-[7px]", pad: "p-1 print:p-0", cellH: "h-8 print:h-3" };
}

// Larguras (%) das colunas fixas (Building/Hours/WO/Name/Staff Number) do
// colgroup. Na quinzenal são o dobro de colunas de dia disputando o mesmo
// espaço — reduz um pouco as fixas pra sobrar mais área pros dias, senão
// eles ficam minúsculos.
function scaleFixedCols(pct: number[], periodType: TimesheetPeriodType): number[] {
  const factor = periodType === "biweekly" ? 2 / 3 : 1;
  return pct.map((p) => p * factor);
}

function BlankRow({
  n,
  cell,
  signCell,
  textClass,
  days,
  spacer = false,
}: {
  n: number;
  cell: string;
  signCell: string;
  textClass: string;
  days: readonly string[];
  spacer?: boolean;
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
              {spacer && di === SPACER_AFTER_INDEX && <td key={d + "-spacer"} className={SPACER_CLASS}></td>}
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
}: {
  teamLeaderNome: string | null;
  timesheets: TimesheetDTO[];
  onChanged: (t: TimesheetDTO) => void;
  // Disparado SÍNCRONO a cada edição (antes do auto-save chegar ao servidor)
  // — deixa o pai (LancarClient) com as linhas mais recentes pra "Send to
  // supervisor" não perder a última tecla digitada.
  onRowsChange?: (timesheetId: string, rows: TimesheetRow[]) => void;
  readOnly?: boolean;
}) {
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
  const [rowOverrides, setRowOverrides] = useState<Record<string, { nomePredio: string; wo: string }>>({});
  const [coverOverrides, setCoverOverrides] = useState<Record<string, { nomePredio: string; wo: string }>>({});
  const overrideSaveTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  function scheduleSaveOverride(debounceKey: string, subjectId: string, scope: string, value: { nomePredio: string; wo: string }) {
    if (overrideSaveTimeouts.current[debounceKey]) clearTimeout(overrideSaveTimeouts.current[debounceKey]);
    overrideSaveTimeouts.current[debounceKey] = setTimeout(() => {
      saveSheetOverride("timesheet", subjectId, scope, value);
    }, 500);
  }
  function scheduleSaveHeader(value: { nomePredio: string; wo: string }) {
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
        if (header) setHeaderNome(header.nomePredio ?? timesheets.map((t) => t.buildingNome).join(", "));
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
        days: emptyDays(periodType),
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
  const DAYS = getTimesheetDayKeys(periodType);
  const hasSpacer = periodType === "biweekly";
  const spacerCount = hasSpacer ? 1 : 0;
  const weekStart = timesheets[0]?.weekStart;

  // Quinzenal: as 10 colunas são os 10 dias úteis a partir do início — data
  // e nome do dia (WED, THU...) vêm da data real, não da chave W1_MONDAY.
  const fortnightDays = periodType === "biweekly" && weekStart ? fortnightWorkingDays(weekStart) : null;
  function colDate(i: number): string {
    return fortnightDays ? formatDDMM(fortnightDays[i]) : weekStart ? formatShortDate(weekStart, timesheetDayOffset(i)) : "";
  }
  function colLabel(dayKey: string, i: number): string {
    return fortnightDays ? weekdayShort(fortnightDays[i]) : timesheetDayLabel(dayKey);
  }

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
    <main className="mx-auto max-w-6xl bg-white px-3 py-6 sm:px-6 sm:py-10 print:max-w-none print:px-8 print:py-4">
      <div className="mb-6 flex items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap gap-2">
          {timesheets.map((t) => (
            <span key={t.id} className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_CLASS[t.status]}`}>
              {t.buildingNome}: {STATUS_LABEL[t.status]}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-md bg-petrol px-4 py-2 text-sm font-medium text-white hover:bg-petrolDark"
          >
            <Printer size={16} />
            Print / Export PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-6 border-b-2 border-ink pb-3 print:pb-1">
        <Image src="/logo.jpg" alt="Bidvest Noonan" width={160} height={50} className="h-10 w-auto object-contain print:h-6" />
        <h1 className="text-center font-display text-xl font-bold uppercase tracking-wide text-ink print:text-sm">
          Sign In &amp; Sign Out Book
        </h1>
        <div className="flex items-center gap-6">
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
            className="border-0 bg-transparent font-display text-lg font-bold text-ink outline-none focus:bg-petrolLight print:text-xs"
          />
          <Image src="/logoUCD.png" alt="Client logo" width={56} height={56} className="h-14 w-14 shrink-0 object-contain print:h-6 print:w-6" />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4 text-sm print:mt-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-ink">{periodType === "biweekly" ? "FORTNIGHT" : "WEEK"}</span>
          <span className="border-b border-ink px-2">
            {weekStart
              ? periodType === "biweekly"
                ? formatFortnightRange(weekStart)
                : formatWeekRange(weekStart)
              : "—"}
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
        <span className="inline-block min-w-[220px] border-b border-ink px-2">{teamLeaderNome ?? " "}</span>
      </div>

      <p className="mt-4 text-xs text-ink/40 sm:hidden print:hidden">Swipe the table sideways to see all days →</p>

      <div className="mt-2 -mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0 print:mx-0 print:overflow-visible print:px-0">
      <table className={`w-full table-fixed border-collapse print:mt-2 ${sz.text}`}>
        <colgroup>
          {scaleFixedCols([9, 4, 7, 22, 9], periodType).map((w, i) => (
            <col key={i} style={{ width: `${w}%` }} />
          ))}
          {DAYS.map((d, i) => (
            <>
              <col key={d + "-col"} />
              {hasSpacer && i === SPACER_AFTER_INDEX && <col key={d + "-spacer-col"} className="w-2" />}
            </>
          ))}
        </colgroup>
        <thead>
          <tr>
            <th rowSpan={2} className={`${cell} align-middle`}>Building</th>
            <th rowSpan={2} className={`${cell} align-middle`}>{grandTotalHours}h total</th>
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
                {hasSpacer && i === SPACER_AFTER_INDEX && <th key={d + "-spacer"} className={SPACER_CLASS}></th>}
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
                {hasSpacer && i === SPACER_AFTER_INDEX && <th key={d + "-spacer2"} className={SPACER_CLASS}></th>}
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
                        {hasSpacer && di === SPACER_AFTER_INDEX && <td key={d + "-spacer"} className={SPACER_CLASS}></td>}
                      </>
                    ))}
                  </tr>
                </>
              );
            }

            // Enquanto ninguém mexeu (ou editou igual pra todo mundo), continua
            // mesclado igual antes. Só separa de verdade quando alguma linha
            // ficou diferente das outras — assim o que foi digitado não some
            // ao sair do modo edição.
            const tNomes = rows.map((_, i) => rowOverrides[`${t.id}:${i}`]?.nomePredio ?? t.buildingNome);
            const buildingAllSame = tNomes.every((v) => v === tNomes[0]);
            const tWos = rows.map((_, i) => rowOverrides[`${t.id}:${i}`]?.wo ?? t.buildingWorkOrder ?? "");
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
                        <td className={`${cell} text-center font-bold align-middle`}>
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
                          <td rowSpan={rows.length} className={`${cell} text-center font-bold align-middle`}>
                            {tNomes[0]}
                          </td>
                        )
                      ) : (
                        <td className={`${cell} text-center font-bold align-middle`}>{tNomes[i]}</td>
                      )}
                      <td className={`${cell} text-center`}>{r.horas ?? ""}</td>
                      {editMode ? (
                        <td className={`${cell} text-center font-bold align-middle`}>
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
                          <td rowSpan={rows.length} className={`${cell} text-center font-bold align-middle`}>
                            {tWos[0]}
                          </td>
                        )
                      ) : (
                        <td className={`${cell} text-center font-bold align-middle`}>{tWos[i]}</td>
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
                          {hasSpacer && di === SPACER_AFTER_INDEX && <td key={d + "-spacer"} className={SPACER_CLASS}></td>}
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
              placeholder="Search staff..."
            />
          )}
          <input
            type="number"
            min={0}
            step={0.25}
            value={coverHoras}
            onChange={(e) => setCoverHoras(e.target.value)}
            placeholder="Hours"
            className="w-24 rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-petrol"
          />
          <button
            type="button"
            onClick={addCover}
            disabled={savingCover}
            className="flex items-center gap-1 rounded-md bg-petrol px-3 py-1.5 text-sm font-medium text-white hover:bg-petrolDark disabled:opacity-50"
          >
            <Plus size={14} />
            Add cover
          </button>
        </div>
        )}

        <p className="mb-1 text-xs text-ink/40 sm:hidden print:hidden">Swipe the table sideways to see all days →</p>

        <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0 print:mx-0 print:overflow-visible print:px-0">
        <table className={`w-full table-fixed border-collapse ${backSz.text}`}>
          <colgroup>
            {scaleFixedCols([9, 4, 7, 18, 13], periodType).map((w, i) => (
              <col key={i} style={{ width: `${w}%` }} />
            ))}
            {DAYS.map((d, i) => (
              <>
                <col key={d + "-col"} />
                {hasSpacer && i === SPACER_AFTER_INDEX && <col key={d + "-spacer-col"} className="w-2" />}
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
                      {weekStart && (
                        <span className="font-normal text-ink/50">{formatShortDate(weekStart, timesheetDayOffset(i))}</span>
                      )}
                      <span>{timesheetDayLabel(d)}</span>
                    </div>
                  </th>
                  {hasSpacer && i === SPACER_AFTER_INDEX && <th key={d + "-spacer"} className={SPACER_CLASS}></th>}
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
                  {hasSpacer && i === SPACER_AFTER_INDEX && <th key={d + "-spacer2"} className={SPACER_CLASS}></th>}
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
                <td className={`${backCell} text-center`}>
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
                    {hasSpacer && di === SPACER_AFTER_INDEX && <td key={d + "-spacer"} className={SPACER_CLASS}></td>}
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
              spacer={hasSpacer}
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

            <BlankRow n={6} cell={backCell} signCell={backSignCell} textClass={backSz.text} days={DAYS} spacer={hasSpacer} />

            <tr>
              <td className={`${backCell} font-medium`}>ESTATES EVENTS</td>
              <td className={backCell}></td>
              <td className={`${backCell} text-center font-medium`}>{ESTATES_EVENTS_WO}</td>
              <td className={backCell}></td>
              <td className={backCell}></td>
              {DAYS.map((d, di) => (
                <>
                  <td key={d} className={backSignCell}></td>
                  {hasSpacer && di === SPACER_AFTER_INDEX && <td key={d + "-spacer"} className={SPACER_CLASS}></td>}
                </>
              ))}
            </tr>

            <BlankRow n={4} cell={backCell} signCell={backSignCell} textClass={backSz.text} days={DAYS} spacer={hasSpacer} />
          </tbody>
        </table>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-danger print:hidden">{error}</p>}

      <style jsx global>{`
        @media print {
          @page {
            size: landscape;
            margin: 10mm;
          }
          .break-before-page {
            break-before: page;
          }
        }
      `}</style>
    </main>
  );
}
