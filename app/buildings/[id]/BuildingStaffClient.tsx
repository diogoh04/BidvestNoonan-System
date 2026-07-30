"use client";

import { useState } from "react";
import { Clock, Pencil, Check, X } from "lucide-react";
import StaffRow from "@/components/StaffRow";
import StaffHoursCard from "@/components/StaffHoursCard";
import { computeOpenSlots, type Slot } from "@/lib/openSlots";

type StaffItem = {
  id: string;
  nome: string | null;
  staffNumber: string | null;
  telefone: string | null;
  horasSemana?: number | null;
};

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

  // Maior número de horas primeiro, igual já é feito na folha de ponto.
  const sortedList = [...list].sort((a, b) => (b.horasSemana ?? 0) - (a.horasSemana ?? 0));
  const openSlots = initialSlots ? computeOpenSlots(slots, sortedList) : [];

  async function saveSlotHours(slotId: string) {
    const horas = Number(editValue.replace(",", "."));
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
      {sortedList.map((s, i) => (
        <div key={s.id} className="flex items-start gap-2">
          <span className="mt-3 w-5 shrink-0 text-center font-mono text-xs text-ink/40">{i + 1}</span>
          <div className="flex-1">
            <StaffRow
              id={s.id}
              nome={s.nome}
              staffNumber={s.staffNumber}
              telefone={s.telefone}
              buildingId={buildingId}
              onDeleted={(id) => setList((prev) => prev.filter((p) => p.id !== id))}
            />
          </div>
          <StaffHoursCard
            staffId={s.id}
            initialHours={s.horasSemana ?? null}
            buildingId={buildingId}
            onSaved={(horas) =>
              setList((prev) => prev.map((p) => (p.id === s.id ? { ...p, horasSemana: horas } : p)))
            }
          />
        </div>
      ))}

      {openSlots.map((slot, i) => (
        <div
          key={slot.id}
          className="flex items-center justify-between gap-2 rounded-md border border-dashed border-line bg-surface px-4 py-3"
        >
          <span className="flex items-center gap-2 text-sm text-ink/40">
            <span className="w-5 shrink-0 text-center font-mono text-xs">{sortedList.length + i + 1}</span>
            Vaga em aberto
          </span>

          {editingSlotId === slot.id ? (
            <span className="flex items-center gap-1 rounded-md border border-petrol bg-white px-2 py-1.5 text-xs">
              <input
                type="number"
                min={1}
                step={0.25}
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
