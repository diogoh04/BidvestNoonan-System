"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { LEAVE_REASON_LABELS, type LeaveReason } from "@/lib/types";

type Building = { id: string; nome: string };
type Role = "cleaner" | "team_leader";
type Assignment = { buildingId: string; role: Role; horas: number | null };
type Team = { id: string; number: number | null; leaderName: string | null };
type TeamLed = { teamId: string; horas: number | null };
type Status = "p45" | "le" | "blocked" | "sick" | null;

export type StaffFormValues = {
  id?: string;
  nome: string;
  staffNumber: string;
  telefone: string;
  assignments: Assignment[];
  teamsLed: TeamLed[];
  status?: Status;
  blockedAt?: string | null;
  lastWorkingDay?: string | null;
  voluntaryLeave?: boolean | null;
  leaveReasons?: LeaveReason[];
  leaveReasonNote?: string | null;
  leDestinationCompany?: string | null;
};

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: null, label: "Active" },
  { value: "p45", label: "P45" },
  { value: "le", label: "LE" },
  { value: "blocked", label: "Staff Blocked" },
  { value: "sick", label: "Sick" },
];

const REASON_OPTIONS: { value: LeaveReason; label: string }[] = (
  ["absences", "transport", "productivity", "visa_blocked", "other"] as LeaveReason[]
).map((value) => ({ value, label: LEAVE_REASON_LABELS[value] }));

export default function StaffForm({ initial }: { initial?: StaffFormValues }) {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [nome, setNome] = useState(initial?.nome ?? "");
  const [staffNumber, setStaffNumber] = useState(initial?.staffNumber ?? "");
  const [telefone, setTelefone] = useState(initial?.telefone ?? "");
  const [assignments, setAssignments] = useState<Assignment[]>(
    (initial?.assignments ?? []).filter((a) => a.role === "cleaner")
  );
  const [teamsLed, setTeamsLed] = useState<TeamLed[]>(initial?.teamsLed ?? []);
  const [status, setStatus] = useState<Status>(initial?.status ?? null);
  const [blockedAt, setBlockedAt] = useState(initial?.blockedAt?.slice(0, 10) ?? "");
  const [lastWorkingDay, setLastWorkingDay] = useState(initial?.lastWorkingDay?.slice(0, 10) ?? "");
  const [voluntaryLeave, setVoluntaryLeave] = useState<boolean | null>(initial?.voluntaryLeave ?? null);
  const [leaveReasons, setLeaveReasons] = useState<LeaveReason[]>(initial?.leaveReasons ?? []);
  const [leaveReasonNote, setLeaveReasonNote] = useState(initial?.leaveReasonNote ?? "");
  const [leDestinationCompany, setLeDestinationCompany] = useState(initial?.leDestinationCompany ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newBuildingName, setNewBuildingName] = useState("");
  const [addingBuilding, setAddingBuilding] = useState(false);

  useEffect(() => {
    loadBuildings();
    loadTeams();
  }, []);

  function loadBuildings() {
    fetch("/api/buildings")
      .then((r) => r.json())
      .then(setBuildings)
      .catch(() => {});
  }

  function loadTeams() {
    fetch("/api/teams")
      .then((r) => r.json())
      .then(setTeams)
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

  // Vínculo de cleaner: um por prédio (o mesmo staff não repete o mesmo
  // prédio duas vezes aqui). Team leader não é mais um vínculo de prédio —
  // ver teamsLed abaixo, que conecta o staff a um Team inteiro.
  function addAssignment() {
    const used = new Set(assignments.map((a) => a.buildingId));
    const next = buildings.find((b) => !used.has(b.id));
    if (next) setAssignments((prev) => [...prev, { buildingId: next.id, role: "cleaner", horas: null }]);
  }

  function updateAssignment(index: number, patch: Partial<Assignment>) {
    setAssignments((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  function removeAssignment(index: number) {
    setAssignments((prev) => prev.filter((_, i) => i !== index));
  }

  const usedBuildingIds = new Set(assignments.map((a) => a.buildingId));
  const hasBuildingAvailable = usedBuildingIds.size < buildings.length;

  // Um time pode ter mais de um líder (co-liderança), então todos entram na
  // lista — só filtra os já escolhidos NESTE formulário (ver options abaixo).
  const availableTeams = teams;
  const usedTeamIds = new Set(teamsLed.map((t) => t.teamId));
  const hasTeamAvailable = availableTeams.some((t) => !usedTeamIds.has(t.id));

  function addTeamLed() {
    const next = availableTeams.find((t) => !usedTeamIds.has(t.id));
    if (next) setTeamsLed((prev) => [...prev, { teamId: next.id, horas: null }]);
  }

  function updateTeamLed(index: number, patch: Partial<TeamLed>) {
    setTeamsLed((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  function removeTeamLed(index: number) {
    setTeamsLed((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      nome,
      staffNumber,
      telefone,
      assignments,
      teamsLed,
      status,
      blockedAt: status === "blocked" && blockedAt ? blockedAt : null,
      lastWorkingDay: (status === "p45" || status === "le") && lastWorkingDay ? lastWorkingDay : null,
      voluntaryLeave: status === "p45" ? voluntaryLeave : null,
      leaveReasons: status === "p45" && voluntaryLeave === false ? leaveReasons : [],
      leaveReasonNote: status === "p45" && voluntaryLeave === false ? leaveReasonNote : null,
      leDestinationCompany: status === "le" ? leDestinationCompany : null,
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
            body?.error?.fieldErrors?.lastWorkingDay?.[0] ||
            body?.error?.fieldErrors?.voluntaryLeave?.[0] ||
            body?.error?.fieldErrors?.leaveReasons?.[0] ||
            body?.error?.fieldErrors?.leaveReasonNote?.[0] ||
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

        {status === "le" && (
          <div className="mt-3 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink/50">Last working day</label>
              <input
                type="date"
                value={lastWorkingDay}
                onChange={(e) => setLastWorkingDay(e.target.value)}
                className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-petrol"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-ink/50">
                Destination company <span className="font-normal text-ink/40">(optional)</span>
              </label>
              <input
                value={leDestinationCompany}
                onChange={(e) => setLeDestinationCompany(e.target.value)}
                placeholder="Which company is this staff going to?"
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-petrol"
              />
            </div>
          </div>
        )}

        {status === "p45" && (
          <div className="mt-3 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink/50">Last working day</label>
              <input
                type="date"
                value={lastWorkingDay}
                onChange={(e) => setLastWorkingDay(e.target.value)}
                className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-petrol"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-ink/50">
                Left by own choice (voluntary)?
              </label>
              <div className="flex gap-2">
                {[
                  { value: true, label: "Yes" },
                  { value: false, label: "No" },
                ].map((opt) => (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => {
                      setVoluntaryLeave(opt.value);
                      if (opt.value) {
                        setLeaveReasons([]);
                        setLeaveReasonNote("");
                      }
                    }}
                    className={`rounded-md border px-4 py-2 text-sm font-medium transition ${
                      voluntaryLeave === opt.value
                        ? "border-petrol bg-petrol text-white"
                        : "border-line bg-white text-ink hover:border-petrol"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {voluntaryLeave === false && (
              <div>
                <label className="mb-1 block text-xs font-medium text-ink/50">Reason (select all that apply)</label>
                <div className="flex flex-wrap gap-2">
                  {REASON_OPTIONS.map((opt) => {
                    const selected = leaveReasons.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          setLeaveReasons((prev) =>
                            selected ? prev.filter((r) => r !== opt.value) : [...prev, opt.value]
                          )
                        }
                        className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                          selected
                            ? "border-petrol bg-petrol text-white"
                            : "border-line bg-white text-ink hover:border-petrol"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                <label className="mb-1 mt-3 block text-xs font-medium text-ink/50">Additional details</label>
                <input
                  value={leaveReasonNote}
                  onChange={(e) => setLeaveReasonNote(e.target.value)}
                  placeholder={
                    leaveReasons.includes("other")
                      ? "Specify the reason"
                      : "Optional — add more detail if needed"
                  }
                  className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-petrol"
                />
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {!status && (
      <>
      <div>
        <label className="mb-1 block text-sm font-medium text-ink">
          Buildings <span className="font-normal text-ink/40">(as cleaner)</span>
        </label>

        <div className="space-y-2">
          {assignments.length === 0 && (
            <p className="text-sm text-ink/40">No assignment added yet.</p>
          )}

          {assignments.map((a, i) => {
            const usedElsewhere = new Set(assignments.filter((_, j) => j !== i).map((x) => x.buildingId));
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
        <label className="mb-1 block text-sm font-medium text-ink">
          Teams <span className="font-normal text-ink/40">(as team leader)</span>
        </label>

        <div className="space-y-2">
          {teamsLed.length === 0 && (
            <p className="text-sm text-ink/40">Not leading any team yet.</p>
          )}

          {teamsLed.map((t, i) => {
            const usedElsewhere = new Set(teamsLed.filter((_, j) => j !== i).map((x) => x.teamId));
            const options = availableTeams.filter((tm) => tm.id === t.teamId || !usedElsewhere.has(tm.id));

            return (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-white p-3">
                <select
                  value={t.teamId}
                  onChange={(e) => updateTeamLed(i, { teamId: e.target.value })}
                  className="min-w-[160px] flex-1 rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-petrol"
                >
                  {options.map((tm) => (
                    <option key={tm.id} value={tm.id}>
                      {tm.number != null ? `Team ${tm.number}` : "Team —"}
                      {tm.leaderName ? ` — ${tm.leaderName}` : ""}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  min={0}
                  step={0.25}
                  value={t.horas ?? ""}
                  onChange={(e) =>
                    updateTeamLed(i, {
                      horas: e.target.value === "" ? null : Number(e.target.value.replace(",", ".")),
                    })
                  }
                  placeholder="TL h/wk"
                  className="w-24 rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-petrol"
                />

                <button
                  type="button"
                  onClick={() => removeTeamLed(i)}
                  title="Disconnect from this team"
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
          onClick={addTeamLed}
          disabled={!hasTeamAvailable}
          className="mt-2 flex items-center gap-1 rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink transition hover:border-petrol hover:text-petrol disabled:opacity-50"
        >
          <Plus size={14} />
          Add team
        </button>
        <p className="mt-1 text-xs text-ink/40">
          A team&apos;s buildings are managed in Teams, not here — this only connects who leads it.
        </p>
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
