"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Check, X } from "lucide-react";

type Row = { id: string; nome: string; ucdHours: number | null; available: number | null; hoursSpent: number | null };

// UCD Hours e Building Hours são só leitura aqui — são editados em
// /buildings/[id] e /teams/[id] (UcdHoursCard e BuildingHoursCard,
// respectivamente). UCD Hours já é o valor congelado daquela semana
// (BuildingHoursLog.ucdHours), não o valor ao vivo do prédio — ver
// comentário no schema.prisma; Building Hours sempre mostra o valor ao vivo
// (não tem snapshot por semana, é só informativo aqui). Hours Spent é o
// único campo editável nesta tela, específico da semana escolhida.
// O Balance compara Building Hours (o que foi de fato liberado pro team
// leader) contra o gasto — não o orçamento da UCD, que é só a origem do
// recurso (ver highlight vermelho no Building Hours quando ultrapassa UCD).
export default function HoursControlTable({ weekStart, rows: initialRows }: { weekStart: string; rows: Row[] }) {
  const [rows, setRows] = useState(initialRows);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  function startEdit(buildingId: string, current: number | null) {
    setEditingId(buildingId);
    setValue(current?.toString() ?? "");
  }

  async function save(buildingId: string) {
    const parsed = value.trim() === "" ? null : Number(value.replace(",", "."));
    if (parsed === null || isNaN(parsed) || parsed < 0) {
      setEditingId(null);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/buildings/${buildingId}/hours-log`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart, hoursSpent: parsed }),
      });
      if (!res.ok) throw new Error();
      const saved = await res.json();
      setRows((prev) => prev.map((r) => (r.id === buildingId ? { ...r, hoursSpent: parsed, ucdHours: saved.ucdHours ?? r.ucdHours } : r)));
      setEditingId(null);
    } catch {
    } finally {
      setSaving(false);
    }
  }

  const totalUcd = rows.reduce((sum, r) => sum + (r.ucdHours ?? 0), 0);
  const totalAvailable = rows.reduce((sum, r) => sum + (r.available ?? 0), 0);
  const totalSpent = rows.reduce((sum, r) => sum + (r.hoursSpent ?? 0), 0);
  const totalBalance = totalAvailable - totalSpent;
  const totalOverUcd = totalAvailable > totalUcd;

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="text-left text-xs uppercase tracking-wide text-ink/40">
          <th className="border-b border-line px-3 py-2 font-medium">Building</th>
          <th className="border-b border-line px-3 py-2 font-medium">UCD Hours</th>
          <th className="border-b border-line px-3 py-2 font-medium">Building Hours</th>
          <th className="border-b border-line px-3 py-2 font-medium">Hours Spent</th>
          <th className="border-b border-line px-3 py-2 font-medium">Balance</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={5} className="px-3 py-6 text-center text-ink/40">
              No building allocated to this team yet.
            </td>
          </tr>
        )}
        {rows.map((r) => {
          const balance = r.available != null && r.hoursSpent != null ? r.available - r.hoursSpent : null;
          const ucdBalance = r.ucdHours != null && r.available != null ? r.ucdHours - r.available : null;
          const overUcd = ucdBalance != null && ucdBalance < 0;
          const isEditing = editingId === r.id;
          return (
            <tr key={r.id} className="border-b border-line/60">
              <td className="px-3 py-2">
                <Link href={`/buildings/${r.id}`} className="font-medium text-ink hover:text-petrol hover:underline">
                  {r.nome}
                </Link>
              </td>
              <td className="px-3 py-2 text-ink/70">{r.ucdHours ?? "—"}</td>
              <td className="px-3 py-2">
                <div className={overUcd ? "font-semibold text-danger" : "text-ink/70"}>{r.available ?? "—"}</div>
                {ucdBalance != null && (
                  <div className={`text-xs font-medium ${ucdBalance < 0 ? "text-danger" : "text-success"}`}>
                    {ucdBalance < 0 ? `Short ${Math.abs(ucdBalance)}h` : `Surplus ${ucdBalance}h`}
                  </div>
                )}
              </td>
              <td className="px-3 py-2">
                {isEditing ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-petrol bg-white px-2 py-1">
                    <input
                      type="number"
                      min={0}
                      step={0.25}
                      autoFocus
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && save(r.id)}
                      className="w-16 border-none bg-transparent text-sm outline-none"
                    />
                    <button onClick={() => save(r.id)} disabled={saving} className="text-petrol hover:text-petrolDark">
                      <Check size={13} />
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-ink/40 hover:text-ink">
                      <X size={13} />
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => startEdit(r.id, r.hoursSpent)}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-ink transition hover:bg-surface"
                  >
                    {r.hoursSpent ?? "—"}
                    <Pencil size={11} className="text-ink/30" />
                  </button>
                )}
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
            <td className={`px-3 py-2 ${totalOverUcd ? "text-danger" : ""}`}>{totalAvailable}h</td>
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
