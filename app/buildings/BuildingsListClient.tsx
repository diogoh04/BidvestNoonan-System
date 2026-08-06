"use client";

import { useState } from "react";
import Link from "next/link";
import { Users, ChevronRight, Plus, Pencil, Trash2, Check, X } from "lucide-react";

type Building = {
  id: string;
  nome: string;
  totalCleaners: number;
  totalTeamLeaders: number;
};

export default function BuildingsListClient({ initialBuildings }: { initialBuildings: Building[] }) {
  const [buildings, setBuildings] = useState(initialBuildings);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  const query = newName.trim().toLowerCase();
  const filteredBuildings = query
    ? buildings.filter((b) => b.nome.toLowerCase().includes(query))
    : buildings;
  const showAddButton = query !== "" && filteredBuildings.length === 0;

  async function addBuilding() {
    if (!newName.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/buildings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: newName.trim() }),
      });
      if (!res.ok) throw new Error("Could not create (name already exists?)");
      const created = await res.json();
      setBuildings((prev) =>
        [...prev, { ...created, totalCleaners: 0, totalTeamLeaders: 0 }].sort((a, b) =>
          a.nome.localeCompare(b.nome)
        )
      );
      setNewName("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAdding(false);
    }
  }

  function startEdit(b: Building) {
    setEditingId(b.id);
    setEditValue(b.nome);
  }

  async function saveEdit(id: string) {
    if (!editValue.trim()) return;
    try {
      const res = await fetch(`/api/buildings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: editValue.trim() }),
      });
      if (!res.ok) throw new Error("Could not rename (name already exists?)");
      setBuildings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, nome: editValue.trim() } : b))
      );
      setEditingId(null);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function deleteBuilding(id: string) {
    try {
      const res = await fetch(`/api/buildings/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setBuildings((prev) => prev.filter((b) => b.id !== id));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setConfirmingDeleteId(null);
    }
  }

  return (
    <div>
      <div className="mt-6 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && showAddButton && addBuilding()}
          placeholder="Search or add building"
          className="flex-1 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-petrol"
        />
        {showAddButton && (
          <button
            onClick={addBuilding}
            disabled={adding}
            className="flex items-center gap-2 rounded-md bg-petrol px-4 py-2 text-sm font-medium text-white hover:bg-petrolDark disabled:opacity-50"
          >
            <Plus size={16} />
            Add building
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      <div className="mt-6 space-y-2">
        {filteredBuildings.map((b) => (
          <div
            key={b.id}
            className="flex items-center justify-between rounded-md border border-line bg-white px-4 py-3"
          >
            {editingId === b.id ? (
              <div className="flex flex-1 items-center gap-2">
                <input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveEdit(b.id)}
                  className="flex-1 rounded-md border border-petrol px-2 py-1.5 text-sm outline-none"
                />
                <button onClick={() => saveEdit(b.id)} className="text-petrol hover:text-petrolDark">
                  <Check size={18} />
                </button>
                <button onClick={() => setEditingId(null)} className="text-ink/40 hover:text-ink">
                  <X size={18} />
                </button>
              </div>
            ) : confirmingDeleteId === b.id ? (
              <div className="flex flex-1 items-center justify-between gap-3">
                <span className="text-sm text-danger">
                  Delete {b.nome}? This removes staff assignments to this building.
                </span>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => deleteBuilding(b.id)}
                    className="rounded-md bg-danger px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmingDeleteId(null)}
                    className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-surface"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <Link href={`/buildings/${b.id}`} className="flex-1">
                  <div className="font-medium text-ink">{b.nome}</div>
                  <div className="mt-0.5 flex items-center gap-1 font-mono text-xs text-petrol">
                    <Users size={12} />
                    {b.totalCleaners} cleaner(s) · {b.totalTeamLeaders} team leader(s)
                  </div>
                </Link>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => startEdit(b)}
                    title="Rename"
                    className="rounded-md p-2 text-ink/50 hover:bg-petrolLight hover:text-petrol"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => setConfirmingDeleteId(b.id)}
                    title="Delete"
                    className="rounded-md p-2 text-ink/50 hover:bg-red-50 hover:text-danger"
                  >
                    <Trash2 size={16} />
                  </button>
                  <Link href={`/buildings/${b.id}`}>
                    <ChevronRight size={18} className="text-ink/30" />
                  </Link>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
