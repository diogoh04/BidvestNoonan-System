import { headers } from "next/headers";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import Header from "@/components/Header";
import { getCurrentUser } from "@/lib/auth";
import ExcluidasListClient from "./ExcluidasListClient";
import type { TimesheetDTO } from "@/lib/types";

async function getBaseUrl() {
  const h = headers();
  const host = h.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

async function getDeletedTimesheets(): Promise<TimesheetDTO[]> {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/timesheets?deleted=1`, {
    cache: "no-store",
    headers: { cookie: headers().get("cookie") ?? "" },
  });
  if (!res.ok) return [];
  return res.json();
}

export default async function ExcluidasPage() {
  const user = await getCurrentUser();
  const timesheets = await getDeletedTimesheets();

  return (
    <>
      <Header role={user?.role ?? "supervisor"} />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <Link href="/review" className="flex items-center gap-1 text-sm text-ink/50 hover:text-petrol">
          <ChevronLeft size={16} />
          Folhas de Ponto
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-ink">Folhas excluídas</h1>
        <p className="mt-1 text-sm text-ink/50">
          Excluídas por Master ou Supervisor. Dá pra restaurar se foi sem querer.
        </p>

        <ExcluidasListClient initialTimesheets={timesheets} />
      </main>
    </>
  );
}
