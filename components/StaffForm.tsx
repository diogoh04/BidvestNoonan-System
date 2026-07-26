"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Building = { id: string; nome: string };
type Role = "cleaner" | "team_leader";

export type StaffFormValues = {
  id?: string;
  nome: string;
  staffNumber: string;
  telefone: string;
  role: Role;
  buildingIds: string[];
};

export default function StaffForm({ initial }: { initial?: StaffFormValues }) {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [nome, setNome] = useState(initial?.nome ?? "");
  const [staffNumber, setStaffNumber] = useState(initial?.staffNumber ?? "");
  const [telefone, setTelefone] = useState(initial?.telefone ?? "");
  const [role, setRole] = useState<Role>(initial?.role ?? "cleaner");
  const [buildingIds, setBuildingIds] = useState<string[]>(initial?.buildingIds ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newBuildingName, setNewBuildingName] = useState("");
  const [addingBuilding, setAddingBuilding] = useState(false);

  useEffect(() => {
    loadBuildings();
  }, []);

  function loadBuildings() {
    fetch("/api/buildings")
      .then((r) => r.json())
      .then(setBuildings)
      .catch(() => {});
  }

  async function createBuilding() {
    if (!newBuildingName.trim()) return;
    setAddingBuilding(true);
    try {
      const res = await fetch("/api/buildings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: newBuildingName.trim() }),
      });
      if (!res.ok) throw new Error("Não foi possível criar o prédio (nome já existe?)");
      const created = await res.json();
      setNewBuildingName("");
      loadBuildings();
      setBuildingIds((prev) => [...prev, created.id]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAddingBuilding(false);
    }
  }

  function toggleBuilding(id: string) {
    setBuildingIds((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = { nome, staffNumber, telefone, role, buildingIds };

    try {
      const res = await fetch(isEdit ? `/api/staff/${initial!.id}` : "/api/staff", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.error?.formErrors?.[0] ||
            body?.error?.fieldErrors?.buildingIds?.[0] ||
            "Não foi possível salvar. Confira os campos."
        );
      }

      router.push("/");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="mb-1 block text-sm font-medium text-ink">Tipo</label>
        <div className="flex gap-2">
          {(["cleaner", "team_leader"] as Role[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`rounded-md border px-4 py-2 text-sm font-medium transition ${
                role === r
                  ? "border-petrol bg-petrol text-white"
                  : "border-line bg-white text-ink hover:border-petrol"
              }`}
            >
              {r === "cleaner" ? "Cleaner" : "Team Leader"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-ink">Nome</label>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
          className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-petrol"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Staff Number</label>
          <input
            value={staffNumber}
            onChange={(e) => setStaffNumber(e.target.value)}
            required
            className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-petrol"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Telefone</label>
          <input
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-petrol"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-ink">
          Prédios{" "}
          <span className="font-normal text-ink/40">
            {role === "team_leader"
              ? "(selecione um ou mais — obrigatório)"
              : "(opcional — pode cadastrar sem prédio ainda, ou em vários)"}
          </span>
        </label>
        <div className="flex flex-wrap gap-2 rounded-md border border-line bg-white p-3">
          {buildings.length === 0 && (
            <span className="text-sm text-ink/40">Nenhum prédio cadastrado ainda.</span>   
          )}
          {buildings.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => toggleBuilding(b.id)}
              className={`rounded-md border px-3 py-1.5 text-sm transition ${
                buildingIds.includes(b.id)
                  ? "border-petrol bg-petrolLight text-petrol"
                  : "border-line text-ink hover:border-petrol"
              }`}
            >
              {b.nome}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-ink/50">
          Is the building not on the list?
        </label>
        <div className="flex gap-2">
          <input
            value={newBuildingName}
            onChange={(e) => setNewBuildingName(e.target.value)}
            placeholder="Nome do novo prédio"
            className="flex-1 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-petrol"
          />
          <button
            type="button"
            onClick={createBuilding}
            disabled={addingBuilding}
            className="rounded-md border border-line px-3 py-2 text-sm font-medium text-ink transition hover:border-petrol hover:text-petrol disabled:opacity-50"
          >
            + Add Building
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-petrol px-5 py-2.5 text-sm font-medium text-white transition hover:bg-petrolDark disabled:opacity-50"
        >
          {saving ? "Salvando..." : isEdit ? "Salvar alterações" : "Cadastrar"}
        </button>
      </div>
    </form>
  );
}
