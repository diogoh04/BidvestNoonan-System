import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import T from "@/components/T";
import FortnightPlanDetailClient from "./FortnightPlanDetailClient";
import { formatFortnightRange } from "@/lib/week";
import type { FortnightPlanDTO } from "@/lib/types";

async function getBaseUrl() {
  const h = headers();
  const host = h.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

async function getPlan(id: string): Promise<FortnightPlanDTO | null> {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/timesheets/fortnight-plans/${id}`, {
    cache: "no-store",
    headers: { cookie: headers().get("cookie") ?? "" },
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function FortnightPlanPage({ params }: { params: { id: string } }) {
  const plan = await getPlan(params.id);
  if (!plan) notFound();

  return (
    <>
      <Header role="team_leader" />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <p className="font-mono text-xs uppercase tracking-widest text-ink/40 print:hidden">
          <T s="Fortnightly sheets" />
        </p>
        <h1 className="font-display text-2xl font-bold text-ink print:hidden">
          {plan.buildingNome} — {formatFortnightRange(plan.fortnightStart)}
        </h1>

        <div className="mt-6">
          <FortnightPlanDetailClient plan={plan} />
        </div>
      </main>
    </>
  );
}
