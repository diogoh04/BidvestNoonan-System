"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserCog, Plus, Pencil, Check, X, Trash2 } from "lucide-react";
import StaffSearchInput from "@/components/StaffSearchInput";

type Leader = { staffId: string; nome: string | null; staffNumber: string | null; horas: number | null };

// Conecta, troca as horas de, ou desconecta o(s) team leader(s) deste time —
// um time pode ter mais de um (co-liderança). Os prédios do time não mudam
// quando o líder muda; só quem tem acesso a eles muda.
export default function ConnectTeamLeaderCard({
  teamId,
  initialLeaders,
}: {
  teamId: string;
  initialLeaders: Leader[];
}) {
  const router = useRouter();
  const [leaders, setLeaders] = useState(initialLeaders);
  const [adding, setAdding] = useState(false);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [pickedName, setPickedName] = useState("");
  const [horasValue, setHorasValue] = useState("");
  const [editingHoursFor, setEditingHoursFor] = useState<string | null>(null);
  const [editHoursValue, setEditHoursValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    if (!pickedId) return;
    setSaving(true);
    setError(null);
    try {
      const horas = horasValue.trim() === "" ? null : Number(horasValue.replace(",", "."));
      const res = await fetch(`/api/teams/${teamId}/leaders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: pickedId, horas }),
      });
      if (!res.ok) throw new Error("Could not connect this team leader");
      setLeaders((prev) => [...prev, { staffId: pickedId, nome: pickedName, staffNumber: null, horas }]);
      setAdding(false);
      setPickedId(null);
      setPickedName("");
      setHorasValue("");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveHours(staffId: string) {
    const horas = editHoursValue.trim() === "" ? null : Number(editHoursValue.replace(",", "."));
    setSaving(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/leaders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId, horas }),
      });
      if (!res.ok) throw new Error();
      setLeaders((prev) => prev.map((l) => (l.staffId === staffId ? { ...l, horas } : l)));
      setEditingHoursFor(null);
      router.refresh();
    } catch {
    } finally {
      setSaving(false);
    }
  }

  async function disconnect(staffId: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/leaders/${staffId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setLeaders((prev) => prev.filter((l) => l.staffId !== staffId));
      router.refresh();
    } catch {
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-widest text-ink/40">
        Team Leader{leaders.length !== 1 ? "s" : ""}
      </p>

      {leaders.length === 0 && !adding && <p className="font-display text-lg font-bold text-ink/40">No leader connected</p>}

      <div className="mt-1 space-y-1.5">
        {leaders.map((l) => (
          <div key={l.staffId} className="flex flex-wrap items-center gap-2">
            <div>
              <span className="font-display text-lg font-bold text-ink">{l.nome}</span>
              {l.staffNumber && <span className="ml-2 font-mono text-xs text-ink/40">#{l.staffNumber}</span>}
            </div>
            {editingHoursFor === l.staffId ? (
              <span className="flex items-center gap-1 rounded-md border border-petrol bg-white px-2 py-1">
                <input
                  type="number"
                  min={0}
                  step={0.25}
                  autoFocus
                  value={editHoursValue}
                  onChange={(e) => setEditHoursValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveHours(l.staffId)}
                  className="w-16 border-none bg-transparent text-xs outline-none"
                />
                <button onClick={() => saveHours(l.staffId)} disabled={saving} className="text-petrol hover:text-petrolDark">
                  <Check size={13} />
                </button>
                <button onClick={() => setEditingHoursFor(null)} className="text-ink/40 hover:text-ink">
                  <X size={13} />
                </button>
              </span>
            ) : (
              <button
                onClick={() => {
                  setEditingHoursFor(l.staffId);
                  setEditHoursValue(l.horas?.toString() ?? "");
                }}
                className="flex items-center gap-1 rounded-md border border-line bg-white px-2 py-1 text-xs text-ink hover:border-petrol"
              >
                <UserCog size={12} className="text-petrol" />
                {l.horas != null ? `${l.horas}h/wk` : "set hrs"}
                <Pencil size={10} className="text-ink/30" />
              </button>
            )}
            <button
              onClick={() => disconnect(l.staffId)}
              disabled={saving}
              title="Disconnect"
              className="rounded p-1 text-ink/30 hover:bg-red-50 hover:text-danger"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {adding ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-petrol bg-white p-2">
          {pickedName ? (
            <span className="flex items-center gap-1.5 rounded-md border border-petrol bg-petrolLight px-2.5 py-1.5 text-sm text-petrol">
              {pickedName}
              <button type="button" onClick={() => { setPickedId(null); setPickedName(""); }} className="hover:text-petrolDark">
                <X size={12} />
              </button>
            </span>
          ) : (
            <StaffSearchInput
              onSelect={(staff) => {
                setPickedId(staff.id);
                setPickedName(staff.nome);
              }}
              placeholder="Search staff..."
            />
          )}
          <input
            type="number"
            min={0}
            step={0.25}
            value={horasValue}
            onChange={(e) => setHorasValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && connect()}
            placeholder="TL hours"
            className="w-24 rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-petrol"
          />
          <button
            type="button"
            onClick={connect}
            disabled={saving || !pickedId}
            className="flex items-center gap-1 rounded-md bg-petrol px-3 py-1.5 text-sm font-medium text-white hover:bg-petrolDark disabled:opacity-50"
          >
            <Check size={14} />
            Connect
          </button>
          <button type="button" onClick={() => setAdding(false)} className="text-ink/40 hover:text-ink">
            <X size={16} />
          </button>
          {error && <span className="w-full text-xs text-danger">{error}</span>}
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-2 flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1.5 text-sm text-ink transition hover:border-petrol"
        >
          <Plus size={14} className="text-petrol" />
          Connect leader
        </button>
      )}
    </div>
  );
}
