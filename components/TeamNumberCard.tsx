"use client";

import { useState } from "react";
import { Hash, Pencil, Check, X } from "lucide-react";

// Número livre de "Team N" — guardado em Team.number (ver PATCH
// /api/teams/[id]). Editável direto em /teams/[id].
export default function TeamNumberCard({
  teamId,
  initialNumber,
  onSaved,
}: {
  teamId: string;
  initialNumber: number | null;
  onSaved?: (number: number | null) => void;
}) {
  const [number, setNumber] = useState(initialNumber);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialNumber?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    const parsed = value.trim() === "" ? null : Number(value);
    if (parsed !== null && (!Number.isInteger(parsed) || parsed < 0)) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/teams/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: parsed }),
      });
      if (!res.ok) throw new Error();
      setNumber(parsed);
      setEditing(false);
      onSaved?.(parsed);
    } catch {
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1 rounded-md border border-petrol bg-white px-2 py-1.5">
        <Hash size={14} className="text-petrol" />
        <input
          type="number"
          min={0}
          step={1}
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="#"
          className="w-12 border-none bg-transparent text-sm outline-none"
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
        setValue(number?.toString() ?? "");
        setEditing(true);
      }}
      className="flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1.5 text-sm text-ink transition hover:border-petrol"
    >
      <Hash size={14} className="text-petrol" />
      <span>{number !== null ? `Team ${number}` : "Set team #"}</span>
      <Pencil size={12} className="text-ink/30" />
    </button>
  );
}
