import { headers } from "next/headers";
import Header from "@/components/Header";
import MyTimesheetsListClient from "./MyTimesheetsListClient";
import type { TimesheetDTO } from "@/lib/types";

async function getBaseUrl() {
  const h = headers();
  const host = h.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

async function getMyTimesheets(): Promise<TimesheetDTO[]> {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/timesheets`, {
    cache: "no-store",
    headers: { cookie: headers().get("cookie") ?? "" },
  });
  if (!res.ok) return [];
  return res.json();
}

export default async function MyTimesheetsPage() {
  const timesheets = await getMyTimesheets();

  return (
    <>
      <Header role="team_leader" />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="font-display text-2xl font-bold text-ink">Minhas Folhas de Ponto</h1>
        <p className="mt-1 text-sm text-ink/50">Histórico por semana, com todos os seus prédios juntos.</p>

        <MyTimesheetsListClient initialTimesheets={timesheets} />
      </main>
    </>
  );
}
