"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { X } from "lucide-react";
import {
  HISTORY_KIND_LABELS,
  historyTargetLabel,
  formatHistoryRange,
  formatHistoryDuration,
  type StaffHistoryDTO,
  type HistoryKind,
} from "@/lib/historyFormat";

type Building = { id: string; nome: string };
type Team = { id: string; number: number | null; leaderName: string | null };

const PAGE_SIZE = 100;

const KIND_STYLE: Record<HistoryKind, string> = {
  building: "bg-petrolLight text-petrol",
  team_leader: "bg-petrolLight text-petrol",
  team_leader_cover: "border border-dashed border-amber-400 bg-amber-50 text-amber-700",
};

export default function StaffHistoryPage() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [buildingId, setBuildingId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [openOnly, setOpenOnly] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [items, setItems] = useState<StaffHistoryDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/buildings").then((r) => r.json()).then(setBuildings).catch(() => {});
    fetch("/api/teams").then((r) => r.json()).then(setTeams).catch(() => {});
  }, []);

  function buildParams(skip: number) {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (kind) params.set("kind", kind);
    if (buildingId) params.set("buildingId", buildingId);
    if (teamId) params.set("teamId", teamId);
    if (openOnly) params.set("open", "1");
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    params.set("take", String(PAGE_SIZE));
    params.set("skip", String(skip));
    return params;
  }

  async function search() {
    setLoading(true);
    try {
      const res = await fetch(`/api/staff-history?${buildParams(0).toString()}`);
      const data = await res.json();
      setItems(data.items);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    setLoading(true);
    try {
      const res = await fetch(`/api/staff-history?${buildParams(items.length).toString()}`);
      const data = await res.json();
      setItems((prev) => [...prev, ...data.items]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(search, 200);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, kind, buildingId, teamId, openOnly, from, to]);

  async function deleteEntry(id: string) {
    try {
      const res = await fetch(`/api/staff-history/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setItems((prev) => prev.filter((i) => i.id !== id));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch {
    }
  }

  return (
    <>
      <Header role="master" />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="font-display text-2xl font-bold text-ink">Building &amp; Team History</h1>
        <p className="mt-1 text-sm text-ink/50">
          Every building assignment, team leadership and cover, across everyone — most recent first.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Staff name or number..."
            className="min-w-[200px] flex-1 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-petrol"
          />
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-petrol"
          >
            <option value="">All kinds</option>
            {(Object.keys(HISTORY_KIND_LABELS) as HistoryKind[]).map((k) => (
              <option key={k} value={k}>
                {HISTORY_KIND_LABELS[k]}
              </option>
            ))}
          </select>
          <select
            value={buildingId}
            onChange={(e) => setBuildingId(e.target.value)}
            className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-petrol"
          >
            <option value="">All buildings</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nome}
              </option>
            ))}
          </select>
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-petrol"
          >
            <option value="">All teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                Team {t.number ?? "—"}
                {t.leaderName ? ` — ${t.leaderName}` : ""}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-sm text-ink/70">
            <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} className="h-4 w-4 rounded border-line" />
            Ongoing only
          </label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            title="From"
            className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-petrol"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            title="To"
            className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-petrol"
          />
        </div>

        <div className="mt-6 space-y-2">
          {loading && items.length === 0 && <p className="text-sm text-ink/40">Loading...</p>}
          {!loading && items.length === 0 && (
            <p className="rounded-md border border-dashed border-line px-4 py-8 text-center text-sm text-ink/50">
              No history for this filter.
            </p>
          )}

          {items.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-white px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${KIND_STYLE[e.kind]}`}>
                  {HISTORY_KIND_LABELS[e.kind]}
                </span>
                {e.staffId ? (
                  <Link href={`/staff/${e.staffId}/edit`} className="font-medium text-ink hover:text-petrol hover:underline">
                    {e.staffNome ?? "—"}
                  </Link>
                ) : (
                  <span className="font-medium text-ink" title="No staff record — added by name only">
                    {e.staffNome ?? "—"}
                  </span>
                )}
                <span className="font-mono text-xs text-ink/40">#{e.staffNumber || "n/a"}</span>
                <span className="text-ink/40">→</span>
                <span className="text-ink">{historyTargetLabel(e)}</span>
                {!e.endedAt && (
                  <span className="rounded bg-success/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-success">
                    current
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right font-mono text-xs text-ink/40">
                  <div>{formatHistoryRange(e)}</div>
                  <div>{formatHistoryDuration(e.startedAt, e.endedAt)}</div>
                </div>
                <button
                  title="Delete entry (wrong change or test)"
                  onClick={() => deleteEntry(e.id)}
                  className="shrink-0 rounded p-1 text-ink/30 transition hover:bg-red-50 hover:text-danger"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}

          {items.length > 0 && items.length < total && (
            <button
              onClick={loadMore}
              disabled={loading}
              className="w-full rounded-md border border-line bg-white py-2 text-sm font-medium text-ink transition hover:border-petrol disabled:opacity-50"
            >
              {loading ? "Loading..." : `Load more (${items.length} of ${total})`}
            </button>
          )}
        </div>
      </main>
    </>
  );
}
