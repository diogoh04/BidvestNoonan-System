"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserCog, Plus, Check, X, Trash2, ChevronDown } from "lucide-react";
import StaffSearchInput from "@/components/StaffSearchInput";
import { formatHistoryRange, type StaffHistoryDTO } from "@/lib/historyFormat";

type Cover = {
  id: string;
  staffId: string;
  nome: string | null;
  staffNumber: string | null;
  startedAt: string;
  endedAt: string | null;
  note: string | null;
};

// Cover = alguém cobrindo a função de team leader temporariamente, SEM ser
// conectado como líder de verdade — não muda acesso nem mexe nos prédios do
// time, é só um registro (ver StaffHistory.kind="team_leader_cover" no
// schema.prisma). Por isso o visual é propositalmente diferente (tracejado/
// âmbar) do card de líder conectado.
export default function TeamLeaderCoversCard({ teamId, initialCovers }: { teamId: string; initialCovers: Cover[] }) {
  const router = useRouter();
  const [covers, setCovers] = useState(initialCovers);
  const [adding, setAdding] = useState(false);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [pickedName, setPickedName] = useState("");
  const [startedAt, setStartedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [endedAt, setEndedAt] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showPast, setShowPast] = useState(false);
  const [pastCovers, setPastCovers] = useState<StaffHistoryDTO[] | null>(null);
  const [loadingPast, setLoadingPast] = useState(false);

  async function togglePast() {
    if (showPast) {
      setShowPast(false);
      return;
    }
    setShowPast(true);
    if (pastCovers === null) {
      setLoadingPast(true);
      try {
        const res = await fetch(`/api/staff-history?teamId=${teamId}&kind=team_leader_cover`);
        const data = await res.json();
        setPastCovers(data.items.filter((i: StaffHistoryDTO) => i.endedAt));
      } catch {
        setPastCovers([]);
      } finally {
        setLoadingPast(false);
      }
    }
  }

  async function submit() {
    if (!pickedId || !startedAt) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/teams/${teamId}/covers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: pickedId, startedAt, endedAt: endedAt || null, note: note.trim() || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Could not save this cover");
      }
      router.refresh();
      // Só reflete localmente se já é um cover ativo (sem endedAt) — senão
      // (já criado fechado) some da lista de ativos no próximo refresh.
      if (!endedAt) {
        setCovers((prev) => [...prev, { id: crypto.randomUUID(), staffId: pickedId, nome: pickedName, staffNumber: null, startedAt, endedAt: null, note: note.trim() || null }]);
      }
      setAdding(false);
      setPickedId(null);
      setPickedName("");
      setEndedAt("");
      setNote("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function closeCover(coverId: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/covers/${coverId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!res.ok) throw new Error();
      setCovers((prev) => prev.filter((c) => c.id !== coverId));
      setPastCovers(null);
      router.refresh();
    } catch {
    } finally {
      setSaving(false);
    }
  }

  async function removeCover(coverId: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/covers/${coverId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setCovers((prev) => prev.filter((c) => c.id !== coverId));
      router.refresh();
    } catch {
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 rounded-md border border-dashed border-amber-300 bg-amber-50/40 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
        <UserCog size={15} />
        Covering
      </div>
      <p className="mt-0.5 text-xs text-ink/50">Covers don&apos;t change team access or buildings — just a record.</p>

      <div className="mt-2 space-y-1.5">
        {covers.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-amber-400 bg-white px-3 py-2 text-sm">
            <div>
              <span className="font-medium text-ink">{c.nome}</span>
              {c.staffNumber && <span className="ml-2 font-mono text-xs text-ink/40">#{c.staffNumber}</span>}
              <span className="ml-2 font-mono text-xs text-ink/40">{formatHistoryRange(c)}</span>
              {c.note && <div className="mt-0.5 text-xs text-ink/50">{c.note}</div>}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => closeCover(c.id)} disabled={saving} className="rounded-md border border-line px-2 py-1 text-xs text-ink hover:border-petrol">
                Close
              </button>
              <button onClick={() => removeCover(c.id)} disabled={saving} title="Remove (mistake)" className="rounded p-1 text-ink/30 hover:bg-red-50 hover:text-danger">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {adding ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-amber-400 bg-white p-2">
          {pickedName ? (
            <span className="flex items-center gap-1.5 rounded-md border border-amber-400 bg-amber-50 px-2.5 py-1.5 text-sm text-amber-800">
              {pickedName}
              <button type="button" onClick={() => { setPickedId(null); setPickedName(""); }} className="hover:opacity-70">
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
          <input type="date" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} className="rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-petrol" />
          <span className="text-xs text-ink/40">to</span>
          <input type="date" value={endedAt} onChange={(e) => setEndedAt(e.target.value)} placeholder="Ongoing" className="rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-petrol" />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="min-w-[140px] flex-1 rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-petrol" />
          <button type="button" onClick={submit} disabled={saving || !pickedId} className="flex items-center gap-1 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50">
            <Check size={14} />
            Save
          </button>
          <button type="button" onClick={() => setAdding(false)} className="text-ink/40 hover:text-ink">
            <X size={16} />
          </button>
          {error && <span className="w-full text-xs text-danger">{error}</span>}
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="mt-2 flex items-center gap-1.5 rounded-md border border-dashed border-amber-400 bg-white px-2.5 py-1.5 text-sm text-amber-800 transition hover:border-amber-600">
          <Plus size={14} />
          Add cover
        </button>
      )}

      <button onClick={togglePast} className="mt-3 flex items-center gap-1 text-xs text-ink/40 hover:text-ink">
        <ChevronDown size={12} className={`transition ${showPast ? "rotate-180" : ""}`} />
        {showPast ? "Hide past covers" : "Show past covers"}
      </button>
      {showPast && (
        <div className="mt-1.5 space-y-1">
          {loadingPast && <p className="text-xs text-ink/40">Loading...</p>}
          {!loadingPast && pastCovers && pastCovers.length === 0 && <p className="text-xs text-ink/40">No past covers.</p>}
          {!loadingPast &&
            pastCovers?.map((c) => (
              <div key={c.id} className="rounded-md bg-white/60 px-3 py-1.5 text-xs text-ink/50">
                {c.staffNome} — {formatHistoryRange(c)}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
