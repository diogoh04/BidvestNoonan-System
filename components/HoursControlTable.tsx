"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Check, X } from "lucide-react";

type Row = { id: string; nome: string; horasDisponiveis: number | null; hoursSpent: number | null };
type EditingCell = { buildingId: string; field: "ucd" | "spent" } | null;

// UCD Hours aqui é o MESMO campo Building.horasDisponiveis editado em
// /buildings/[id] (BuildingHoursCard) — salvar aqui muda lá também, é o
// mesmo dado. Hours Spent é o lançamento semanal novo (BuildingHoursLog,
// ver /api/buildings/[id]/hours-log), específico da semana escolhida.
export default function HoursControlTable({ weekStart, rows: initialRows }: { weekStart: string; rows: Row[] }) {
  const [rows, setRows] = useState(initialRows);
  const [editing, setEditing] = useState<EditingCell>(null);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  function startEdit(buildingId: string, field: "ucd" | "spent", current: number | null) {
    setEditing({ buildingId, field });
    setValue(current?.toString() ?? "");
  }

  async function save() {
    if (!editing) return;
    const parsed = value.trim() === "" ? null : Number(value.replace(",", "."));
    if (parsed !== null && (isNaN(parsed) || parsed < 0)) return;

    setSaving(true);
    try {
      if (editing.field === "ucd") {
        const res = await fetch(`/api/buildings/${editing.buildingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ horasDisponiveis: parsed }),
        });
        if (!res.ok) throw new Error();
        setRows((prev) => prev.map((r) => (r.id === editing.buildingId ? { ...r, horasDisponiveis: parsed } : r)));
      } else {
        if (parsed === null) {
          setEditing(null);
          return;
        }
        const res = await fetch(`/api/buildings/${editing.buildingId}/hours-log`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weekStart, hoursSpent: parsed }),
        });
        if (!res.ok) throw new Error();
        setRows((prev) => prev.map((r) => (r.id === editing.buildingId ? { ...r, hoursSpent: parsed } : r)));
      }
      setEditing(null);
    } catch {
    } finally {
      setSaving(false);
    }
  }

  function Cell({ buildingId, field, current }: { buildingId: string; field: "ucd" | "spent"; current: number | null }) {
    const isEditing = editing?.buildingId === buildingId && editing.field === field;
    if (isEditing) {
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-petrol bg-white px-2 py-1">
          <input
            type="number"
            min={0}
            step={0.25}
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            className="w-16 border-none bg-transparent text-sm outline-none"
          />
          <button onClick={save} disabled={saving} className="text-petrol hover:text-petrolDark">
            <Check size={13} />
          </button>
          <button onClick={() => setEditing(null)} className="text-ink/40 hover:text-ink">
            <X size={13} />
          </button>
        </span>
      );
    }
    return (
      <button
        onClick={() => startEdit(buildingId, field, current)}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-ink transition hover:bg-surface"
      >
        {current ?? "—"}
        <Pencil size={11} className="text-ink/30" />
      </button>
    );
  }

  const totalUcd = rows.reduce((sum, r) => sum + (r.horasDisponiveis ?? 0), 0);
  const totalSpent = rows.reduce((sum, r) => sum + (r.hoursSpent ?? 0), 0);
  const totalBalance = totalUcd - totalSpent;

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="text-left text-xs uppercase tracking-wide text-ink/40">
          <th className="border-b border-line px-3 py-2 font-medium">Building</th>
          <th className="border-b border-line px-3 py-2 font-medium">UCD Hours</th>
          <th className="border-b border-line px-3 py-2 font-medium">Hours Spent</th>
          <th className="border-b border-line px-3 py-2 font-medium">Balance</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={4} className="px-3 py-6 text-center text-ink/40">
              No building allocated to this team yet.
            </td>
          </tr>
        )}
        {rows.map((r) => {
          const balance = r.horasDisponiveis != null && r.hoursSpent != null ? r.horasDisponiveis - r.hoursSpent : null;
          return (
            <tr key={r.id} className="border-b border-line/60">
              <td className="px-3 py-2">
                <Link href={`/buildings/${r.id}`} className="font-medium text-ink hover:text-petrol hover:underline">
                  {r.nome}
                </Link>
              </td>
              <td className="px-3 py-2">
                <Cell buildingId={r.id} field="ucd" current={r.horasDisponiveis} />
              </td>
              <td className="px-3 py-2">
                <Cell buildingId={r.id} field="spent" current={r.hoursSpent} />
              </td>
              <td className="px-3 py-2">
                {balance === null ? (
                  <span className="text-ink/30">—</span>
                ) : (
                  <span className={`font-medium ${balance < 0 ? "text-danger" : "text-success"}`}>
                    {balance < 0 ? `Short ${Math.abs(balance)}h` : `Surplus ${balance}h`}
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
      {rows.length > 0 && (
        <tfoot>
          <tr className="font-medium">
            <td className="px-3 py-2 text-ink/50">Total</td>
            <td className="px-3 py-2">{totalUcd}h</td>
            <td className="px-3 py-2">{totalSpent}h</td>
            <td className="px-3 py-2">
              <span className={totalBalance < 0 ? "text-danger" : "text-success"}>
                {totalBalance < 0 ? `Short ${Math.abs(totalBalance)}h` : `Surplus ${totalBalance}h`}
              </span>
            </td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}
