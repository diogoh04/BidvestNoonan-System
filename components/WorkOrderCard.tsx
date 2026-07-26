"use client";

import { useState } from "react";
import { FileText, Pencil, Check, X } from "lucide-react";

export default function WorkOrderCard({
  buildingId,
  initialWorkOrder,
}: {
  buildingId: string;
  initialWorkOrder: string | null;
}) {
  const [wo, setWo] = useState(initialWorkOrder);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialWorkOrder ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    const trimmed = value.trim();
    setSaving(true);
    try {
      const res = await fetch(`/api/buildings/${buildingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workOrder: trimmed === "" ? null : trimmed }),
      });
      if (!res.ok) throw new Error();
      setWo(trimmed === "" ? null : trimmed);
      setEditing(false);
    } catch {
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1 rounded-md border border-petrol bg-white px-2 py-1.5">
        <FileText size={14} className="text-petrol" />
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="WO"
          className="w-24 border-none bg-transparent text-sm outline-none"
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
        setValue(wo ?? "");
        setEditing(true);
      }}
      className="flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1.5 text-sm text-ink transition hover:border-petrol"
    >
      <FileText size={14} className="text-petrol" />
      <span>{wo ? `WO ${wo}` : "Definir WO"}</span>
      <Pencil size={12} className="text-ink/30" />
    </button>
  );
}
