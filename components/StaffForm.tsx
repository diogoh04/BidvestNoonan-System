"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

type Building = { id: string; nome: string };
type Role = "cleaner" | "team_leader";
type Assignment = { buildingId: string; role: Role; horas: number | null };
type Status = "p45" | "le" | "blocked" | "sick" | null;

export type StaffFormValues = {
  id?: string;
  nome: string;
  staffNumber: string;
  telefone: string;
  assignments: Assignment[];
  status?: Status;
  blockedAt?: string | null;
};

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: null, label: "Active" },
  { value: "p45", label: "P45" },
  { value: "le", label: "LE" },
  { value: "blocked", label: "Staff Blocked" },
  { value: "sick", label: "Sick" },
];

export default function StaffForm({ initial }: { initial?: StaffFormValues }) {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [nome, setNome] = useState(initial?.nome ?? "");
  const [staffNumber, setStaffNumber] = useState(initial?.staffNumber ?? "");
  const [telefone, setTelefone] = useState(initial?.telefone ?? "");
  const [assignments, setAssignments] = useState<Assignment[]>(initial?.assignments ?? []);
  const [status, setStatus] = useState<Status>(initial?.status ?? null);
  const [blockedAt, setBlockedAt] = useState(initial?.blockedAt?.slice(0, 10) ?? "");
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
      if (!res.ok) throw new Error("Could not create the building (name already exists?)");
      const created = await res.json();
      setNewBuildingName("");
      loadBuildings();
      setAssignments((prev) => [...prev, { buildingId: created.id, role: "cleaner", horas: null }]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAddingBuilding(false);
    }
  }

  // Um vínculo é identificado por prédio+papel — o mesmo prédio pode
  // aparecer duas vezes (uma como cleaner, outra como team leader).
  function addAssignment() {
    const used = new Set(assignments.map((a) => `${a.buildingId}:${a.role}`));
    for (const b of buildings) {
      for (const r of ["cleaner", "team_leader"] as Role[]) {
        if (!used.has(`${b.id}:${r}`)) {
          setAssignments((prev) => [...prev, { buildingId: b.id, role: r, horas: null }]);
          return;
        }
      }
    }
  }

  function updateAssignment(index: number, patch: Partial<Assignment>) {
    setAssignments((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  function removeAssignment(index: number) {
    setAssignments((prev) => prev.filter((_, i) => i !== index));
  }

  // Cada prédio comporta até 2 vínculos (cleaner + team leader).
  const usedCombos = new Set(assignments.map((a) => `${a.buildingId}:${a.role}`));
  const hasBuildingAvailable = usedCombos.size < buildings.length * 2;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      nome,
      staffNumber,
      telefone,
      assignments,
      status,
      blockedAt: status === "blocked" && blockedAt ? blockedAt : null,
    };

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
            body?.error?.fieldErrors?.assignments?.[0] ||
            "Could not save. Please check the fields."
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
        <label className="mb-1 block text-sm font-medium text-ink">Name</label>
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
            className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-petrol"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Phone</label>
          <input
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-petrol"
          />
        </div>
      </div>

      {isEdit && (
      <div>
        <label className="mb-1 block text-sm font-medium text-ink">Status</label>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => setStatus(opt.value)}
              className={`rounded-md border px-4 py-2 text-sm font-medium transition ${
                status === opt.value
                  ? "border-petrol bg-petrol text-white"
                  : "border-line bg-white text-ink hover:border-petrol"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {status && (
          <p className="mt-2 text-xs text-ink/50">
            This staff's building assignments will be removed when you save.
          </p>
        )}

        {status === "blocked" && (
          <div className="mt-2">
            <label className="mb-1 block text-xs font-medium text-ink/50">Blocked since</label>
            <input
              type="date"
              value={blockedAt}
              onChange={(e) => setBlockedAt(e.target.value)}
              className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-petrol"
            />
          </div>
        )}
      </div>
      )}

      {!status && (
      <>
      <div>
        <label className="mb-1 block text-sm font-medium text-ink">
          Buildings
        </label>

        <div className="space-y-2">
          {assignments.length === 0 && (
            <p className="text-sm text-ink/40">No assignment added yet.</p>
          )}

          {assignments.map((a, i) => {
            // Combos (prédio+papel) já usados por OUTRA linha — só esses
            // ficam de fora; o mesmo prédio pode aparecer de novo numa
            // linha com o papel oposto (cleaner + team leader juntos).
            const otherCombos = new Set(
              assignments.filter((_, j) => j !== i).map((x) => `${x.buildingId}:${x.role}`)
            );
            const usedElsewhere = new Set(
              assignments
                .filter((x, j) => j !== i && x.role === a.role)
                .map((x) => x.buildingId)
            );
            const options = buildings.filter((b) => b.id === a.buildingId || !usedElsewhere.has(b.id));

            return (
              <div
                key={i}
                className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-white p-3"
              >
                <select
                  value={a.buildingId}
                  onChange={(e) => updateAssignment(i, { buildingId: e.target.value })}
                  className="min-w-[140px] flex-1 rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-petrol"
                >
                  {options.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.nome}
                    </option>
                  ))}
                </select>

                <div className="flex gap-1">
                  {(["cleaner", "team_leader"] as Role[]).map((r) => {
                    const conflict = r !== a.role && otherCombos.has(`${a.buildingId}:${r}`);
                    return (
                      <button
                        key={r}
                        type="button"
                        disabled={conflict}
                        title={conflict ? "There's already an assignment with this role in this building" : undefined}
                        onClick={() => updateAssignment(i, { role: r })}
                        className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                          a.role === r
                            ? "border-petrol bg-petrol text-white"
                            : "border-line bg-white text-ink hover:border-petrol disabled:cursor-not-allowed disabled:opacity-40"
                        }`}
                      >
                        {r === "cleaner" ? "Cleaner" : "Team Leader"}
                      </button>
                    );
                  })}
                </div>

                <input
                  type="number"
                  min={0}
                  step={0.25}
                  value={a.horas ?? ""}
                  onChange={(e) =>
                    updateAssignment(i, {
                      horas: e.target.value === "" ? null : Number(e.target.value.replace(",", ".")),
                    })
                  }
                  placeholder="h/wk"
                  className="w-20 rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-petrol"
                />

                <button
                  type="button"
                  onClick={() => removeAssignment(i)}
                  title="Remove assignment"
                  className="rounded p-1.5 text-ink/40 hover:bg-red-50 hover:text-danger"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={addAssignment}
          disabled={!hasBuildingAvailable}
          className="mt-2 flex items-center gap-1 rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink transition hover:border-petrol hover:text-petrol disabled:opacity-50"
        >
          <Plus size={14} />
          Add assignment
        </button>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-ink/50">
          Is the building not on the list?
        </label>
        <div className="flex gap-2">
          <input
            value={newBuildingName}
            onChange={(e) => setNewBuildingName(e.target.value)}
            placeholder="New building name"
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
      </>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-petrol px-5 py-2.5 text-sm font-medium text-white transition hover:bg-petrolDark disabled:opacity-50"
        >
          {saving ? "Saving..." : isEdit ? "Save changes" : "Register"}
        </button>
      </div>
    </form>
  );
}
