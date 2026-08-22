"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Check, X } from "lucide-react";

// Cria um time vazio (sem prédio, sem líder) e já abre a página dele —
// prédios e líder são conectados a seguir, ali mesmo.
export default function CreateTeamButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [number, setNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: number.trim() === "" ? null : Number(number) }),
      });
      if (!res.ok) throw new Error("Could not create team");
      const created = await res.json();
      router.push(`/teams/${created.id}`);
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink transition hover:border-petrol hover:text-petrol"
      >
        <Plus size={15} />
        New team
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 rounded-md border border-petrol bg-white px-2 py-1.5">
      <input
        type="number"
        min={0}
        step={1}
        autoFocus
        value={number}
        onChange={(e) => setNumber(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && create()}
        placeholder="Team #"
        className="w-20 border-none bg-transparent text-sm outline-none"
      />
      <button onClick={create} disabled={saving} className="text-petrol hover:text-petrolDark">
        <Check size={14} />
      </button>
      <button onClick={() => setOpen(false)} className="text-ink/40 hover:text-ink">
        <X size={14} />
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
