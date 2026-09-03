"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, UserPlus } from "lucide-react";
import StaffSearchInput from "@/components/StaffSearchInput";
import type { StaffHistoryDTO } from "@/lib/historyFormat";

// Painel lateral de /buildings/[id]: quem trabalha (ou trabalhou) neste
// prédio — só nome + staff number, sem datas (ver pedido original). Puxa
// automático de StaffHistory kind="building" (a mesma trilha que
// lib/staffHistory.ts abre/fecha sozinha quando alguém é atribuído/tirado do
// prédio no formulário de staff — ver openBuildingAssignment/
// closeBuildingAssignment). "Current" = endedAt null, "Previous" = o resto,
// mais recente primeiro. Excluir/adicionar aqui mexem só na trilha
// (StaffHistory), nunca na atribuição real (StaffBuilding) — ver comentário
// da rota POST /api/staff-history.
export default function BuildingStaffHistoryCard({ buildingId }: { buildingId: string }) {
  const [items, setItems] = useState<StaffHistoryDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ id: string; nome: string; staffNumber: string | null } | null>(null);
  // Fallback pra quem não tem cadastro de Staff (saiu há muito tempo, nunca
  // chegou a ser cadastrado) — sem staffId, só o nome digitado e,
  // opcionalmente, um staff number solto.
  const [manualMode, setManualMode] = useState(false);
  const [manualNome, setManualNome] = useState("");
  const [manualNumber, setManualNumber] = useState("");
  const [adding, setAdding] = useState(false);

  async function load() {
    try {
      const res = await fetch(`/api/staff-history?buildingId=${buildingId}&kind=building&take=200`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data.items);
    } catch {
      setItems([]);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId]);

  function resetAddForm() {
    setSelected(null);
    setManualMode(false);
    setManualNome("");
    setManualNumber("");
  }

  async function addStaff(asFormer: boolean) {
    const body = selected
      ? { staffId: selected.id, buildingId, asFormer }
      : { staffNome: manualNome.trim(), staffNumber: manualNumber.trim() || undefined, buildingId, asFormer };
    if (!selected && !manualNome.trim()) return;

    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/staff-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || "Could not add");
      }
      resetAddForm();
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAdding(false);
    }
  }

  async function remove(id: string) {
    setItems((prev) => (prev ? prev.filter((i) => i.id !== id) : prev));
    try {
      await fetch(`/api/staff-history/${id}`, { method: "DELETE" });
    } catch {
    }
  }

  const current = (items ?? []).filter((i) => !i.endedAt);
  const previous = (items ?? []).filter((i) => i.endedAt);

  function Row({ item }: { item: StaffHistoryDTO }) {
    const label = (
      <>
        {item.staffNome ?? "—"} <span className="font-mono text-xs text-ink/40">#{item.staffNumber || "n/a"}</span>
      </>
    );
    return (
      <div className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface">
        {item.staffId ? (
          <Link href={`/staff/${item.staffId}/edit`} className="min-w-0 truncate text-ink hover:text-petrol hover:underline">
            {label}
          </Link>
        ) : (
          <span className="min-w-0 truncate text-ink" title="No staff record — added by name only">
            {label}
          </span>
        )}
        <button
          type="button"
          title="Remove from history"
          onClick={() => remove(item.id)}
          className="shrink-0 rounded p-1 text-ink/25 transition hover:bg-red-50 hover:text-danger"
        >
          <X size={13} />
        </button>
      </div>
    );
  }

  const canAdd = selected != null || manualNome.trim() !== "";

  return (
    <div className="h-fit rounded-md border border-line bg-white p-4">
      <p className="font-mono text-xs uppercase tracking-widest text-ink/40">Staff History</p>

      {items === null && <p className="mt-3 text-sm text-ink/40">Loading...</p>}

      {items !== null && (
        <div className="mt-3 space-y-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink/50">Current</p>
            {current.length === 0 ? (
              <p className="mt-1 text-sm text-ink/30">No one currently.</p>
            ) : (
              <div className="mt-1">
                {current.map((i) => (
                  <Row key={i.id} item={i} />
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink/50">Previous</p>
            {previous.length === 0 ? (
              <p className="mt-1 text-sm text-ink/30">No one yet.</p>
            ) : (
              <div className="mt-1">
                {previous.map((i) => (
                  <Row key={i.id} item={i} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 border-t border-line pt-4">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink/50">
          <UserPlus size={13} />
          Add staff
        </p>

        <div className="space-y-2">
          {selected ? (
            <div className="flex items-center justify-between gap-2 rounded-md border border-petrol bg-petrolLight px-2.5 py-1.5 text-sm text-petrol">
              <span className="truncate">
                {selected.nome} {selected.staffNumber && `#${selected.staffNumber}`}
              </span>
              <button type="button" onClick={() => setSelected(null)} className="shrink-0 hover:text-petrolDark">
                <X size={12} />
              </button>
            </div>
          ) : manualMode ? (
            <div className="space-y-1.5">
              <input
                value={manualNome}
                onChange={(e) => setManualNome(e.target.value)}
                placeholder="Name"
                className="w-full rounded-md border border-line px-2.5 py-1.5 text-sm outline-none focus:border-petrol"
              />
              <input
                value={manualNumber}
                onChange={(e) => setManualNumber(e.target.value)}
                placeholder="Staff number (optional)"
                className="w-full rounded-md border border-line px-2.5 py-1.5 text-sm outline-none focus:border-petrol"
              />
            </div>
          ) : (
            <StaffSearchInput
              onSelect={(staff) => setSelected(staff)}
              placeholder="Search staff..."
              className="w-full rounded-md border border-line px-2.5 py-1.5 text-sm outline-none focus:border-petrol"
            />
          )}

          {!selected && (
            <button
              type="button"
              onClick={() => {
                setManualMode((v) => !v);
                setManualNome("");
                setManualNumber("");
              }}
              className="text-xs text-ink/40 underline hover:text-petrol"
            >
              {manualMode ? "Search a registered staff instead" : "Can't find them? Add by name only"}
            </button>
          )}

          {canAdd && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => addStaff(false)}
                disabled={adding}
                className="rounded-md bg-petrol px-2.5 py-1.5 text-xs font-medium text-white hover:bg-petrolDark disabled:opacity-50"
              >
                Add as current
              </button>
              <button
                type="button"
                onClick={() => addStaff(true)}
                disabled={adding}
                className="rounded-md border border-line px-2.5 py-1.5 text-xs font-medium text-ink hover:border-petrol disabled:opacity-50"
              >
                Add as previous
              </button>
            </div>
          )}
        </div>
        {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      </div>
    </div>
  );
}
