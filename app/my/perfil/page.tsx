import { headers } from "next/headers";
import Header from "@/components/Header";
import ChangePasswordCard from "./ChangePasswordCard";

async function getBaseUrl() {
  const h = headers();
  const host = h.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

async function getMyAccount() {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/my/account`, {
    cache: "no-store",
    headers: { cookie: headers().get("cookie") ?? "" },
  });
  if (!res.ok) return { username: "", nome: null };
  return res.json();
}

export default async function MyProfilePage() {
  const account = await getMyAccount();

  return (
    <>
      <Header role="team_leader" />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <h1 className="font-display text-2xl font-bold text-ink">Meu Perfil</h1>
        {account.nome && <p className="mt-1 text-sm text-ink/50">{account.nome}</p>}

        <div className="mt-6 space-y-3">
          <div className="rounded-md border border-line bg-white px-4 py-3 text-sm">
            <span className="font-medium text-ink">Login:</span>{" "}
            <span className="font-mono text-ink/70">{account.username}</span>
          </div>

          <ChangePasswordCard />
        </div>
      </main>
    </>
  );
}
