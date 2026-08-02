"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, UserPlus } from "lucide-react";
import type { UserDTO } from "@/lib/types";

const ROLE_LABEL: Record<UserDTO["role"], string> = {
  master: "Master",
  supervisor: "Supervisor",
  team_leader: "Team Leader",
  pending: "Pendente de aprovação",
};

export default function UsersListClient({ initialUsers }: { initialUsers: UserDTO[] }) {
  // Contas pendentes (autocadastradas em /register) primeiro, pra chamar
  // atenção do Master.
  const [users, setUsers] = useState(
    [...initialUsers].sort((a, b) => (a.role === "pending" ? -1 : b.role === "pending" ? 1 : 0))
  );
  const [error, setError] = useState<string | null>(null);

  async function toggleActive(u: UserDTO) {
    setError(null);
    try {
      const res = await fetch(`/api/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !u.active }),
      });
      if (!res.ok) throw new Error("Não foi possível atualizar o usuário");
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, active: !x.active } : x)));
    } catch (e: any) {
      setError(e.message);
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
          Nova conta
        </Link>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      <div className="mt-6 space-y-2">
        {users.map((u) => (
          <div
            key={u.id}
            className="flex items-center justify-between rounded-md border border-line bg-white px-4 py-3"
          >
            <div>
              <div className="flex items-center gap-2 font-medium text-ink">
                {u.username}
                {!u.active && (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-danger">
                    Inativo
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
                    {u.staffNome && ` · ${u.staffNome}`}
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
                {u.active ? "Desativar" : "Ativar"}
              </button>
              <Link
                href={`/users/${u.id}/edit`}
                title="Editar"
                className="rounded-md p-2 text-ink/50 hover:bg-petrolLight hover:text-petrol"
              >
                <Pencil size={16} />
              </Link>
            </div>
          </div>
        ))}
        {users.length === 0 && <p className="text-sm text-ink/40">Nenhuma conta cadastrada ainda.</p>}
      </div>
    </div>
  );
}
