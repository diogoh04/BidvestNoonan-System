"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Users2, Pencil, Check, X } from "lucide-react";

type TeamOption = { id: string; number: number | null; leaderName: string | null };

// Qual time este prédio está alocado — ver comentário do campo Building.teamId
// no schema.prisma. Trocar aqui só move o prédio de time (não mexe em quem é
// o líder do time, isso é feito em /teams/[id]).
export default function BuildingTeamPicker({
  buildingId,
  initialTeamId,
  initialTeamNumber,
  initialLeaderName,
}: {
  buildingId: string;
  initialTeamId: string | null;
  initialTeamNumber: number | null;
  initialLeaderName: string | null;
}) {
  const router = useRouter();
  const [teamId, setTeamId] = useState(initialTeamId);
  const [teamNumber, setTeamNumber] = useState(initialTeamNumber);
  const [leaderName, setLeaderName] = useState(initialLeaderName);
  const [editing, setEditing] = useState(false);
  const [options, setOptions] = useState<TeamOption[] | null>(null);
  const [value, setValue] = useState(teamId ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing || options !== null) return;
    fetch("/api/teams")
      .then((r) => r.json())
      .then((data: any[]) => setOptions(data.map((t) => ({ id: t.id, number: t.number, leaderName: t.leaderName }))))
      .catch(() => setOptions([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/buildings/${buildingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: value === "" ? null : value }),
      });
      if (!res.ok) throw new Error();
      const picked = options?.find((t) => t.id === value) ?? null;
      setTeamId(value === "" ? null : value);
      setTeamNumber(picked?.number ?? null);
      setLeaderName(picked?.leaderName ?? null);
      setEditing(false);
      router.refresh();
    } catch {
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1 rounded-md border border-petrol bg-white px-2 py-1.5">
        <Users2 size={14} className="text-petrol" />
        {options === null ? (
          <span className="text-sm text-ink/40">Loading...</span>
        ) : (
          <select
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="rounded-md border-none bg-transparent text-sm outline-none"
          >
            <option value="">No team</option>
            {options.map((t) => (
              <option key={t.id} value={t.id}>
                {t.number != null ? `Team ${t.number}` : "Team —"}
                {t.leaderName ? ` — ${t.leaderName}` : ""}
              </option>
            ))}
          </select>
        )}
        <button onClick={save} disabled={saving} className="text-petrol hover:text-petrolDark">
          <Check size={14} />
        </button>
        <button onClick={() => setEditing(false)} className="text-ink/40 hover:text-ink">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1.5 text-sm text-ink">
      <Users2 size={14} className="text-petrol" />
      {teamId ? (
        <Link href={`/teams/${teamId}`} className="hover:underline">
          Team {teamNumber ?? "—"}
          {leaderName ? ` — ${leaderName}` : ""}
        </Link>
      ) : (
        <span className="text-ink/50">No team</span>
      )}
      <button
        onClick={() => {
          setValue(teamId ?? "");
          setEditing(true);
        }}
        className="text-ink/30 hover:text-petrol"
      >
        <Pencil size={12} />
      </button>
    </div>
  );
}
