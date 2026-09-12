import { headers } from "next/headers";
import Header from "@/components/Header";
import T from "@/components/T";
import AdjustmentReportEditorClient from "../AdjustmentReportEditorClient";

async function getBaseUrl() {
  const h = headers();
  const host = h.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

async function getMyBuildings() {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/my/buildings`, {
    cache: "no-store",
    headers: { cookie: headers().get("cookie") ?? "" },
  });
  if (!res.ok) return { buildings: [] };
  return res.json();
}

export default async function NewAdjustmentReportPage() {
  const profile = await getMyBuildings();

  return (
    <>
      <Header role="team_leader" />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
        <h1 className="font-display text-2xl font-bold text-ink">
          <T s="New adjustment" />
        </h1>
        <p className="mt-1 text-sm text-ink/50">
          <T s="Changes during the fortnight — sent to the supervisor once a week." />
        </p>
        <div className="mt-6">
          <AdjustmentReportEditorClient
            initialReport={null}
            myBuildings={(profile.buildings ?? []).map((b: any) => ({ id: b.id, nome: b.nome }))}
          />
        </div>
      </main>
    </>
  );
}
