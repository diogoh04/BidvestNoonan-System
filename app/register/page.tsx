"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(
          body?.error?.fieldErrors?.username?.[0] ||
            body?.error?.fieldErrors?.password?.[0] ||
            (typeof body?.error === "string" ? body.error : null) ||
            "Could not create the account"
        );
        return;
      }
      router.push("/pending");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-6">
      <div className="w-full max-w-sm rounded-lg border border-line bg-white p-8">
        <div className="mb-6 flex justify-center">
          <Image
            src="/logo.svg"
            alt="Bidvest Noonan"
            width={180}
            height={56}
            className="h-12 w-auto object-contain"
          />
        </div>
        <h1 className="mb-1 text-center font-display text-lg font-bold text-ink">Create account</h1>
        <p className="mb-6 text-center text-sm text-ink/50">
          Once created, a Master needs to approve it and set your access role.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            className="w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-petrol"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-petrol"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm password"
            className="w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-petrol"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-petrol px-4 py-2 text-sm font-medium text-white hover:bg-petrolDark disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create account"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-ink/50">
          Already have an account?{" "}
          <Link href="/login" className="text-petrol hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
