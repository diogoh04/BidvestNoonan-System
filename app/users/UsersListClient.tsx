"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, UserPlus, Trash2 } from "lucide-react";
import type { UserDTO } from "@/lib/types";

const ROLE_LABEL: Record<UserDTO["role"], string> = {
  master: "Master",
  supervisor: "Supervisor",
  team_leader: "Team Leader",
  pending: "Pending approval",
};

// Número do time a partir de teamLabel ("Team 5 — João, Maria") — só pra
// ordenar os Team Leaders por time (ver groupUsers abaixo). Sem número
// (ainda sem time linkado, teamLabel null) fica por último dentro do grupo.
function teamNumber(u: UserDTO): number {
  const m = u.teamLabel?.match(/^Team (\d+)/);
  return m ? Number(m[1]) : Infinity;
}

// Camadas de prioridade: pendente primeiro (precisa de aprovação do Master),
// depois Master, Supervisor, Team Leader — dentro de Team Leader, por
// número do time; dentro dos outros grupos, por nome de usuário.
function groupUsers(users: UserDTO[]): { label: string; items: UserDTO[] }[] {
  const pending = users.filter((u) => u.role === "pending");
  const byUsername = (a: UserDTO, b: UserDTO) => a.username.localeCompare(b.username);

  const master = users.filter((u) => u.role === "master").sort(byUsername);
  const supervisor = users.filter((u) => u.role === "supervisor").sort(byUsername);
  const teamLeader = users
    .filter((u) => u.role === "team_leader")
    .sort((a, b) => teamNumber(a) - teamNumber(b) || byUsername(a, b));

  return [
    { label: "Pending approval", items: pending },
    { label: "Master", items: master },
    { label: "Supervisor", items: supervisor },
    { label: "Team Leader", items: teamLeader },
  ].filter((g) => g.items.length > 0);
}

export default function UsersListClient({ initialUsers }: { initialUsers: UserDTO[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function toggleActive(u: UserDTO) {
    setError(null);
    try {
      const res = await fetch(`/api/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !u.active }),
      });
      if (!res.ok) throw new Error("Could not update the user");
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, active: !x.active } : x)));
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function deleteUser(u: UserDTO) {
    setError(null);
    setDeletingId(u.id);
    try {
      const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Could not delete the user");
      }
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeletingId(null);
      setConfirmingId(null);
    }
  }

  return (
    <div>
      <div className="mt-6 flex justify-end">
        <Link
          href="/users/new"
          className="flex items-center gap-2 rounded-md bg-petrol px-4 py-2 text-sm font-medium text-white hover:bg-petrolDark"
        >
          <UserPlus size={16} />
          New account
        </Link>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      {groupUsers(users).map((group) => (
        <div key={group.label} className="mt-6 first:mt-6">
          <p className="mb-2 font-mono text-xs uppercase tracking-widest text-ink/40">{group.label}</p>
          <div className="space-y-2">
            {group.items.map((u) => {
              if (confirmingId === u.id) {
                return (
                  <div
                    key={u.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-danger bg-white px-4 py-3"
                  >
                    <span className="text-sm text-danger">
                      Delete the account "{u.username}"? This action cannot be undone.
                    </span>
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => deleteUser(u)}
                        disabled={deletingId === u.id}
                        className="rounded-md bg-danger px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmingId(null)}
                        className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-surface"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={u.id}
                  className="flex items-center justify-between rounded-md border border-line bg-white px-4 py-3"
                >
                  <div>
                    <div className="flex items-center gap-2 font-medium text-ink">
                      {u.username}
                      {!u.active && (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-danger">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 font-mono text-xs text-petrol">
                      {u.role === "pending" ? (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 font-sans font-medium text-amber-700">
                          {ROLE_LABEL[u.role]}
                        </span>
                      ) : (
                        <>
                          {ROLE_LABEL[u.role]}
                          {u.teamLabel && ` · ${u.teamLabel}`}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => toggleActive(u)}
                      className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                        u.active
                          ? "border-line text-ink hover:border-danger hover:text-danger"
                          : "border-line text-ink hover:border-petrol hover:text-petrol"
                      }`}
                    >
                      {u.active ? "Deactivate" : "Activate"}
                    </button>
                    <Link
                      href={`/users/${u.id}/edit`}
                      title="Edit"
                      className="rounded-md p-2 text-ink/50 hover:bg-petrolLight hover:text-petrol"
                    >
                      <Pencil size={16} />
                    </Link>
                    <button
                      onClick={() => setConfirmingId(u.id)}
                      title="Delete"
                      className="rounded-md p-2 text-ink/50 hover:bg-red-50 hover:text-danger"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {users.length === 0 && <p className="mt-6 text-sm text-ink/40">No account registered yet.</p>}
    </div>
  );
}
