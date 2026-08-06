"use client";

import { useState } from "react";
import { Clock, Pencil, Check, X } from "lucide-react";

export default function StaffHoursCard({
  staffId,
  initialHours,
  buildingId,
  role,
  onSaved,
}: {
  staffId: string;
  initialHours: number | null;
  buildingId?: string;
  // Papel deste vínculo ("cleaner" | "team_leader") — necessário quando o
  // staff tem dois vínculos no mesmo prédio, cada um com suas horas.
  role?: "cleaner" | "team_leader";
  onSaved?: (horas: number | null) => void;
}) {
  const [hours, setHours] = useState(initialHours);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialHours?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    const parsed = value.trim() === "" ? null : Number(value.replace(",", "."));
    if (parsed !== null && (isNaN(parsed) || parsed < 0)) return;

    setSaving(true);
    try {
      const url = buildingId
        ? `/api/buildings/${buildingId}/staff/${staffId}/hours`
        : `/api/staff/${staffId}/hours`;

      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ horasSemana: parsed, role }),
      });
      if (!res.ok) throw new Error();
      setHours(parsed);
      setEditing(false);
      onSaved?.(parsed);
    } catch {
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="flex shrink-0 items-center gap-1 rounded-md border border-petrol bg-white px-2 py-1.5">
        <Clock size={13} className="text-petrol" />
        <input
          type="number"
          min={0}
          step={0.25}
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="h"
          className="w-12 border-none bg-transparent text-xs outline-none"
        />
        <button onClick={save} disabled={saving} className="text-petrol hover:text-petrolDark">
          <Check size={13} />
        </button>
        <button onClick={() => setEditing(false)} className="text-ink/40 hover:text-ink">
          <X size={13} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        setValue(hours?.toString() ?? "");
        setEditing(true);
      }}
      className="flex shrink-0 items-center gap-1 rounded-md border border-line bg-white px-2.5 py-1.5 text-xs text-ink transition hover:border-petrol"
    >
      <Clock size={13} className="text-petrol" />
      <span>{hours !== null ? `${hours}h/wk` : "set hrs"}</span>
      <Pencil size={11} className="text-ink/30" />
    </button>
  );
}
