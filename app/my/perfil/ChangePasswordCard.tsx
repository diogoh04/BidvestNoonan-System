"use client";

import { useState } from "react";
import { KeyRound, Check } from "lucide-react";

export default function ChangePasswordCard() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/my/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.fieldErrors?.password?.[0] || "Could not reset the password.");
      }
      setPassword("");
      setConfirm("");
      setOpen(false);
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-md border border-line bg-white px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-medium text-ink">Password</span>
        {!open && (
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              setDone(false);
            }}
            className="flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink transition hover:border-petrol hover:text-petrol"
          >
            <KeyRound size={14} />
            Reset password
          </button>
        )}
        {done && (
          <span className="flex items-center gap-1 text-sm text-success">
            <Check size={14} />
            Password reset
          </span>
        )}
      </div>

      {open && (
        <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap items-start gap-2 border-t border-line pt-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
            required
            minLength={6}
            autoFocus
            className="min-w-0 flex-1 rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-petrol"
          />
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm password"
            required
            minLength={6}
            className="min-w-0 flex-1 rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-petrol"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-petrol px-3 py-2 text-sm font-medium text-white transition hover:bg-petrolDark disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setPassword("");
                setConfirm("");
                setError(null);
              }}
              className="rounded-md border border-line px-3 py-2 text-sm hover:bg-surface"
            >
              Cancel
            </button>
          </div>
          {error && <p className="w-full text-sm text-danger">{error}</p>}
        </form>
      )}
    </div>
  );
}
