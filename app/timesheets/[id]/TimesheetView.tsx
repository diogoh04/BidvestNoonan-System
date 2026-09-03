"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Printer, Plus, X, Pencil, Check } from "lucide-react";
import { computeOpenSlots, type Slot } from "@/lib/openSlots";
import { getTimesheetDayKeys, timesheetDayLabel, type TimesheetDayValue, type TimesheetPeriodType } from "@/lib/types";
import StaffSearchInput from "@/components/StaffSearchInput";
import { fetchSheetOverrides, indexSheetOverrides, saveSheetOverride } from "@/lib/timesheetSheetOverrides";
import { fetchSignEntries, indexSignEntries, saveSignEntry } from "@/lib/timesheetSheetSigns";

type StaffLine = {
  id: string;
  nome: string | null;
  staffNumber: string | null;
  horasSemana: number | null;
};

type Cover = { id: string; nome: string | null; staffNumber: string | null; horas: number | null };

type Building = {
  id: string;
  nome: string;
  workOrder: string | null;
  slots: Slot[];
  covers: Cover[];
  teamLeaders: StaffLine[];
  cleaners: StaffLine[];
};

const ESTATES_EVENTS_WO = "515736";
const MIN_COVER_ROWS = 7;
// Coluna vazia entre a sexta da semana 1 e a segunda da semana 2, só na
// quinzenal — sem borda/conteúdo, só pra separar visualmente as semanas.
const SPACER_CLASS = "w-2 border-0 bg-white p-0 print:bg-transparent";
const SPACER_AFTER_INDEX = 4;

// Só cleaners + vagas em aberto — o(s) team leader(s) já aparecem na linha
// "Team Leader" do cabeçalho, não precisam repetir como linha na tabela.
function buildRows(building: Building) {
  const rows: { nome: string | null; staffNumber: string | null; horas: number | null }[] = [
    ...building.cleaners.map((c) => ({ nome: c.nome, staffNumber: c.staffNumber, horas: c.horasSemana })),
    ...computeOpenSlots(building.slots, building.cleaners).map((s) => ({
      nome: null,
      staffNumber: null,
      horas: s.horas,
    })),
  ];
  // maior número de horas primeiro
  rows.sort((a, b) => (b.horas ?? 0) - (a.horas ?? 0));
  return rows;
}

// Campo livre pra preencher na tela (data da semana). Não persiste — só pra
// digitar antes de imprimir/exportar, igual o SignCell abaixo.
function WeekField() {
  return (
    <input
      type="text"
      maxLength={2}
      className="inline-block w-10 border-0 border-b border-ink bg-transparent text-center leading-none outline-none focus:bg-petrolLight"
    />
  );
}

// Campo livre pra preencher na tela (número de horas ou um dos códigos HP/AA/S/HU/AU/BH/P45).
// Não persiste — só pra digitar antes de imprimir/exportar. `textClass` é
// aplicado direto no input (não só herdado da tabela) pra garantir que ele
// nunca force a linha a ficar mais alta que o `cellH` calculado.
function SignCell({ className, textClass }: { className: string; textClass: string }) {
  return (
    <td className={className}>
      <input
        type="text"
        maxLength={5}
        className={`h-full w-full border-none bg-transparent p-0 text-center leading-none text-inherit outline-none focus:bg-petrolLight ${textClass}`}
      />
    </td>
  );
}

const EMPTY_SIGN: TimesheetDayValue = { in: null, out: null };

// Igual o SignCell acima, mas controlado e salvo (linhas de staff/vaga,
// covers e ESTATES EVENTS — ver TimesheetSheetSign). Mantém a mesma
// estrutura de uma <td> por coluna (SIGN IN e SIGN OUT continuam colunas
// separadas, como no colgroup/cabeçalho) — só passa a controlar o valor.
// Componente de módulo de propósito: se fosse declarado dentro de
// TimesheetView, cada tecla digitada recriaria a função e o React trataria
// o <input> como um elemento novo, perdendo o foco a cada caractere.
function PersistedSignCell({
  value,
  onChange,
  className,
  textClass,
}: {
  value: string;
  onChange: (v: string) => void;
  className: string;
  textClass: string;
}) {
  return (
    <td className={className}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={5}
        className={`h-full w-full border-none bg-transparent p-0 text-center leading-none text-inherit outline-none focus:bg-petrolLight ${textClass}`}
      />
    </td>
  );
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
              <SignCell key={d + i + "-in"} className={signCell} textClass={textClass} />
              <SignCell key={d + i + "-out"} className={signCell} textClass={textClass} />
              {spacer && di === SPACER_AFTER_INDEX && <td key={d + i + "-spacer"} className={SPACER_CLASS}></td>}
            </>
          ))}
        </tr>
      ))}
    </>
  );
}

function frontTableSizing(rowCount: number) {
  if (rowCount <= 10) return { text: "text-xs", pad: "p-1", cellH: "h-8" };
  if (rowCount <= 16) return { text: "text-[10px]", pad: "p-0.5", cellH: "h-6" };
  if (rowCount <= 24) return { text: "text-[9px]", pad: "p-0.5", cellH: "h-5" };
  if (rowCount <= 32) return { text: "text-[8px]", pad: "p-[2px]", cellH: "h-4" };
  if (rowCount <= 45) return { text: "text-[7px]", pad: "p-px", cellH: "h-3" };
  return { text: "text-[6px]", pad: "p-0", cellH: "h-3" };
}

// Larguras (%) das colunas fixas (Building/Hours/WO/Name/Staff Number) do
// colgroup. Na quinzenal são o dobro de colunas de dia disputando o mesmo
// espaço — reduz um pouco as fixas pra sobrar mais área pros dias, senão
// eles ficam minúsculos.
function scaleFixedCols(pct: number[], periodType: TimesheetPeriodType): number[] {
  const factor = periodType === "biweekly" ? 2 / 3 : 1;
  return pct.map((p) => p * factor);
}

// Mesma ideia do frontTableSizing, mas pro verso ("Building Covers") — hoje
// era tudo fixo (text-[11px]/h-8), então com mais de 7 covers a tabela
// crescia sem limite. O piso da primeira faixa reproduz o tamanho de hoje
// (0-7 covers = 19 linhas), então quem já cabia não muda nada.
function backTableSizing(rowCount: number) {
  if (rowCount <= 19) return { text: "text-[10px]", pad: "p-0.5", cellH: "h-6" };
  if (rowCount <= 24) return { text: "text-[9px]", pad: "p-[2px]", cellH: "h-5" };
  if (rowCount <= 32) return { text: "text-[8px]", pad: "p-0", cellH: "h-4" };
  return { text: "text-[7px]", pad: "p-0", cellH: "h-3" };
}

export default function TimesheetView({ building }: { building: Building }) {
  const rows = buildRows(building);
  const coverItems = [`${building.nome} - WO ${building.workOrder ?? "—"}`];
  // Total de horas do prédio = soma das vagas configuradas (não soma das linhas
  // exibidas, que incluem team leaders e podem ter horas de staff que não batem
  // com nenhuma vaga).
  const totalHours = building.slots.reduce((sum, s) => sum + s.horas, 0);
  const sz = frontTableSizing(rows.length);
  const cell = `border border-ink ${sz.pad}`;
  const signCell = `border border-ink ${sz.pad} ${sz.cellH}`;

  const [hideNames, setHideNames] = useState(false);

  // Modo edição: permite personalizar o nome do prédio (topo) e, por linha,
  // o nome do prédio + WO — só nesta folha impressa. Salvo numa tabela
  // separada (TimesheetSheetOverride, via /api/timesheet-overrides) — nunca
  // escreve em Building/Team, então editar aqui nunca altera o cadastro.
  const [editMode, setEditMode] = useState(false);
  const [headerNome, setHeaderNome] = useState(building.nome);
  const [rowOverrides, setRowOverrides] = useState<{ nomePredio: string; wo: string }[]>(() =>
    rows.map(() => ({ nomePredio: building.nome, wo: building.workOrder ?? "" }))
  );
  const [coverOverrides, setCoverOverrides] = useState<Record<string, { nomePredio: string; wo: string }>>(() =>
    Object.fromEntries(building.covers.map((c) => [c.id, { nomePredio: building.nome, wo: building.workOrder ?? "" }]))
  );
  // Enquanto ninguém mexeu (ou editou igual pra todo mundo), continua
  // mesclado igual antes. Só separa de verdade quando alguma linha ficou
  // diferente das outras — assim o que foi digitado não some ao sair do
  // modo edição.
  const rowBuildingAllSame = rowOverrides.every((o) => o.nomePredio === rowOverrides[0]?.nomePredio);
  const rowWoAllSame = rowOverrides.every((o) => o.wo === rowOverrides[0]?.wo);

  // Carrega as personalizações salvas (se houver) assim que a folha abre, e
  // salva (com debounce) sempre que algo muda — ver lib/timesheetSheetOverrides.
  const saveTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  function scheduleSaveOverride(key: string, scope: string, value: { nomePredio: string; wo: string }) {
    if (saveTimeouts.current[key]) clearTimeout(saveTimeouts.current[key]);
    saveTimeouts.current[key] = setTimeout(() => {
      saveSheetOverride("building", building.id, scope, value);
    }, 500);
  }

  useEffect(() => {
    (async () => {
      const overrides = indexSheetOverrides(await fetchSheetOverrides("building", [building.id]));
      const header = overrides[`${building.id}:header`];
      if (header) setHeaderNome(header.nomePredio ?? building.nome);
      setRowOverrides((prev) =>
        prev.map((o, i) => {
          const r = overrides[`${building.id}:row:${i}`];
          return r ? { nomePredio: r.nomePredio ?? building.nome, wo: r.workOrder ?? building.workOrder ?? "" } : o;
        })
      );
      setCoverOverrides((prev) => {
        const next = { ...prev };
        for (const c of building.covers) {
          const r = overrides[`${building.id}:cover:${c.id}`];
          if (r) next[c.id] = { nomePredio: r.nomePredio ?? building.nome, wo: r.workOrder ?? building.workOrder ?? "" };
        }
        return next;
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })();
  }, [building.id]);

  // SIGN IN/SIGN OUT digitados nas linhas de staff/vaga, covers e ESTATES
  // EVENTS — persistem numa tabela separada (TimesheetSheetSign, via
  // /api/timesheet-signs). Sem semana associada de propósito (escolha do
  // usuário): o valor digitado fica valendo até ser sobrescrito, não reseta
  // toda semana. As linhas em branco (BlankRow) continuam sem persistir —
  // não têm identidade estável pra amarrar um registro.
  const [signValues, setSignValues] = useState<Record<string, TimesheetDayValue>>({});
  const signSaveTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  function updateSign(scope: string, field: "in" | "out", v: string) {
    setSignValues((prev) => {
      const current = prev[scope] ?? EMPTY_SIGN;
      const next = { ...current, [field]: v };
      if (signSaveTimeouts.current[scope]) clearTimeout(signSaveTimeouts.current[scope]);
      signSaveTimeouts.current[scope] = setTimeout(() => {
        saveSignEntry("building", building.id, scope, { in: next.in ?? "", out: next.out ?? "" });
      }, 500);
      return { ...prev, [scope]: next };
    });
  }

  useEffect(() => {
    (async () => {
      const signs = indexSignEntries(await fetchSignEntries("building", [building.id]));
      setSignValues(Object.fromEntries(Object.values(signs).map((r) => [r.scope, { in: r.signIn, out: r.signOut }])));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })();
  }, [building.id]);

  // Molde em branco só na tela — não persiste nada (igual o resto da folha
  // de impressão), então é só um toggle local decidindo quantos dias mostrar.
  const [periodType, setPeriodType] = useState<TimesheetPeriodType>("weekly");
  const DAYS = getTimesheetDayKeys(periodType);
  const hasSpacer = periodType === "biweekly";
  const spacerCount = hasSpacer ? 1 : 0;

  const [covers, setCovers] = useState<Cover[]>(building.covers);
  const backRowCount = covers.length + Math.max(MIN_COVER_ROWS - covers.length, 1) + 12;
  const backSz = backTableSizing(backRowCount);
  const backCell = `border border-ink ${backSz.pad}`;
  const backSignCell = `border border-ink ${backSz.pad} ${backSz.cellH}`;
  const [coverNome, setCoverNome] = useState("");
  const [coverStaffNumber, setCoverStaffNumber] = useState("");
  const [coverHoras, setCoverHoras] = useState("");
  const [savingCover, setSavingCover] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);

  async function addCover() {
    if (!coverNome.trim()) return;
    setSavingCover(true);
    setCoverError(null);
    try {
      const res = await fetch(`/api/buildings/${building.id}/covers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: coverNome.trim(),
          staffNumber: coverStaffNumber.trim() || null,
          horas: coverHoras.trim() === "" ? null : Number(coverHoras.replace(",", ".")),
        }),
      });
      if (!res.ok) throw new Error("Could not add the cover");
      const created = await res.json();
      setCovers((prev) => [...prev, created]);
      setCoverOverrides((prev) => ({
        ...prev,
        [created.id]: { nomePredio: building.nome, wo: building.workOrder ?? "" },
      }));
      setCoverNome("");
      setCoverStaffNumber("");
      setCoverHoras("");
    } catch (e: any) {
      setCoverError(e.message);
    } finally {
      setSavingCover(false);
    }
  }

  async function removeCover(id: string) {
    setCovers((prev) => prev.filter((c) => c.id !== id));
    setCoverOverrides((prev) => {
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
    try {
      await fetch(`/api/buildings/${building.id}/covers/${id}`, { method: "DELETE" });
    } catch {
    }
  }

  return (
    <main className="mx-auto max-w-6xl bg-white px-6 py-10 print:max-w-none print:px-8 print:py-4">
      <div className="mb-6 flex flex-wrap items-center justify-end gap-4 print:hidden">
        <div className="flex gap-1">
          {(["weekly", "biweekly"] as TimesheetPeriodType[]).map((pt) => (
            <button
              key={pt}
              type="button"
              onClick={() => setPeriodType(pt)}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                periodType === pt
                  ? "border-petrol bg-petrol text-white"
                  : "border-line bg-white text-ink hover:border-petrol"
              }`}
            >
              {pt === "weekly" ? "Weekly" : "Biweekly"}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-ink/70">
          <input
            type="checkbox"
            checked={hideNames}
            onChange={(e) => setHideNames(e.target.checked)}
            className="h-4 w-4 rounded border-line"
          />
          Hide staff names
        </label>
        <button
          type="button"
          onClick={() => setEditMode((v) => !v)}
          className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition ${
            editMode ? "border-petrol bg-petrol text-white" : "border-line bg-white text-ink hover:border-petrol"
          }`}
        >
          {editMode ? <Check size={14} /> : <Pencil size={14} />}
          {editMode ? "Done editing" : "Edit"}
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-md bg-petrol px-4 py-2 text-sm font-medium text-white hover:bg-petrolDark"
        >
          <Printer size={16} />
          Print / Export PDF
        </button>
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
              scheduleSaveOverride("header", "header", { nomePredio: e.target.value, wo: "" });
            }}
            size={Math.max(headerNome.length, 1)}
            className="border-0 bg-transparent font-display text-lg font-bold text-ink outline-none focus:bg-petrolLight print:text-xs"
          />
          <Image src="/logoUCD.png" alt="Client logo" width={56} height={56} className="h-14 w-14 shrink-0 object-contain print:h-9 print:w-9" />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4 text-sm print:mt-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-ink">{periodType === "biweekly" ? "FORTNIGHT" : "WEEK"}</span>
          <WeekField />
          <span>/</span>
          <WeekField />
          <span>—</span>
          <WeekField />
          <span>/</span>
          <WeekField />
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
        <span className="inline-block min-w-[220px] border-b border-ink px-2">
          {hideNames ? "\u00A0" : building.teamLeaders.map((t) => t.nome).join(", ") || "\u00A0"}
        </span>
      </div>

      <table className={`mt-6 w-full table-fixed border-collapse print:mt-2 ${sz.text}`}>
        <colgroup>
          {scaleFixedCols([9, 4, 7, 22, 9], periodType).map((w, i) => (
            <col key={i} style={{ width: `${w}%` }} />
          ))}
          {DAYS.map((d, i) => (
            <>
              <col key={d + "-in-col"} />
              <col key={d + "-out-col"} />
              {hasSpacer && i === SPACER_AFTER_INDEX && <col key={d + "-spacer-col"} className="w-2" />}
            </>
          ))}
        </colgroup>
        <thead>
          <tr>
            <th rowSpan={2} className={`${cell} align-middle`}>Building</th>
            <th rowSpan={2} className={`${cell} align-middle`}>{totalHours}h total</th>
            <th rowSpan={2} className={`${cell} align-middle`}>WO</th>
            <th rowSpan={2} className={`${cell} align-middle`}>Name</th>
            <th rowSpan={2} className={`${cell} align-middle`}>Staff Number</th>
            {DAYS.map((d, i) => (
              <>
                <th key={d} colSpan={2} className={`${cell} text-center`}>
                  {timesheetDayLabel(d)}
                </th>
                {hasSpacer && i === SPACER_AFTER_INDEX && <th key={d + "-spacer"} className={SPACER_CLASS}></th>}
              </>
            ))}
          </tr>
          <tr>
            {DAYS.map((d, i) => (
              <>
                <th key={d + "-in"} className={`${cell} text-center font-normal`}>SIGN IN</th>
                <th key={d + "-out"} className={`${cell} text-center font-normal`}>SIGN OUT</th>
                {hasSpacer && i === SPACER_AFTER_INDEX && <th key={d + "-spacer2"} className={SPACER_CLASS}></th>}
              </>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={5 + DAYS.length * 2 + spacerCount} className={`${cell} text-center text-ink/40`}>
                No staff or slot registered in this building yet.
              </td>
            </tr>
          )}
          {rows.map((r, i) => (
            <tr key={i}>
              {editMode ? (
                <td className={`${cell} text-center font-bold align-middle`}>
                  <input
                    type="text"
                    value={rowOverrides[i]?.nomePredio ?? ""}
                    onChange={(e) => {
                      const next = { nomePredio: e.target.value, wo: rowOverrides[i]?.wo ?? "" };
                      setRowOverrides((prev) => prev.map((o, idx) => (idx === i ? next : o)));
                      scheduleSaveOverride(`row:${i}`, `row:${i}`, next);
                    }}
                    className="w-full min-w-0 border-0 bg-transparent p-0 text-center font-bold outline-none focus:bg-petrolLight"
                  />
                </td>
              ) : rowBuildingAllSame ? (
                i === 0 && (
                  <td rowSpan={rows.length} className={`${cell} text-center font-bold align-middle`}>
                    {rowOverrides[0]?.nomePredio ?? building.nome}
                  </td>
                )
              ) : (
                <td className={`${cell} text-center font-bold align-middle`}>
                  {rowOverrides[i]?.nomePredio ?? building.nome}
                </td>
              )}
              <td className={`${cell} text-center`}>{r.horas ?? ""}</td>
              {editMode ? (
                <td className={`${cell} text-center font-bold align-middle`}>
                  <input
                    type="text"
                    value={rowOverrides[i]?.wo ?? ""}
                    onChange={(e) => {
                      const next = { nomePredio: rowOverrides[i]?.nomePredio ?? "", wo: e.target.value };
                      setRowOverrides((prev) => prev.map((o, idx) => (idx === i ? next : o)));
                      scheduleSaveOverride(`row:${i}`, `row:${i}`, next);
                    }}
                    className="w-full min-w-0 border-0 bg-transparent p-0 text-center font-bold outline-none focus:bg-petrolLight"
                  />
                </td>
              ) : rowWoAllSame ? (
                i === 0 && (
                  <td rowSpan={rows.length} className={`${cell} text-center font-bold align-middle`}>
                    {rowOverrides[0]?.wo ?? building.workOrder ?? ""}
                  </td>
                )
              ) : (
                <td className={`${cell} text-center font-bold align-middle`}>
                  {rowOverrides[i]?.wo ?? building.workOrder ?? ""}
                </td>
              )}
              <td className={cell}>{hideNames ? "" : r.nome ?? ""}</td>
              <td className={`${cell} text-center`}>{hideNames ? "" : r.staffNumber ?? ""}</td>
              {DAYS.map((d, di) => {
                const scope = `row:${i}:${d}`;
                const val = signValues[scope] ?? EMPTY_SIGN;
                return (
                  <>
                    <PersistedSignCell
                      key={d + i + "-in"}
                      className={signCell}
                      textClass={sz.text}
                      value={val.in ?? ""}
                      onChange={(v) => updateSign(scope, "in", v)}
                    />
                    <PersistedSignCell
                      key={d + i + "-out"}
                      className={signCell}
                      textClass={sz.text}
                      value={val.out ?? ""}
                      onChange={(v) => updateSign(scope, "out", v)}
                    />
                    {hasSpacer && di === SPACER_AFTER_INDEX && <td key={d + i + "-spacer"} className={SPACER_CLASS}></td>}
                  </>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-10 print:mt-0 break-before-page">
        <div className="mb-2 flex flex-wrap items-center gap-2 print:hidden">
          {coverNome ? (
            <span className="flex items-center gap-1.5 rounded-md border border-petrol bg-petrolLight px-2.5 py-1.5 text-xs text-petrol">
              {coverNome} {coverStaffNumber && `#${coverStaffNumber}`}
              <button
                type="button"
                onClick={() => {
                  setCoverNome("");
                  setCoverStaffNumber("");
                }}
                className="hover:text-petrolDark"
              >
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
          {coverError && <span className="text-xs text-danger">{coverError}</span>}
        </div>

        <table className={`w-full table-fixed border-collapse ${backSz.text}`}>
          <colgroup>
            {scaleFixedCols([9, 4, 7, 18, 13], periodType).map((w, i) => (
              <col key={i} style={{ width: `${w}%` }} />
            ))}
            {DAYS.map((d, i) => (
              <>
                <col key={d + "-in-col"} />
                <col key={d + "-out-col"} />
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
                  <th key={d} colSpan={2} className={`${backCell} text-center`}>
                    {timesheetDayLabel(d)}
                  </th>
                  {hasSpacer && i === SPACER_AFTER_INDEX && <th key={d + "-spacer"} className={SPACER_CLASS}></th>}
                </>
              ))}
            </tr>
            <tr>
              {DAYS.map((d, i) => (
                <>
                  <th key={d + "-in2"} className={`${backCell} text-center font-normal`}>SIGN IN</th>
                  <th key={d + "-out2"} className={`${backCell} text-center font-normal`}>SIGN OUT</th>
                  {hasSpacer && i === SPACER_AFTER_INDEX && <th key={d + "-spacer2"} className={SPACER_CLASS}></th>}
                </>
              ))}
            </tr>
          </thead>
          <tbody>
            {covers.map((c) => (
              <tr key={c.id}>
                <td className={`${backSignCell} text-center`}>
                  {editMode ? (
                    <input
                      type="text"
                      value={coverOverrides[c.id]?.nomePredio ?? ""}
                      onChange={(e) => {
                        const next = {
                          nomePredio: e.target.value,
                          wo: coverOverrides[c.id]?.wo ?? building.workOrder ?? "",
                        };
                        setCoverOverrides((prev) => ({ ...prev, [c.id]: next }));
                        scheduleSaveOverride(`cover:${c.id}`, `cover:${c.id}`, next);
                      }}
                      className="w-full min-w-0 border-0 bg-transparent p-0 text-center outline-none focus:bg-petrolLight"
                    />
                  ) : (
                    coverOverrides[c.id]?.nomePredio ?? building.nome
                  )}
                </td>
                <td className={`${backCell} text-center`}>{c.horas ?? ""}</td>
                <td className={`${backCell} text-center`}>
                  {editMode ? (
                    <input
                      type="text"
                      value={coverOverrides[c.id]?.wo ?? ""}
                      onChange={(e) => {
                        const next = {
                          nomePredio: coverOverrides[c.id]?.nomePredio ?? building.nome,
                          wo: e.target.value,
                        };
                        setCoverOverrides((prev) => ({ ...prev, [c.id]: next }));
                        scheduleSaveOverride(`cover:${c.id}`, `cover:${c.id}`, next);
                      }}
                      className="w-full min-w-0 border-0 bg-transparent p-0 text-center outline-none focus:bg-petrolLight"
                    />
                  ) : (
                    coverOverrides[c.id]?.wo ?? (building.workOrder ?? "")
                  )}
                </td>
                <td className={backCell}>
                  <span className="flex items-center justify-between gap-2">
                    {hideNames ? "" : c.nome ?? ""}
                    <button
                      type="button"
                      onClick={() => removeCover(c.id)}
                      title="Remove cover"
                      className="rounded p-0.5 text-ink/30 hover:text-danger print:hidden"
                    >
                      <X size={12} />
                    </button>
                  </span>
                </td>
                <td className={`${backCell} text-center`}>{hideNames ? "" : c.staffNumber ?? ""}</td>
                {DAYS.map((d, di) => {
                  const scope = `cover:${c.id}:${d}`;
                  const val = signValues[scope] ?? EMPTY_SIGN;
                  return (
                    <>
                      <PersistedSignCell
                        key={d + c.id + "-in"}
                        className={backSignCell}
                        textClass={backSz.text}
                        value={val.in ?? ""}
                        onChange={(v) => updateSign(scope, "in", v)}
                      />
                      <PersistedSignCell
                        key={d + c.id + "-out"}
                        className={backSignCell}
                        textClass={backSz.text}
                        value={val.out ?? ""}
                        onChange={(v) => updateSign(scope, "out", v)}
                      />
                      {hasSpacer && di === SPACER_AFTER_INDEX && <td key={d + c.id + "-spacer"} className={SPACER_CLASS}></td>}
                    </>
                  );
                })}
              </tr>
            ))}
            <BlankRow
              n={Math.max(MIN_COVER_ROWS - covers.length, 1)}
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
                const total = 3 + DAYS.length * 2 + spacerCount;
                const per = Math.floor(total / coverItems.length);
                return coverItems.map((item, idx) => (
                  <td
                    key={idx}
                    colSpan={idx === coverItems.length - 1 ? total - per * (coverItems.length - 1) : per}
                    className={`${backCell} text-center font-medium`}
                  >
                    {item}
                  </td>
                ));
              })()}
            </tr>

            <BlankRow n={6} cell={backCell} signCell={backSignCell} textClass={backSz.text} days={DAYS} spacer={hasSpacer} />

            <tr>
              <td className={`${backCell} font-medium`}>ESTATES EVENTS</td>
              <td className={backCell}></td>
              <td className={`${backCell} text-center font-medium`}>{ESTATES_EVENTS_WO}</td>
              <td className={backCell}></td>
              <td className={backCell}></td>
              {DAYS.map((d, di) => {
                const scope = `estatesEvents:${d}`;
                const val = signValues[scope] ?? EMPTY_SIGN;
                return (
                  <>
                    <PersistedSignCell
                      key={d + "-events-in"}
                      className={backSignCell}
                      textClass={backSz.text}
                      value={val.in ?? ""}
                      onChange={(v) => updateSign(scope, "in", v)}
                    />
                    <PersistedSignCell
                      key={d + "-events-out"}
                      className={backSignCell}
                      textClass={backSz.text}
                      value={val.out ?? ""}
                      onChange={(v) => updateSign(scope, "out", v)}
                    />
                    {hasSpacer && di === SPACER_AFTER_INDEX && <td key={d + "-events-spacer"} className={SPACER_CLASS}></td>}
                  </>
                );
              })}
            </tr>

            <BlankRow n={4} cell={backCell} signCell={backSignCell} textClass={backSz.text} days={DAYS} spacer={hasSpacer} />
          </tbody>
        </table>
      </div>

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
