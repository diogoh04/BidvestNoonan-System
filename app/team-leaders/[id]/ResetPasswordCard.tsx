"use client";

import { useState } from "react";
import { KeyRound, Check, UserPlus } from "lucide-react";

type LoginAccount = { id: string; username: string; active: boolean } | null;

export default function ResetPasswordCard({
  teamLeaderId,
  loginAccount,
}: {
  teamLeaderId: string;
  loginAccount: LoginAccount;
}) {
  const [account, setAccount] = useState(loginAccount);
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const isCreate = !account;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (isCreate) {
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password, role: "team_leader", staffId: teamLeaderId }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(
            body?.error?.fieldErrors?.username?.[0] ||
              body?.error?.fieldErrors?.password?.[0] ||
              (typeof body?.error === "string" ? body.error : null) ||
              "Não foi possível criar o login."
          );
        }
        const created = await res.json();
        setAccount({ id: created.id, username: created.username, active: created.active });
        setDone("Login criado");
      } else {
        const res = await fetch(`/api/users/${account!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error?.fieldErrors?.password?.[0] || "Não foi possível redefinir a senha.");
        }
        setDone("Senha redefinida");
      }
      setUsername("");
      setPassword("");
      setOpen(false);
      setTimeout(() => setDone(null), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-md border border-line bg-white px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          {account ? (
            <>
              <span className="font-medium text-ink">Login:</span>{" "}
              <span className="font-mono text-ink/70">{account.username}</span>
              {!account.active && <span className="ml-2 text-xs text-danger">(conta inativa)</span>}
            </>
          ) : (
            <span className="text-ink/50">Sem conta de login vinculada.</span>
          )}
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              setDone(null);
              setError(null);
            }}
            className="flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink transition hover:border-petrol hover:text-petrol"
          >
            {account ? <KeyRound size={14} /> : <UserPlus size={14} />}
            {account ? "Redefinir senha" : "Criar login"}
          </button>
        )}
        {done && (
          <span className="flex items-center gap-1 text-sm text-success">
            <Check size={14} />
            {done}
          </span>
        )}
      </div>

      {open && (
        <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap items-start gap-2 border-t border-line pt-3">
          {isCreate && (
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Usuário"
              required
              minLength={3}
              autoFocus
              className="min-w-0 flex-1 rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-petrol"
            />
          )}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isCreate ? "Senha" : "Nova senha"}
            required
            minLength={6}
            autoFocus={!isCreate}
            className="min-w-0 flex-1 rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-petrol"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-petrol px-3 py-2 text-sm font-medium text-white transition hover:bg-petrolDark disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setUsername("");
                setPassword("");
                setError(null);
              }}
              className="rounded-md border border-line px-3 py-2 text-sm hover:bg-surface"
            >
              Cancelar
            </button>
          </div>
          {error && <p className="w-full text-sm text-danger">{error}</p>}
        </form>
      )}
    </div>
  );
}
