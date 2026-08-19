"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import StaffRow from "@/components/StaffRow";
import P45ReportChart from "@/components/P45ReportChart";
import { LEAVE_REASON_LABELS, type LeaveReason } from "@/lib/types";
import { downloadStaffListXlsx } from "@/lib/excelExport";
import { buildP45BuildingSlices, buildP45ReportSlices } from "@/lib/p45Report";

type StaffItem = {
  id: string;
  nome: string | null;
  staffNumber: string | null;
  telefone: string | null;
  blockedAt: string | null;
  lastWorkingDay: string | null;
  voluntaryLeave: boolean | null;
  leaveReasons: LeaveReason[];
  leaveReasonNote: string | null;
  lastBuildingName: string | null;
  leDestinationCompany: string | null;
};

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-GB");
}

// "2026-08" -> "August 2026", pro dropdown de mês (nada de digitar — ver
// comentário em cima do <select> abaixo).
function formatMonthLabel(monthValue: string): string {
  const [y, m] = monthValue.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

// Mesma linha resumida usada no subtítulo da lista e (parcialmente) no CSV —
// "Last day <data> · <motivo(s) ou Voluntary>".
function p45Subtitle(s: StaffItem): string | undefined {
  if (!s.lastWorkingDay) return undefined;
  const base = `Last day ${formatDate(s.lastWorkingDay)}`;
  if (s.voluntaryLeave === true) return `${base} · Voluntary`;
  if (s.voluntaryLeave === false && s.leaveReasons.length > 0) {
    return `${base} · ${s.leaveReasons.map((r) => LEAVE_REASON_LABELS[r]).join(", ")}`;
  }
  return base;
}

// Mesma ideia acima, pro status "le" — "Last day <data> · to <empresa>"
// (a empresa é opcional, então some da linha quando não preenchida).
function leSubtitle(s: StaffItem): string | undefined {
  if (!s.lastWorkingDay) return undefined;
  const base = `Last day ${formatDate(s.lastWorkingDay)}`;
  return s.leDestinationCompany ? `${base} · to ${s.leDestinationCompany}` : base;
}

export default function OutrosStatusClient({
  status,
  label,
  initialStaff,
}: {
  status: string;
  label: string;
  initialStaff: StaffItem[];
}) {
  const [list, setList] = useState(initialStaff);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Filtro em duas etapas (só faz sentido no P45): primeiro escolhe o mês
  // — <select> de verdade com os meses que existem na lista, nada de
  // digitar (era um <input type="month"> antes, mas o Safari não desenha
  // um seletor pra ele — vira uma caixa de texto exigindo "YYYY-MM" exato,
  // por isso não funcionava). Depois de escolher o mês, aparecem "Start
  // date"/"End date" pra apertar pra uma semana específica dentro dele.
  const [monthValue, setMonthValue] = useState(""); // "YYYY-MM"
  const [weekFrom, setWeekFrom] = useState("");
  const [weekTo, setWeekTo] = useState("");

  const isP45 = status === "p45";

  const monthOptions = useMemo(() => {
    if (!isP45) return [];
    const set = new Set<string>();
    for (const s of list) {
      if (s.lastWorkingDay) set.add(s.lastWorkingDay.slice(0, 7));
    }
    return [...set].sort().reverse(); // mês mais recente primeiro
  }, [list, isP45]);

  // Limites (1º e último dia) do mês escolhido — usados tanto pra calcular
  // o filtro quanto pro min/max dos campos "week" abaixo, pra não deixar
  // escolher uma data fora do mês selecionado.
  const monthBounds = useMemo(() => {
    if (!monthValue) return null;
    const [y, m] = monthValue.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate(); // dia 0 do mês seguinte = último dia deste
    return { from: `${monthValue}-01`, to: `${monthValue}-${String(lastDay).padStart(2, "0")}` };
  }, [monthValue]);

  const dateRange = useMemo(() => {
    if (!monthBounds) return { from: "", to: "" };
    // Start/End date (opcionais) apertam o intervalo pra uma semana
    // específica dentro do mês escolhido; sem eles, vale o mês inteiro.
    return {
      from: weekFrom || monthBounds.from,
      to: weekTo || monthBounds.to,
    };
  }, [monthBounds, weekFrom, weekTo]);

  const hasDateFilter = isP45 && dateRange.from !== "";

  // Filtra pelo último dia de trabalho (YYYY-MM-DD) — comparação de string
  // funciona porque ISO é lexicograficamente ordenável, sem risco de fuso
  // horário do Date(). Só se aplica ao P45 (único status com
  // lastWorkingDay); os outros status sempre veem a lista inteira.
  const visibleList = useMemo(() => {
    if (!hasDateFilter) return list;
    return list.filter((s) => {
      if (!s.lastWorkingDay) return false;
      const day = s.lastWorkingDay.slice(0, 10);
      return day >= dateRange.from && day <= dateRange.to;
    });
  }, [list, hasDateFilter, dateRange]);

  async function exportXlsx() {
    setExporting(true);
    setExportError(null);
    try {
      const isBlocked = status === "blocked";
      const isLe = status === "le";
      const header = [
        "Name",
        "Staff Number",
        "Phone",
        ...(isBlocked ? ["Blocked since"] : []),
        ...(isLe ? ["Last working day", "Destination company"] : []),
        ...(isP45
          ? ["Last working day", "Left by own choice", "Reason", "Reason details", "Last building"]
          : []),
      ];
      const rows = visibleList.map((s) => [
        s.nome ?? "",
        s.staffNumber ?? "",
        s.telefone ?? "",
        ...(isBlocked ? [formatDate(s.blockedAt) ?? ""] : []),
        ...(isLe ? [formatDate(s.lastWorkingDay) ?? "", s.leDestinationCompany ?? ""] : []),
        ...(isP45
          ? [
              formatDate(s.lastWorkingDay) ?? "",
              s.voluntaryLeave === true ? "Yes" : s.voluntaryLeave === false ? "No" : "",
              s.voluntaryLeave === false
                ? s.leaveReasons.map((r) => LEAVE_REASON_LABELS[r]).join("; ")
                : "",
              s.voluntaryLeave === false ? s.leaveReasonNote ?? "" : "",
              s.lastBuildingName ?? "",
            ]
          : []),
      ]);

      await downloadStaffListXlsx({
        filename: label.toLowerCase().replace(/\s+/g, "-"),
        header,
        rows,
        ...(isP45
          ? {
              reportTitle: "Leaving reasons",
              reportSlices: buildP45ReportSlices(visibleList).slices,
              buildingReport: buildP45BuildingSlices(visibleList),
            }
          : {}),
      });
    } catch (e: any) {
      setExportError(e.message || "Could not export the list");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink/50">
          {hasDateFilter ? `${visibleList.length} of ${list.length} staff on this list.` : `${list.length} staff on this list.`}
        </p>
        <button
          onClick={exportXlsx}
          disabled={visibleList.length === 0 || exporting}
          className="flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink transition hover:border-petrol hover:text-petrol disabled:opacity-50"
        >
          <Download size={14} />
          {exporting ? "Exporting..." : "Export list"}
        </button>
      </div>

      {isP45 && monthOptions.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-ink/50">Last working day —</span>

          <select
            value={monthValue}
            onChange={(e) => {
              setMonthValue(e.target.value);
              // Trocou (ou limpou) o mês: as datas da semana antiga não
              // fazem mais sentido nesse novo mês.
              setWeekFrom("");
              setWeekTo("");
            }}
            className="rounded-md border border-line bg-white px-2 py-1.5 text-sm outline-none focus:border-petrol"
          >
            <option value="">All months</option>
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {formatMonthLabel(m)}
              </option>
            ))}
          </select>

          {monthBounds && (
            <>
              <span className="text-xs text-ink/50">week (optional):</span>
              <input
                type="date"
                value={weekFrom}
                min={monthBounds.from}
                max={weekTo || monthBounds.to}
                onChange={(e) => setWeekFrom(e.target.value)}
                className="rounded-md border border-line bg-white px-2 py-1.5 text-sm outline-none focus:border-petrol"
              />
              <span className="text-xs text-ink/50">to</span>
              <input
                type="date"
                value={weekTo}
                min={weekFrom || monthBounds.from}
                max={monthBounds.to}
                onChange={(e) => setWeekTo(e.target.value)}
                className="rounded-md border border-line bg-white px-2 py-1.5 text-sm outline-none focus:border-petrol"
              />
            </>
          )}

          {hasDateFilter && (
            <button
              type="button"
              onClick={() => {
                setMonthValue("");
                setWeekFrom("");
                setWeekTo("");
              }}
              className="text-xs font-medium text-petrol hover:underline"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {exportError && <p className="mt-2 text-sm text-danger">{exportError}</p>}

      {isP45 && visibleList.length > 0 && (
        <div className="mt-6">
          <P45ReportChart list={visibleList} />
        </div>
      )}

      <div className="mt-4 space-y-2">
        {visibleList.length === 0 && (
          <p className="rounded-md border border-dashed border-line px-4 py-8 text-center text-sm text-ink/50">
            {list.length > 0 ? "No staff match this date range." : `No staff in ${label} yet.`}
          </p>
        )}
        {visibleList.map((s) => (
          <StaffRow
            key={s.id}
            id={s.id}
            nome={s.nome}
            staffNumber={s.staffNumber}
            telefone={s.telefone}
            subtitle={
              status === "blocked" && s.blockedAt
                ? `Blocked on ${formatDate(s.blockedAt)}`
                : status === "p45"
                  ? p45Subtitle(s)
                  : status === "le"
                    ? leSubtitle(s)
                    : undefined
            }
            onDeleted={(id) => setList((prev) => prev.filter((p) => p.id !== id))}
          />
        ))}
      </div>
    </div>
  );
}
