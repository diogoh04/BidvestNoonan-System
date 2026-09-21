"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Printer, Plus, X, Pencil, Check } from "lucide-react";
import { type Slot } from "@/lib/openSlots";
import { buildSheetRows } from "@/lib/timesheetRows";
import { getTimesheetDayKeys, timesheetDayLabel, type TimesheetPeriodType } from "@/lib/types";
import StaffSearchInput from "@/components/StaffSearchInput";
import { fetchSheetOverrides, indexSheetOverrides, saveSheetOverride } from "@/lib/timesheetSheetOverrides";

type StaffLine = {
  id: string;
  nome: string | null;
  staffNumber: string | null;
  horasSemana: number | null;
  // Posição manual na folha (ver lib/timesheetRows.ts). Só nos cleaners.
  ordem?: number | null;
  sbId?: string;
  // Building/WO próprios desta pessoa na folha (ver StaffBuilding). Vazio =
  // usa o do prédio.
  predioLabel?: string | null;
  workOrder?: string | null;
};

type Cover = { id: string; nome: string | null; staffNumber: string | null; horas: number | null };

type BuildingSection = {
  id: string;
  nome: string;
  workOrder: string | null;
  slots: Slot[];
  covers: Cover[];
  cleaners: StaffLine[];
};

type TeamLeader = {
  id: string;
  nome: string | null;
  staffNumber: string | null;
  buildings: BuildingSection[];
};

const ESTATES_EVENTS_WO = "515736";
const MIN_COVER_ROWS = 7;
// Coluna vazia entre a sexta da semana 1 e a segunda da semana 2, só na
// quinzenal — sem borda/conteúdo, só pra separar visualmente as semanas.
const SPACER_CLASS = "w-2 border-0 bg-white p-0 print:bg-transparent";
const SPACER_AFTER_INDEX = 4;

// Ordem (automática por horas ou manual) fica em lib/timesheetRows.ts.
function buildRows(b: BuildingSection) {
  return buildSheetRows(
    b.cleaners.map((c) => ({
      nome: c.nome,
      staffNumber: c.staffNumber,
      horas: c.horasSemana,
      ordem: c.ordem,
      sbId: c.sbId ?? null,
      predioLabel: c.predioLabel,
      workOrder: c.workOrder,
    })),
    b.slots,
    { nome: b.nome, workOrder: b.workOrder }
  );
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
// nunca force a linha a ficar mais alta que o `cellH` calculado. IN e OUT
// dividem uma única célula (em vez de duas colunas separadas) pra reduzir
// pela metade a largura da tabela — é o que sobra pra rolar no celular.
function SignCell({ className, textClass }: { className: string; textClass: string }) {
  return (
    <td className={className}>
      <div className="flex h-full items-stretch justify-center">
        <input
          type="text"
          maxLength={5}
          className={`h-full w-1/2 border-0 border-r border-ink/40 bg-transparent p-0 text-center leading-none text-inherit outline-none focus:bg-petrolLight ${textClass}`}
        />
        <input
          type="text"
          maxLength={5}
          className={`h-full w-1/2 border-0 bg-transparent p-0 text-center leading-none text-inherit outline-none focus:bg-petrolLight ${textClass}`}
        />
      </div>
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
              <SignCell key={d + i} className={signCell} textClass={textClass} />
              {spacer && di === SPACER_AFTER_INDEX && <td key={d + i + "-spacer"} className={SPACER_CLASS}></td>}
            </>
          ))}
        </tr>
      ))}
    </>
  );
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

// Mesma ideia do frontTableSizing, mas pro verso ("Building Covers") — hoje
// era tudo fixo (text-[11px]/h-8), então com mais de 7 covers a tabela
// crescia sem limite. O piso da primeira faixa reproduz o tamanho de hoje
// (0-7 covers = 19 linhas), então quem já cabia não muda nada.
function backTableSizing(rowCount: number) {
  if (rowCount <= 19) return { text: "text-base print:text-[10px]", pad: "p-1 print:p-0.5", cellH: "h-10 print:h-6" };
  if (rowCount <= 24) return { text: "text-base print:text-[9px]", pad: "p-1 print:p-[2px]", cellH: "h-10 print:h-5" };
  if (rowCount <= 32) return { text: "text-base print:text-[8px]", pad: "p-1 print:p-0", cellH: "h-10 print:h-4" };
  return { text: "text-base print:text-[7px]", pad: "p-1 print:p-0", cellH: "h-10 print:h-3" };
}

// Larguras (%) das colunas fixas (Building/Hours/WO/Name/Staff Number) do
// colgroup. Na quinzenal são o dobro de colunas de dia disputando o mesmo
// espaço — reduz um pouco as fixas pra sobrar mais área pros dias, senão
// eles ficam minúsculos.
function scaleFixedCols(pct: number[], periodType: TimesheetPeriodType): number[] {
  const factor = periodType === "biweekly" ? 2 / 3 : 1;
  return pct.map((p) => p * factor);
}

// As colunas do colgroup são em % — numa tabela `w-full` isso sempre cabe na
// tela, só que espremendo cada coluna até o texto vazar por cima da vizinha
// (era a bagunça vista no celular). O que faz a tabela realmente rolar de
// lado em vez de espremer é ter uma largura MÍNIMA em px maior que a tela —
// as % do colgroup passam a distribuir espaço dentro desse mínimo, não mais
// dentro da tela toda. Só conta pra tela: no print a classe `ts-table`
// zera esse mínimo (ver <style jsx global> no fim do arquivo).
// Hours e WO ganharam mais espaço (60→70 / 60→80) porque um WO de 6 dígitos
// ("514161") ou o cabeçalho "Xh total" não cabiam — vinha de Name (150→130 /
// 130→110), que sobrava de longe.
const FRONT_FIXED_MIN_PX = [70, 70, 80, 130, 90]; // Building, Hours, WO, Name, Staff Number
const BACK_FIXED_MIN_PX = [80, 70, 80, 110, 90]; // Building Covers, Hours, WO, Name, Staff Number
const DAY_COL_MIN_PX = 120; // célula com IN+OUT lado a lado, ~60px cada - "06:00" (5 char) não cabia em 48px
const SPACER_MIN_PX = 8;

function minTableWidthPx(fixedPx: number[], dayCount: number, hasSpacer: boolean): number {
  return fixedPx.reduce((a, b) => a + b, 0) + dayCount * DAY_COL_MIN_PX + (hasSpacer ? SPACER_MIN_PX : 0);
}

export default function LeaderTimesheetView({ teamLeader }: { teamLeader: TeamLeader }) {
  const coverItems = teamLeader.buildings.map((b) => `${b.nome} - WO ${b.workOrder ?? "—"}`);
  const totalFrontRows = teamLeader.buildings.reduce(
    (sum, b) => sum + Math.max(b.cleaners.length, b.slots.length, 1),
    0
  );
  // Total de horas = soma das vagas configuradas de cada prédio (não soma das
  // linhas exibidas, que podem ter horas de staff que não batem com nenhuma vaga).
  const grandTotalHours = teamLeader.buildings.reduce(
    (sum, b) => sum + b.slots.reduce((s, slot) => s + slot.horas, 0),
    0
  );
  const sz = frontTableSizing(totalFrontRows);
  const cell = `border border-ink ${sz.pad}`;
  const signCell = `border border-ink ${sz.pad} ${sz.cellH}`;

  const [hideNames, setHideNames] = useState(false);

  // Modo edição: permite personalizar o nome do prédio (topo) e, por linha,
  // o nome do prédio + WO — só nesta folha impressa. Salvo numa tabela
  // separada (TimesheetSheetOverride, via /api/timesheet-overrides) — nunca
  // escreve em Building/Team, então editar aqui nunca altera o cadastro.
  // As personalizações por prédio (linha/cover) são guardadas por
  // buildingId — as mesmas aparecem se o mesmo prédio for aberto direto em
  // /timesheets/[id].
  const [editMode, setEditMode] = useState(false);
  const [headerNome, setHeaderNome] = useState(teamLeader.buildings.map((b) => b.nome).join(", "));
  // `rowOverrides` agora só guarda o rótulo do prédio quando ele NÃO tem
  // nenhuma linha (scope "empty"). Building/WO das linhas de staff vêm do
  // vínculo (ver sheetEdits abaixo).
  const [rowOverrides, setRowOverrides] = useState<Record<string, { nomePredio: string; wo: string }>>(() => {
    const init: Record<string, { nomePredio: string; wo: string }> = {};
    teamLeader.buildings.forEach((b) => {
      if (buildRows(b).length === 0) {
        init[`${b.id}:empty`] = { nomePredio: b.nome, wo: b.workOrder ?? "" };
      }
    });
    return init;
  });

  // Building/WO por PESSOA (ver StaffBuilding.predioLabel/workOrder) — edições
  // otimistas, keyed pelo sbId, seguem a pessoa em qualquer ordem. `rows` já
  // vem com o valor resolvido do servidor; isto sobrepõe o que está sendo
  // digitado agora.
  const [sheetEdits, setSheetEdits] = useState<Record<string, { predio: string; wo: string }>>({});
  const sheetSaveTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const effPredio = (r: { sbId: string | null; predio: string | null }) =>
    (r.sbId && sheetEdits[r.sbId] ? sheetEdits[r.sbId].predio : r.predio) ?? "";
  const effWo = (r: { sbId: string | null; wo: string | null }) =>
    (r.sbId && sheetEdits[r.sbId] ? sheetEdits[r.sbId].wo : r.wo) ?? "";
  function updateSheet(
    buildingId: string,
    r: { sbId: string | null; predio: string | null; wo: string | null },
    field: "predio" | "wo",
    value: string
  ) {
    if (!r.sbId) return;
    const sbId = r.sbId;
    const current = sheetEdits[sbId] ?? { predio: r.predio ?? "", wo: r.wo ?? "" };
    const next = { ...current, [field]: value };
    setSheetEdits((prev) => ({ ...prev, [sbId]: next }));
    if (sheetSaveTimeouts.current[sbId]) clearTimeout(sheetSaveTimeouts.current[sbId]);
    sheetSaveTimeouts.current[sbId] = setTimeout(() => {
      fetch(`/api/buildings/${buildingId}/staff/sheet`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sbId, predioLabel: next.predio, workOrder: next.wo }),
      }).catch(() => {});
    }, 500);
  }
  const [coverOverrides, setCoverOverrides] = useState<Record<string, { nomePredio: string; wo: string }>>(() => {
    const init: Record<string, { nomePredio: string; wo: string }> = {};
    teamLeader.buildings.forEach((b) => {
      b.covers.forEach((c) => {
        init[c.id] = { nomePredio: b.nome, wo: b.workOrder ?? "" };
      });
    });
    return init;
  });

  const saveTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  function scheduleSaveOverride(debounceKey: string, buildingId: string, scope: string, value: { nomePredio: string; wo: string }) {
    if (saveTimeouts.current[debounceKey]) clearTimeout(saveTimeouts.current[debounceKey]);
    saveTimeouts.current[debounceKey] = setTimeout(() => {
      saveSheetOverride("building", buildingId, scope, value);
    }, 500);
  }
  function scheduleSaveHeader(value: { nomePredio: string; wo: string }) {
    if (saveTimeouts.current["header"]) clearTimeout(saveTimeouts.current["header"]);
    saveTimeouts.current["header"] = setTimeout(() => {
      saveSheetOverride("team", teamLeader.id, "header", value);
    }, 500);
  }

  // Carrega as personalizações salvas (se houver) assim que a folha abre.
  useEffect(() => {
    (async () => {
      const buildingIds = teamLeader.buildings.map((b) => b.id);
      const [buildingRows, teamRows] = await Promise.all([
        fetchSheetOverrides("building", buildingIds),
        fetchSheetOverrides("team", [teamLeader.id]),
      ]);
      const byB = indexSheetOverrides(buildingRows);
      const byT = indexSheetOverrides(teamRows);

      const header = byT[`${teamLeader.id}:header`];
      if (header) setHeaderNome(header.nomePredio ?? teamLeader.buildings.map((b) => b.nome).join(", "));

      setRowOverrides((prev) => {
        const next = { ...prev };
        teamLeader.buildings.forEach((b) => {
          if (buildRows(b).length === 0) {
            const r = byB[`${b.id}:empty`];
            if (r) next[`${b.id}:empty`] = { nomePredio: r.nomePredio ?? b.nome, wo: r.workOrder ?? b.workOrder ?? "" };
          }
        });
        return next;
      });

      setCoverOverrides((prev) => {
        const next = { ...prev };
        teamLeader.buildings.forEach((b) => {
          b.covers.forEach((c) => {
            const r = byB[`${b.id}:cover:${c.id}`];
            if (r) next[c.id] = { nomePredio: r.nomePredio ?? b.nome, wo: r.workOrder ?? b.workOrder ?? "" };
          });
        });
        return next;
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })();
  }, [teamLeader.id]);

  // Molde em branco só na tela — não persiste nada (igual o resto da folha
  // de impressão), então é só um toggle local decidindo quantos dias mostrar.
  const [periodType, setPeriodType] = useState<TimesheetPeriodType>("weekly");
  const DAYS = getTimesheetDayKeys(periodType);
  const hasSpacer = periodType === "biweekly";
  const spacerCount = hasSpacer ? 1 : 0;
  const frontMinWidthPx = minTableWidthPx(FRONT_FIXED_MIN_PX, DAYS.length, hasSpacer);
  const backMinWidthPx = minTableWidthPx(BACK_FIXED_MIN_PX, DAYS.length, hasSpacer);

  const [coversByBuilding, setCoversByBuilding] = useState<Record<string, Cover[]>>(
    Object.fromEntries(teamLeader.buildings.map((b) => [b.id, b.covers]))
  );
  const covers = teamLeader.buildings.flatMap((b) =>
    (coversByBuilding[b.id] ?? []).map((c) => ({
      buildingId: b.id,
      buildingNome: b.nome,
      buildingWorkOrder: b.workOrder,
      cover: c,
    }))
  );
  const backRowCount = covers.length + Math.max(MIN_COVER_ROWS - covers.length, 1) + 12;
  const backSz = backTableSizing(backRowCount);
  const backCell = `border border-ink ${backSz.pad}`;
  const backSignCell = `border border-ink ${backSz.pad} ${backSz.cellH}`;
  const [coverBuildingId, setCoverBuildingId] = useState(teamLeader.buildings[0]?.id ?? "");
  const [coverNome, setCoverNome] = useState("");
  const [coverStaffNumber, setCoverStaffNumber] = useState("");
  const [coverHoras, setCoverHoras] = useState("");
  const [savingCover, setSavingCover] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);

  async function addCover() {
    if (!coverNome.trim() || !coverBuildingId) return;
    setSavingCover(true);
    setCoverError(null);
    try {
      const res = await fetch(`/api/buildings/${coverBuildingId}/covers`, {
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
      setCoversByBuilding((prev) => ({
        ...prev,
        [coverBuildingId]: [...(prev[coverBuildingId] ?? []), created],
      }));
      const coverBuilding = teamLeader.buildings.find((b) => b.id === coverBuildingId);
      setCoverOverrides((prev) => ({
        ...prev,
        [created.id]: { nomePredio: coverBuilding?.nome ?? "", wo: coverBuilding?.workOrder ?? "" },
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

  async function removeCover(buildingId: string, id: string) {
    setCoversByBuilding((prev) => ({
      ...prev,
      [buildingId]: (prev[buildingId] ?? []).filter((c) => c.id !== id),
    }));
    setCoverOverrides((prev) => {
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
    try {
      await fetch(`/api/buildings/${buildingId}/covers/${id}`, { method: "DELETE" });
    } catch {
    }
  }

  return (
    <main className="mx-auto max-w-6xl bg-white px-3 py-6 sm:px-6 sm:py-10 print:max-w-none print:px-8 print:py-4">
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
        <Image src="/logo.jpg" alt="Bidvest Noonan" width={160} height={50} className="h-10 w-auto object-contain print:h-8" />
        <h1 className="text-center font-display text-xl font-bold uppercase tracking-wide text-ink print:text-lg">
          Sign In &amp; Sign Out Book
        </h1>
        <div className="flex min-w-0 items-center gap-6">
          {/* Sempre editável (não precisa clicar em "Edit") — só o nome, não
              mexe no resto da folha. min-w-0 + max-w-full: sem isso, o
              atributo `size` (baseado no tamanho do texto) empurra a
              coluna "auto" do grid pra fora da tela em nomes longos no
              celular — no desktop/impressão continua se ajustando ao texto
              normalmente. */}
          <input
            type="text"
            value={headerNome}
            onChange={(e) => {
              setHeaderNome(e.target.value);
              scheduleSaveHeader({ nomePredio: e.target.value, wo: "" });
            }}
            size={Math.max(headerNome.length, 1)}
            className="min-w-0 max-w-full border-0 bg-transparent font-display text-lg font-bold text-ink outline-none focus:bg-petrolLight print:text-sm"
          />
          <Image src="/logoUCD.png" alt="Client logo" width={56} height={56} className="h-14 w-14 shrink-0 object-contain print:h-10 print:w-10" />
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

        <div className="grid grid-cols-3 gap-x-6 gap-y-1 text-xs print:grid-cols-7 print:gap-x-2 print:gap-y-0 print:text-[9px]">
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
          {hideNames ? " " : teamLeader.nome}
        </span>
      </div>

      <p className="mt-4 text-xs text-ink/40 sm:hidden print:hidden">Swipe the table sideways to see all days →</p>

      <div className="mt-2 -mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0 print:mx-0 print:overflow-visible print:px-0">
      <table
        className={`ts-table w-full table-fixed border-collapse print:mt-2 ${sz.text}`}
        style={{ minWidth: `${frontMinWidthPx}px` }}
      >
        <colgroup>
          {scaleFixedCols([9, 6, 9, 18, 9], periodType).map((w, i) => (
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
            <th rowSpan={2} className={`${cell} align-middle`}>
              <span className="text-[11px] leading-tight print:text-[7px]">{grandTotalHours}h total</span>
            </th>
            <th rowSpan={2} className={`${cell} align-middle`}>WO</th>
            <th rowSpan={2} className={`${cell} align-middle`}>Name</th>
            <th rowSpan={2} className={`${cell} align-middle`}>Staff Number</th>
            {DAYS.map((d, i) => (
              <>
                <th key={d} className={`${cell} text-center`}>
                  {timesheetDayLabel(d)}
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
          {teamLeader.buildings.length === 0 && (
            <tr>
              <td colSpan={5 + DAYS.length + spacerCount} className={`${cell} text-center text-ink/40`}>
                No building assigned to this team leader.
              </td>
            </tr>
          )}
          {teamLeader.buildings.map((b, buildingIndex) => {
            const rows = buildRows(b);
            const spacerRow =
              buildingIndex > 0 ? (
                <tr key={b.id + "-spacer"}>
                  <td colSpan={5 + DAYS.length + spacerCount} className="h-3 border-0"></td>
                </tr>
              ) : null;

            if (rows.length === 0) {
              const emptyKey = `${b.id}:empty`;
              return (
                <>
                  {spacerRow}
                  <tr key={b.id}>
                    <td className={`${cell} text-center font-medium`}>
                      {editMode ? (
                        <input
                          type="text"
                          value={rowOverrides[emptyKey]?.nomePredio ?? ""}
                          onChange={(e) => {
                            const next = {
                              nomePredio: e.target.value,
                              wo: rowOverrides[emptyKey]?.wo ?? b.workOrder ?? "",
                            };
                            setRowOverrides((prev) => ({ ...prev, [emptyKey]: next }));
                            scheduleSaveOverride(emptyKey, b.id, "empty", next);
                          }}
                          className="w-full min-w-0 border-0 bg-transparent p-0 text-center outline-none focus:bg-petrolLight"
                        />
                      ) : (
                        rowOverrides[emptyKey]?.nomePredio ?? b.nome
                      )}
                    </td>
                    <td className={cell}></td>
                    <td className={`${cell} text-center`}>
                      {editMode ? (
                        <input
                          type="text"
                          value={rowOverrides[emptyKey]?.wo ?? ""}
                          onChange={(e) => {
                            const next = {
                              nomePredio: rowOverrides[emptyKey]?.nomePredio ?? b.nome,
                              wo: e.target.value,
                            };
                            setRowOverrides((prev) => ({ ...prev, [emptyKey]: next }));
                            scheduleSaveOverride(emptyKey, b.id, "empty", next);
                          }}
                          className="w-full min-w-0 border-0 bg-transparent p-0 text-center outline-none focus:bg-petrolLight"
                        />
                      ) : (
                        rowOverrides[emptyKey]?.wo ?? (b.workOrder ?? "")
                      )}
                    </td>
                    <td className={`${cell} text-ink/30`} colSpan={2}>
                      no cleaner or slot registered
                    </td>
                    {DAYS.map((d, di) => (
                      <>
                        <SignCell key={d + b.id} className={signCell} textClass={sz.text} />
                        {hasSpacer && di === SPACER_AFTER_INDEX && <td key={d + b.id + "-spacer"} className={SPACER_CLASS}></td>}
                      </>
                    ))}
                  </tr>
                </>
              );
            }

            // Enquanto todas as linhas mostram o mesmo Building/WO (ninguém deu
            // rótulo próprio) a célula fica mesclada igual antes.
            const predios = rows.map(effPredio);
            const wos = rows.map(effWo);
            const buildingAllSame = predios.every((v) => v === predios[0]);
            const woAllSame = wos.every((v) => v === wos[0]);

            return (
              <>
                {spacerRow}
                {rows.map((r, i) => {
                  return (
                  <tr key={b.id + i}>
                    {editMode ? (
                      <td className={`${cell} text-center font-bold align-middle break-words`}>
                        {r.kind === "staff" ? (
                          <input
                            type="text"
                            value={effPredio(r)}
                            placeholder={b.nome}
                            onChange={(e) => updateSheet(b.id, r, "predio", e.target.value)}
                            className="w-full min-w-0 border-0 bg-transparent p-0 text-center font-bold outline-none focus:bg-petrolLight"
                          />
                        ) : (
                          r.predio || b.nome
                        )}
                      </td>
                    ) : buildingAllSame ? (
                      i === 0 && (
                        <td rowSpan={rows.length} className={`${cell} text-center font-bold align-middle break-words`}>
                          {predios[0] || b.nome}
                        </td>
                      )
                    ) : (
                      <td className={`${cell} text-center font-bold align-middle break-words`}>
                        {effPredio(r) || b.nome}
                      </td>
                    )}
                    <td className={`${cell} text-center`}>{r.horas ?? ""}</td>
                    {editMode ? (
                      <td className={`${cell} text-center font-bold align-middle overflow-hidden whitespace-nowrap text-ellipsis`}>
                        {r.kind === "staff" ? (
                          <input
                            type="text"
                            value={effWo(r)}
                            placeholder={b.workOrder ?? ""}
                            onChange={(e) => updateSheet(b.id, r, "wo", e.target.value)}
                            className="w-full min-w-0 border-0 bg-transparent p-0 text-center font-bold outline-none focus:bg-petrolLight"
                          />
                        ) : (
                          r.wo || (b.workOrder ?? "")
                        )}
                      </td>
                    ) : woAllSame ? (
                      i === 0 && (
                        <td rowSpan={rows.length} className={`${cell} text-center font-bold align-middle overflow-hidden whitespace-nowrap text-ellipsis`}>
                          {wos[0] || (b.workOrder ?? "")}
                        </td>
                      )
                    ) : (
                      <td className={`${cell} text-center font-bold align-middle overflow-hidden whitespace-nowrap text-ellipsis`}>
                        {effWo(r) || (b.workOrder ?? "")}
                      </td>
                    )}
                    <td className={cell}>{hideNames ? "" : r.nome ?? ""}</td>
                    <td className={`${cell} text-center`}>{hideNames ? "" : r.staffNumber ?? ""}</td>
                    {DAYS.map((d, di) => (
                      <>
                        <SignCell key={d + b.id + i} className={signCell} textClass={sz.text} />
                        {hasSpacer && di === SPACER_AFTER_INDEX && <td key={d + b.id + i + "-spacer"} className={SPACER_CLASS}></td>}
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
        <div className="mb-2 flex flex-wrap items-center gap-2 print:hidden">
          <select
            value={coverBuildingId}
            onChange={(e) => setCoverBuildingId(e.target.value)}
            className="rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-petrol"
          >
            {teamLeader.buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nome}
              </option>
            ))}
          </select>
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

        <p className="mb-1 text-xs text-ink/40 sm:hidden print:hidden">Swipe the table sideways to see all days →</p>

        <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0 print:mx-0 print:overflow-visible print:px-0">
        <table
          className={`ts-table w-full table-fixed border-collapse ${backSz.text}`}
          style={{ minWidth: `${backMinWidthPx}px` }}
        >
          <colgroup>
            {scaleFixedCols([9, 6, 9, 14, 13], periodType).map((w, i) => (
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
                    {timesheetDayLabel(d)}
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
                      <span className="w-1/2 py-0.5">OUT</span>
                    </div>
                  </th>
                  {hasSpacer && i === SPACER_AFTER_INDEX && <th key={d + "-spacer2"} className={SPACER_CLASS}></th>}
                </>
              ))}
            </tr>
          </thead>
          <tbody>
            {covers.map(({ buildingId, buildingNome, buildingWorkOrder, cover }) => (
              <tr key={cover.id}>
                <td className={`${backSignCell} text-center`}>
                  {editMode ? (
                    <input
                      type="text"
                      value={coverOverrides[cover.id]?.nomePredio ?? ""}
                      onChange={(e) => {
                        const next = {
                          nomePredio: e.target.value,
                          wo: coverOverrides[cover.id]?.wo ?? buildingWorkOrder ?? "",
                        };
                        setCoverOverrides((prev) => ({ ...prev, [cover.id]: next }));
                        scheduleSaveOverride(`cover:${cover.id}`, buildingId, `cover:${cover.id}`, next);
                      }}
                      className="w-full min-w-0 border-0 bg-transparent p-0 text-center outline-none focus:bg-petrolLight"
                    />
                  ) : (
                    coverOverrides[cover.id]?.nomePredio ?? buildingNome
                  )}
                </td>
                <td className={`${backCell} text-center`}>{cover.horas ?? ""}</td>
                <td className={`${backCell} overflow-hidden whitespace-nowrap text-ellipsis text-center`}>
                  {editMode ? (
                    <input
                      type="text"
                      value={coverOverrides[cover.id]?.wo ?? ""}
                      onChange={(e) => {
                        const next = {
                          nomePredio: coverOverrides[cover.id]?.nomePredio ?? buildingNome,
                          wo: e.target.value,
                        };
                        setCoverOverrides((prev) => ({ ...prev, [cover.id]: next }));
                        scheduleSaveOverride(`cover:${cover.id}`, buildingId, `cover:${cover.id}`, next);
                      }}
                      className="w-full min-w-0 border-0 bg-transparent p-0 text-center outline-none focus:bg-petrolLight"
                    />
                  ) : (
                    coverOverrides[cover.id]?.wo ?? (buildingWorkOrder ?? "")
                  )}
                </td>
                <td className={backCell}>
                  <span className="flex items-center justify-between gap-2">
                    {hideNames ? "" : cover.nome ?? ""}
                    <button
                      type="button"
                      onClick={() => removeCover(buildingId, cover.id)}
                      title="Remove cover"
                      className="rounded p-0.5 text-ink/30 hover:text-danger print:hidden"
                    >
                      <X size={12} />
                    </button>
                  </span>
                </td>
                <td className={`${backCell} text-center`}>{hideNames ? "" : cover.staffNumber ?? ""}</td>
                {DAYS.map((d, di) => (
                  <>
                    <SignCell key={d + cover.id} className={backSignCell} textClass={backSz.text} />
                    {hasSpacer && di === SPACER_AFTER_INDEX && <td key={d + cover.id + "-spacer"} className={SPACER_CLASS}></td>}
                  </>
                ))}
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
                const total = 3 + DAYS.length + spacerCount;
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
              {DAYS.map((d, di) => (
                <>
                  <SignCell key={d + "-events"} className={backSignCell} textClass={backSz.text} />
                  {hasSpacer && di === SPACER_AFTER_INDEX && <td key={d + "-events-spacer"} className={SPACER_CLASS}></td>}
                </>
              ))}
            </tr>

            <BlankRow n={4} cell={backCell} signCell={backSignCell} textClass={backSz.text} days={DAYS} spacer={hasSpacer} />
          </tbody>
        </table>
        </div>
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
          .ts-table {
            min-width: 0 !important;
          }
        }
      `}</style>
    </main>
  );
}
