"use client";

import { useState } from "react";
import { GraduationCap, Pencil, Check, X } from "lucide-react";

// Irmão do BuildingHoursCard, mas edita Building.ucdHours em vez de
// horasDisponiveis — ver comentário no schema.prisma sobre a diferença dos
// dois campos (UCD Hours é o que a faculdade libera; horasDisponiveis/
// "available" é o que a gente repassa pro team leader).
export default function UcdHoursCard({
  buildingId,
  initialHours,
}: {
  buildingId: string;
  initialHours: number | null;
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
      const res = await fetch(`/api/buildings/${buildingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ucdHours: parsed }),
      });
      if (!res.ok) throw new Error();
      setHours(parsed);
      setEditing(false);
    } catch {
      // mantém em edição se falhar
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1 rounded-md border border-petrol bg-white px-2 py-1.5">
        <GraduationCap size={14} className="text-petrol" />
        <input
          type="number"
          min={0}
          step={0.25}
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="h"
          className="w-14 border-none bg-transparent text-sm outline-none"
        />
        <button onClick={save} disabled={saving} className="text-petrol hover:text-petrolDark">
          <Check size={14} />
        </button>
        <button onClick={() => setEditing(false)} className="text-ink/40 hover:text-ink">
          <X size={14} />
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
      className="flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1.5 text-sm text-ink transition hover:border-petrol"
    >
      <GraduationCap size={14} className="text-petrol" />
      <span>{hours !== null ? `${hours}h UCD` : "Set UCD hours"}</span>
      <Pencil size={12} className="text-ink/30" />
    </button>
  );
}
