"use client";

import { useState } from "react";
import { Clock, Pencil, Check, X } from "lucide-react";
import StaffRow from "@/components/StaffRow";
import StaffHoursCard from "@/components/StaffHoursCard";

type StaffItem = {
  id: string;
  nome: string | null;
  staffNumber: string | null;
  telefone: string | null;
  horasSemana?: number | null;
};

type Slot = { id: string; horas: number };

export default function BuildingStaffClient({
  staff,
  emptyLabel,
  slots: initialSlots,
  buildingId,
}: {
  staff: StaffItem[];
  emptyLabel: string;
  slots?: Slot[];
  buildingId?: string;
}) {
  const [list, setList] = useState(staff);
  const [slots, setSlots] = useState(initialSlots ?? []);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const openSlots = initialSlots ? slots.slice(list.length) : [];

  async function saveSlotHours(slotId: string) {
    const horas = Number(editValue);
    if (!horas || horas <= 0 || !buildingId) {
      setEditingSlotId(null);
      return;
    }
    try {
      const res = await fetch(`/api/buildings/${buildingId}/slots/${slotId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ horas }),
      });
      if (!res.ok) throw new Error();
      setSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, horas } : s)));
    } catch {
    } finally {
      setEditingSlotId(null);
    }
  }

  if (list.length === 0 && openSlots.length === 0) {
    return <p className="text-sm text-ink/40">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-2">
      {list.map((s) => (
        <div key={s.id} className="flex items-start gap-2">
          <div className="flex-1">
            <StaffRow
              id={s.id}
              nome={s.nome}
              staffNumber={s.staffNumber}
              telefone={s.telefone}
              onDeleted={(id) => setList((prev) => prev.filter((p) => p.id !== id))}
            />
          </div>
          <StaffHoursCard staffId={s.id} initialHours={s.horasSemana ?? null} buildingId={buildingId} />
        </div>
      ))}

      {openSlots.map((slot) => (
        <div
          key={slot.id}
          className="flex items-center justify-between rounded-md border border-dashed border-line bg-surface px-4 py-3"
        >
          <span className="text-sm text-ink/40">Vaga em aberto</span>

          {editingSlotId === slot.id ? (
            <span className="flex items-center gap-1 rounded-md border border-petrol bg-white px-2 py-1.5 text-xs">
              <input
                type="number"
                min={1}
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveSlotHours(slot.id)}
                className="w-14 border-none bg-transparent text-ink outline-none"
              />
              <span className="text-ink/50">h/sem</span>
              <button onClick={() => saveSlotHours(slot.id)} className="text-petrol hover:text-petrolDark">
                <Check size={14} />
              </button>
              <button onClick={() => setEditingSlotId(null)} className="text-ink/40 hover:text-ink">
                <X size={14} />
              </button>
            </span>
          ) : (
            <button
              onClick={() => {
                setEditingSlotId(slot.id);
                setEditValue(slot.horas.toString());
              }}
              className="flex items-center gap-1 rounded-md border border-line bg-white px-2.5 py-1.5 text-xs text-ink/60 hover:border-petrol hover:text-petrol"
            >
              <Clock size={13} />
              {slot.horas}h/sem
              <Pencil size={12} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
