"use client";

import { useState } from "react";
import Image from "next/image";
import { Printer, Plus, X } from "lucide-react";
import { computeOpenSlots, type Slot } from "@/lib/openSlots";
import { getTimesheetDayKeys, timesheetDayLabel, type TimesheetPeriodType } from "@/lib/types";
import StaffSearchInput from "@/components/StaffSearchInput";

type StaffLine = {
  id: string;
  nome: string | null;
  staffNumber: string | null;
  horasSemana: number | null;
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

function buildRows(cleaners: StaffLine[], slots: Slot[]) {
  const rows: { nome: string | null; staffNumber: string | null; horas: number | null }[] = [
    ...cleaners.map((c) => ({ nome: c.nome, staffNumber: c.staffNumber, horas: c.horasSemana })),
    ...computeOpenSlots(slots, cleaners).map((s) => ({ nome: null, staffNumber: null, horas: s.horas })),
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
  // Molde em branco só na tela — não persiste nada (igual o resto da folha
  // de impressão), então é só um toggle local decidindo quantos dias mostrar.
  const [periodType, setPeriodType] = useState<TimesheetPeriodType>("weekly");
  const DAYS = getTimesheetDayKeys(periodType);
  const hasSpacer = periodType === "biweekly";
  const spacerCount = hasSpacer ? 1 : 0;

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
    try {
      await fetch(`/api/buildings/${buildingId}/covers/${id}`, { method: "DELETE" });
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
          <span className="font-display text-lg font-bold text-ink print:text-xs">
            {teamLeader.buildings.map((b) => b.nome).join(", ")}
          </span>
          <Image src="/logoUCD.png" alt="Client logo" width={56} height={56} className="h-14 w-14 shrink-0 object-contain print:h-6 print:w-6" />
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
          {hideNames ? " " : teamLeader.nome}
        </span>
      </div>

      <table className={`mt-6 w-full border-collapse print:mt-2 ${sz.text}`}>
        <thead>
          <tr>
            <th rowSpan={2} className={`${cell} align-middle`}>Building</th>
            <th rowSpan={2} className={`${cell} align-middle`}>{grandTotalHours}h total</th>
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
          <tr>
            <td colSpan={5 + DAYS.length * 2 + spacerCount} className="h-3 border-0"></td>
          </tr>
          {teamLeader.buildings.length === 0 && (
            <tr>
              <td colSpan={5 + DAYS.length * 2 + spacerCount} className={`${cell} text-center text-ink/40`}>
                No building assigned to this team leader.
              </td>
            </tr>
          )}
          {teamLeader.buildings.map((b, buildingIndex) => {
            const rows = buildRows(b.cleaners, b.slots);
            const spacerRow =
              buildingIndex > 0 ? (
                <tr key={b.id + "-spacer"}>
                  <td colSpan={5 + DAYS.length * 2 + spacerCount} className="h-3 border-0"></td>
                </tr>
              ) : null;

            if (rows.length === 0) {
              return (
                <>
                  {spacerRow}
                  <tr key={b.id}>
                    <td className={`${cell} text-center font-medium`}>{b.nome}</td>
                    <td className={cell}></td>
                    <td className={`${cell} text-center`}>{b.workOrder ?? ""}</td>
                    <td className={`${cell} text-ink/30`} colSpan={2}>
                      no cleaner or slot registered
                    </td>
                    {DAYS.map((d, di) => (
                      <>
                        <SignCell key={d + b.id + "-in"} className={signCell} textClass={sz.text} />
                        <SignCell key={d + b.id + "-out"} className={signCell} textClass={sz.text} />
                        {hasSpacer && di === SPACER_AFTER_INDEX && <td key={d + b.id + "-spacer"} className={SPACER_CLASS}></td>}
                      </>
                    ))}
                  </tr>
                </>
              );
            }

            return (
              <>
                {spacerRow}
                {rows.map((r, i) => (
                  <tr key={b.id + i}>
                    {i === 0 && (
                      <td rowSpan={rows.length} className={`${cell} text-center font-bold align-middle`}>
                        {b.nome}
                      </td>
                    )}
                    <td className={`${cell} text-center`}>{r.horas ?? ""}</td>
                    {i === 0 && (
                      <td rowSpan={rows.length} className={`${cell} text-center font-bold align-middle`}>
                        {b.workOrder ?? ""}
                      </td>
                    )}
                    <td className={cell}>{hideNames ? "" : r.nome ?? ""}</td>
                    <td className={`${cell} text-center`}>{hideNames ? "" : r.staffNumber ?? ""}</td>
                    {DAYS.map((d, di) => (
                      <>
                        <SignCell key={d + b.id + i + "-in"} className={signCell} textClass={sz.text} />
                        <SignCell key={d + b.id + i + "-out"} className={signCell} textClass={sz.text} />
                        {hasSpacer && di === SPACER_AFTER_INDEX && <td key={d + b.id + i + "-spacer"} className={SPACER_CLASS}></td>}
                      </>
                    ))}
                  </tr>
                ))}
              </>
            );
          })}
        </tbody>
      </table>

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

        <table className={`w-full border-collapse ${backSz.text}`}>
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
            {covers.map(({ buildingId, buildingNome, buildingWorkOrder, cover }) => (
              <tr key={cover.id}>
                <td className={`${backSignCell} text-center`}>{buildingNome}</td>
                <td className={`${backCell} text-center`}>{cover.horas ?? ""}</td>
                <td className={`${backCell} text-center`}>{buildingWorkOrder ?? ""}</td>
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
                    <SignCell key={d + cover.id + "-in"} className={backSignCell} textClass={backSz.text} />
                    <SignCell key={d + cover.id + "-out"} className={backSignCell} textClass={backSz.text} />
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
              {DAYS.map((d, di) => (
                <>
                  <SignCell key={d + "-events-in"} className={backSignCell} textClass={backSz.text} />
                  <SignCell key={d + "-events-out"} className={backSignCell} textClass={backSz.text} />
                  {hasSpacer && di === SPACER_AFTER_INDEX && <td key={d + "-events-spacer"} className={SPACER_CLASS}></td>}
                </>
              ))}
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
