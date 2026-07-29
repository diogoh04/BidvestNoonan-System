"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import StaffRow from "@/components/StaffRow";

type StaffItem = {
  id: string;
  nome: string | null;
  staffNumber: string | null;
  telefone: string | null;
  blockedAt: string | null;
};

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("pt-BR");
}

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
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
    const header = ["Nome", "Staff Number", "Telefone", ...(isBlocked ? ["Bloqueado desde"] : [])];
    const rows = list.map((s) => [
      s.nome ?? "",
      s.staffNumber ?? "",
      s.telefone ?? "",
      ...(isBlocked ? [formatDate(s.blockedAt) ?? ""] : []),
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
          {list.length} staff nessa lista.
        </p>
        <button
          onClick={exportCsv}
          disabled={list.length === 0}
          className="flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink transition hover:border-petrol hover:text-petrol disabled:opacity-50"
        >
          <Download size={14} />
          Exportar lista
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {list.length === 0 && (
          <p className="rounded-md border border-dashed border-line px-4 py-8 text-center text-sm text-ink/50">
            Nenhum staff em {label} ainda.
          </p>
        )}
        {list.map((s) => (
          <StaffRow
            key={s.id}
            id={s.id}
            nome={s.nome}
            staffNumber={s.staffNumber}
            telefone={s.telefone}
            subtitle={status === "blocked" && s.blockedAt ? `Bloqueado em ${formatDate(s.blockedAt)}` : undefined}
            onDeleted={(id) => setList((prev) => prev.filter((p) => p.id !== id))}
          />
        ))}
      </div>
    </div>
  );
}
