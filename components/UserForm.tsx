"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import StaffSearchInput from "./StaffSearchInput";
import type { AppRole } from "@/lib/types";

export type UserFormValues = {
  id?: string;
  username: string;
  role: AppRole;
  staffId: string | null;
  staffNome: string | null;
  active: boolean;
};

const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: "master", label: "Master" },
  { value: "supervisor", label: "Supervisor" },
  { value: "team_leader", label: "Team Leader" },
];

export default function UserForm({ initial }: { initial?: UserFormValues }) {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);

  const [username, setUsername] = useState(initial?.username ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AppRole>(initial?.role ?? "team_leader");
  const [staffId, setStaffId] = useState<string | null>(initial?.staffId ?? null);
  const [staffNome, setStaffNome] = useState<string | null>(initial?.staffNome ?? null);
  const [active, setActive] = useState(initial?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload: Record<string, unknown> = {
      username,
      role,
      staffId: role === "team_leader" ? staffId : null,
      active,
    };
    if (password) payload.password = password;

    try {
      const res = await fetch(isEdit ? `/api/users/${initial!.id}` : "/api/users", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.error?.formErrors?.[0] ||
            body?.error?.fieldErrors?.staffId?.[0] ||
            body?.error?.fieldErrors?.username?.[0] ||
            body?.error?.fieldErrors?.password?.[0] ||
            (typeof body?.error === "string" ? body.error : null) ||
            "Could not save. Please check the fields."
        );
      }

      router.push("/users");
      router.refresh();
    } catch (e: any) {
      setError(typeof e.message === "string" ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="mb-1 block text-sm font-medium text-ink">Username</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoCapitalize="none"
          autoCorrect="off"
          className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-petrol"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-ink">
          {isEdit ? "New password" : "Password"}{" "}
          {isEdit && <span className="font-normal text-ink/40">(leave blank to keep unchanged)</span>}
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required={!isEdit}
          className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-petrol"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-ink">Role</label>
        {initial?.role === "pending" && (
          <p className="mb-2 text-xs text-amber-700">
            Account pending approval — choose a role to activate it.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {ROLE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRole(opt.value)}
              className={`rounded-md border px-4 py-2 text-sm font-medium transition ${
                role === opt.value
                  ? "border-petrol bg-petrol text-white"
                  : "border-line bg-white text-ink hover:border-petrol"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {role === "team_leader" && (
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Linked staff (Team Leader)</label>
          {staffNome ? (
            <div className="flex items-center justify-between rounded-md border border-petrol bg-petrolLight px-3 py-2 text-sm text-petrol">
              {staffNome}
              <button
                type="button"
                onClick={() => {
                  setStaffId(null);
                  setStaffNome(null);
                }}
                className="text-xs underline hover:text-petrolDark"
              >
                Change
              </button>
            </div>
          ) : (
            <StaffSearchInput
              onSelect={(staff) => {
                setStaffId(staff.id);
                setStaffNome(staff.nome);
              }}
              placeholder="Search staff (team leader)..."
              className="w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-petrol"
            />
          )}
        </div>
      )}

      {isEdit && (
        <div className="flex items-center gap-2">
          <input
            id="active"
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 rounded border-line"
          />
          <label htmlFor="active" className="text-sm text-ink">
            Active account
          </label>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-petrol px-5 py-2.5 text-sm font-medium text-white transition hover:bg-petrolDark disabled:opacity-50"
        >
          {saving ? "Saving..." : isEdit ? "Save changes" : "Create account"}
        </button>
      </div>
    </form>
  );
}
