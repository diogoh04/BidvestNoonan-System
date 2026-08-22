"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users2, X } from "lucide-react";

// Desvincula este prédio do time (Building.teamId = null) — usado dentro de
// /teams/[id], onde já é óbvio de qual time o prédio está saindo. Pra mover
// pra outro time (não só remover), use o seletor em /buildings/[id].
export default function RemoveFromTeamButton({ buildingId }: { buildingId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  async function remove() {
    setSaving(true);
    try {
      const res = await fetch(`/api/buildings/${buildingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: null }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setSaving(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5 rounded-md border border-danger bg-white px-2.5 py-1.5 text-sm">
        <span className="text-ink/60">Remove from this team?</span>
        <button onClick={remove} disabled={saving} className="font-medium text-danger hover:opacity-80">
          Confirm
        </button>
        <button onClick={() => setConfirming(false)} className="text-ink/40 hover:text-ink">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1.5 text-sm text-ink/60 transition hover:border-danger hover:text-danger"
    >
      <Users2 size={14} />
      Remove from this team
    </button>
  );
}
