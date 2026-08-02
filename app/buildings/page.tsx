import { headers } from "next/headers";
import Header from "@/components/Header";
import BuildingsListClient from "./BuildingsListClient";

async function getBaseUrl() {
  const h = headers();
  const host = h.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

async function getBuildings() {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/buildings`, { cache: "no-store", headers: { cookie: headers().get("cookie") ?? "" } });
  if (!res.ok) return [];
  return res.json();
}

export default async function BuildingsPage() {
  const buildings = await getBuildings();

  return (
    <>
      <Header role="master" />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="font-display text-2xl font-bold text-ink">Buildings</h1>
        <p className="mt-1 text-sm text-ink/50">
          {buildings.length} prédio(s) cadastrado(s). Clique para ver o staff alocado.
        </p>

        <BuildingsListClient initialBuildings={buildings} />
      </main>
    </>
  );
}
