"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import StaffRow from "@/components/StaffRow";
import P45ReportChart from "@/components/P45ReportChart";
import { LEAVE_REASON_LABELS, type LeaveReason } from "@/lib/types";

type StaffItem = {
  id: string;
  nome: string | null;
  staffNumber: string | null;
  telefone: string | null;
  blockedAt: string | null;
  lastWorkingDay: string | null;
  voluntaryLeave: boolean | null;
  leaveReason: LeaveReason | null;
  leaveReasonNote: string | null;
};

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-GB");
}

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

// Mesma linha resumida usada no subtítulo da lista e (parcialmente) no CSV —
// "Last day <data> · <motivo ou Voluntary>".
function p45Subtitle(s: StaffItem): string | undefined {
  if (!s.lastWorkingDay) return undefined;
  const base = `Last day ${formatDate(s.lastWorkingDay)}`;
  if (s.voluntaryLeave === true) return `${base} · Voluntary`;
  if (s.voluntaryLeave === false && s.leaveReason) return `${base} · ${LEAVE_REASON_LABELS[s.leaveReason]}`;
  return base;
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

  function exportCsv() {
    const isBlocked = status === "blocked";
    const isP45 = status === "p45";
    const header = [
      "Name",
      "Staff Number",
      "Phone",
      ...(isBlocked ? ["Blocked since"] : []),
      ...(isP45 ? ["Last working day", "Left by own choice", "Reason", "Reason details"] : []),
    ];
    const rows = list.map((s) => [
      s.nome ?? "",
      s.staffNumber ?? "",
      s.telefone ?? "",
      ...(isBlocked ? [formatDate(s.blockedAt) ?? ""] : []),
      ...(isP45
        ? [
            formatDate(s.lastWorkingDay) ?? "",
            s.voluntaryLeave === true ? "Yes" : s.voluntaryLeave === false ? "No" : "",
            s.voluntaryLeave === false && s.leaveReason ? LEAVE_REASON_LABELS[s.leaveReason] : "",
            s.voluntaryLeave === false && s.leaveReason === "other" ? s.leaveReasonNote ?? "" : "",
          ]
        : []),
    ]);
    const csv = [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${label.toLowerCase().replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink/50">
          {list.length} staff on this list.
        </p>
        <button
          onClick={exportCsv}
          disabled={list.length === 0}
          className="flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink transition hover:border-petrol hover:text-petrol disabled:opacity-50"
        >
          <Download size={14} />
          Export list
        </button>
      </div>

      {status === "p45" && list.length > 0 && (
        <div className="mt-6">
          <P45ReportChart list={list} />
        </div>
      )}

      <div className="mt-4 space-y-2">
        {list.length === 0 && (
          <p className="rounded-md border border-dashed border-line px-4 py-8 text-center text-sm text-ink/50">
            No staff in {label} yet.
          </p>
        )}
        {list.map((s) => (
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
                  : undefined
            }
            onDeleted={(id) => setList((prev) => prev.filter((p) => p.id !== id))}
          />
        ))}
      </div>
    </div>
  );
}
