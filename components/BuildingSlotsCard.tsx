"use client";

import { useState } from "react";
import { Users, Plus, Minus, Trash2 } from "lucide-react";

type Slot = { id: string; horas: number };
type Group = { horas: number; ids: string[] };

function groupSlots(slots: Slot[]): Group[] {
  const map = new Map<number, string[]>();
  for (const s of slots) {
    const arr = map.get(s.horas) ?? [];
    arr.push(s.id);
    map.set(s.horas, arr);
  }
  return Array.from(map.entries())
    .map(([horas, ids]) => ({ horas, ids }))
    .sort((a, b) => a.horas - b.horas);
}

export default function BuildingSlotsCard({
  buildingId,
  initialSlots,
}: {
  buildingId: string;
  initialSlots: Slot[];
}) {
  const [slots, setSlots] = useState(initialSlots);
  const [newHoras, setNewHoras] = useState("");
  const [newQuantidade, setNewQuantidade] = useState("1");
  const [saving, setSaving] = useState(false);

  const groups = groupSlots(slots);

  async function addSlots(horas: number, quantidade: number) {
    if (!horas || horas <= 0 || !quantidade || quantidade <= 0) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/buildings/${buildingId}/slots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ horas, quantidade }),
      });
      if (!res.ok) throw new Error();
      const created = await res.json();
      setSlots((prev) => [...prev, ...created]);
    } catch {
    } finally {
      setSaving(false);
    }
  }

  async function removeOne(group: Group) {
    const id = group.ids[group.ids.length - 1];
    setSlots((prev) => prev.filter((s) => s.id !== id));
    try {
      await fetch(`/api/buildings/${buildingId}/slots/${id}`, { method: "DELETE" });
    } catch {
    }
  }

  async function removeGroup(group: Group) {
    setSlots((prev) => prev.filter((s) => !group.ids.includes(s.id)));
    try {
      await Promise.all(
        group.ids.map((id) => fetch(`/api/buildings/${buildingId}/slots/${id}`, { method: "DELETE" }))
      );
    } catch {
    }
  }

  async function handleAddSubmit() {
    await addSlots(Number(newHoras.replace(",", ".")), Number(newQuantidade) || 1);
    setNewHoras("");
    setNewQuantidade("1");
  }

  return (
    <div className="rounded-md border border-line bg-white p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-ink">
        <Users size={16} className="text-petrol" />
        Building's fixed slots
        <span className="font-normal text-ink/40">
          ({slots.length} total — independent of who's assigned today)
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-md bg-surface p-3">
        <input
          type="number"
          min={1}
          value={newQuantidade}
          onChange={(e) => setNewQuantidade(e.target.value)}
          className="w-16 rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-petrol"
        />
        <span className="text-sm text-ink/60">slot(s) of</span>
        <input
          type="number"
          min={1}
          step={0.25}
          value={newHoras}
          onChange={(e) => setNewHoras(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddSubmit()}
          placeholder="h"
          className="w-16 rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-petrol"
        />
        <span className="text-sm text-ink/60">hours each</span>
        <button
          onClick={handleAddSubmit}
          disabled={saving}
          className="flex items-center gap-1 rounded-md bg-petrol px-3 py-1.5 text-sm font-medium text-white hover:bg-petrolDark disabled:opacity-50"
        >
          <Plus size={14} />
          Add
        </button>
      </div>

      {groups.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {groups.map((g) => (
            <div
              key={g.horas}
              className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-sm"
            >
              <span className="font-medium text-ink">
                {g.ids.length} slot{g.ids.length !== 1 ? "s" : ""} of {g.horas}h
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => removeOne(g)}
                  title="Remove one slot from this group"
                  className="rounded p-1 text-ink/40 hover:bg-white hover:text-danger"
                >
                  <Minus size={14} />
                </button>
                <button
                  onClick={() => addSlots(g.horas, 1)}
                  title="Add one more slot to this group"
                  className="rounded p-1 text-ink/40 hover:bg-white hover:text-petrol"
                >
                  <Plus size={14} />
                </button>
                <button
                  onClick={() => removeGroup(g)}
                  title="Remove all slots in this group"
                  className="rounded p-1 text-ink/40 hover:bg-white hover:text-danger"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
