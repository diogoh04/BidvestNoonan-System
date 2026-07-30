"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import StaffRow from "@/components/StaffRow";
import { Search } from "lucide-react";

const NO_BUILDING = "__sem_predio__";

type Building = { id: string; nome: string };
type Staff = {
  id: string;
  nome: string | null;
  staffNumber: string | null;
  telefone: string | null;
  buildings: { id: string; nome: string; role: "cleaner" | "team_leader" }[];
};

export default function FilterPage() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [buildingId, setBuildingId] = useState("");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    fetch("/api/buildings")
      .then((r) => r.json())
      .then(setBuildings)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!q.trim() && !buildingId) {
      setResults([]);
      setSearched(false);
      return;
    }

    const timeout = setTimeout(() => {
      runSearch();
    }, 150);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, buildingId]);

  async function runSearch(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setSearched(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (buildingId === NO_BUILDING) {
      params.set("noBuilding", "1");
    } else if (buildingId) {
      params.set("buildingId", buildingId);
    }

    try {
      const res = await fetch(`/api/staff?${params.toString()}`);
      const data = await res.json();
      setResults(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="font-display text-2xl font-bold text-ink">Filtrar Staff</h1>
        <p className="mt-1 text-sm text-ink/50">
          Busque por prédio, nome ou staff number — os resultados aparecem enquanto você digita.
        </p>

        <form onSubmit={runSearch} className="mt-6 flex flex-wrap gap-3">
          <select
            value={buildingId}
            onChange={(e) => setBuildingId(e.target.value)}
            className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-petrol"
          >
            <option value="">Todos os prédios</option>
            <option value={NO_BUILDING}>Sem prédio</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nome}
              </option>
            ))}
          </select>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nome ou staff number..."
            autoFocus
            className="min-w-[220px] flex-1 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-petrol"
          />

          <button
            type="submit"
            className="flex items-center gap-2 rounded-md bg-petrol px-4 py-2 text-sm font-medium text-white hover:bg-petrolDark"
          >
            <Search size={16} />
            Buscar
          </button>
        </form>

        <div className="mt-6 space-y-2">
          {loading && <p className="text-sm text-ink/40">Buscando...</p>}

          {!loading && searched && results.length === 0 && (
            <p className="rounded-md border border-dashed border-line px-4 py-8 text-center text-sm text-ink/50">
              Nenhum resultado para essa busca.
            </p>
          )}

          {!loading &&
            results.map((s) => {
              const subtitle =
                s.buildings.length > 0
                  ? s.buildings
                      .map((b) => `${b.role === "team_leader" ? "Team Leader" : "Cleaner"} em ${b.nome}`)
                      .join(" · ")
                  : "Sem prédio";
              return (
                <StaffRow
                  key={s.id}
                  id={s.id}
                  nome={s.nome}
                  staffNumber={s.staffNumber}
                  telefone={s.telefone}
                  subtitle={subtitle}
                  onDeleted={(id) => setResults((prev) => prev.filter((p) => p.id !== id))}
                />
              );
            })}
        </div>
      </main>
    </>
  );
}
