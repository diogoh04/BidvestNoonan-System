import { headers } from "next/headers";
import Header from "@/components/Header";
import UsersListClient from "./UsersListClient";

async function getBaseUrl() {
  const h = headers();
  const host = h.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

async function getUsers() {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/users`, {
    cache: "no-store",
    headers: { cookie: headers().get("cookie") ?? "" },
  });
  if (!res.ok) return [];
  return res.json();
}

export default async function UsersPage() {
  const users = await getUsers();

  return (
    <>
      <Header role="master" />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="font-display text-2xl font-bold text-ink">Users</h1>
        <p className="mt-1 text-sm text-ink/50">
          System access accounts (Master, Supervisor, Team Leader).
        </p>

        <UsersListClient initialUsers={users} />
      </main>
    </>
  );
}
