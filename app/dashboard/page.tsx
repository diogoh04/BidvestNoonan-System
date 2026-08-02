import { headers } from "next/headers";
import Header from "@/components/Header";
import DashboardViewLoader from "@/components/DashboardViewLoader";
import type { DashboardDTO } from "@/lib/types";

async function getBaseUrl() {
  const h = headers();
  const host = h.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

async function getDashboardData(): Promise<DashboardDTO> {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/dashboard`, { cache: "no-store", headers: { cookie: headers().get("cookie") ?? "" } });
  if (!res.ok) throw new Error("Falha ao carregar dashboard");
  return res.json();
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <>
      <Header role="master" />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <p className="mb-6 font-mono text-xs uppercase tracking-[0.3em] text-ink/40">Dashboard</p>
        <DashboardViewLoader data={data} />
      </main>
    </>
  );
}
