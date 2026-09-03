"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronUp, ChevronDown } from "lucide-react";
import BuildingCard, { type BuildingCardData } from "@/components/BuildingCard";

// Empilha os prédios do time com setas pra cima/baixo pra reordenar — a
// ordem salva (Building.teamOrder, via PUT /api/teams/[id]/buildings/order)
// também é a ordem em que os prédios aparecem na folha impressa
// (/timesheets/leader/[id] e no editor semanal, ver GET /api/timesheets).
// Otimista: a troca aparece na hora, sem esperar o PUT terminar.
export default function TeamBuildingsOrderList({
  teamId,
  initialBuildings,
}: {
  teamId: string;
  initialBuildings: BuildingCardData[];
}) {
  const router = useRouter();
  const [buildings, setBuildings] = useState(initialBuildings);
  const [saving, setSaving] = useState(false);

  async function persistOrder(next: BuildingCardData[]) {
    setBuildings(next);
    setSaving(true);
    try {
      await fetch(`/api/teams/${teamId}/buildings/order`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buildingIds: next.map((b) => b.id) }),
      });
      router.refresh();
    } catch {
      // Best-effort — se falhar, a ordem local já mudou na tela; um refresh
      // manual volta a puxar a ordem real do banco.
    } finally {
      setSaving(false);
    }
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= buildings.length) return;
    const next = [...buildings];
    [next[index], next[target]] = [next[target], next[index]];
    persistOrder(next);
  }

  return (
    <div className="space-y-8">
      {buildings.map((b, i) => (
        <div key={b.id} className="flex items-start gap-2">
          <div className="flex shrink-0 flex-col gap-1 pt-6 print:hidden">
            <button
              type="button"
              onClick={() => move(i, -1)}
              disabled={i === 0 || saving}
              title="Move up"
              className="rounded border border-line p-1 text-ink/50 transition hover:border-petrol hover:text-petrol disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronUp size={16} />
            </button>
            <button
              type="button"
              onClick={() => move(i, 1)}
              disabled={i === buildings.length - 1 || saving}
              title="Move down"
              className="rounded border border-line p-1 text-ink/50 transition hover:border-petrol hover:text-petrol disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronDown size={16} />
            </button>
          </div>
          <div className="min-w-0 flex-1">
            <BuildingCard building={b} bordered teamContext />
          </div>
        </div>
      ))}
    </div>
  );
}
