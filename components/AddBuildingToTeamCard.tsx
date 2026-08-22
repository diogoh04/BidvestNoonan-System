"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check } from "lucide-react";

type Building = { id: string; nome: string };

// Aloca um prédio já cadastrado a este time (ver Building.teamId). O outro
// jeito de fazer a mesma coisa é abrindo o prédio direto em /buildings/[id]
// e escolhendo o time por lá (BuildingTeamPicker) — mesma operação.
export default function AddBuildingToTeamCard({ teamId, availableBuildings }: { teamId: string; availableBuildings: Building[] }) {
  const router = useRouter();
  const [buildingId, setBuildingId] = useState(availableBuildings[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!buildingId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/buildings/${buildingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId }),
      });
      if (!res.ok) throw new Error("Could not add this building");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (availableBuildings.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-line bg-surface px-4 py-3">
      <Building2 size={16} className="shrink-0 text-petrol" />
      <select
        value={buildingId}
        onChange={(e) => setBuildingId(e.target.value)}
        className="min-w-[160px] flex-1 rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-petrol"
      >
        {availableBuildings.map((b) => (
          <option key={b.id} value={b.id}>
            {b.nome}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={submit}
        disabled={saving}
        className="flex items-center gap-1 rounded-md bg-petrol px-3 py-1.5 text-sm font-medium text-white hover:bg-petrolDark disabled:opacity-50"
      >
        <Check size={14} />
        Add building to this team
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
