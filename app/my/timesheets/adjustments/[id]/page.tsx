import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import AdjustmentReportEditorClient from "../AdjustmentReportEditorClient";
import type { AdjustmentReportDTO } from "@/lib/types";

async function getBaseUrl() {
  const h = headers();
  const host = h.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

async function getJson<T>(path: string, fallback: T): Promise<T> {
  const base = await getBaseUrl();
  const res = await fetch(`${base}${path}`, {
    cache: "no-store",
    headers: { cookie: headers().get("cookie") ?? "" },
  });
  if (!res.ok) return fallback;
  return res.json();
}

export default async function AdjustmentReportPage({ params }: { params: { id: string } }) {
  const [report, profile] = await Promise.all([
    getJson<AdjustmentReportDTO | null>(`/api/adjustment-reports/${params.id}`, null),
    getJson<{ buildings?: { id: string; nome: string }[] }>("/api/my/buildings", {}),
  ]);
  if (!report) notFound();

  return (
    <>
      <Header role="team_leader" />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
        <p className="font-mono text-xs uppercase tracking-widest text-ink/40">Adjustment report</p>
        <h1 className="font-display text-2xl font-bold text-ink">Week starting {report.weekStart}</h1>
        <div className="mt-6">
          <AdjustmentReportEditorClient
            initialReport={report}
            myBuildings={(profile.buildings ?? []).map((b) => ({ id: b.id, nome: b.nome }))}
          />
        </div>
      </main>
    </>
  );
}
