import { headers } from "next/headers";
import Header from "@/components/Header";
import T from "@/components/T";
import { buildInitialEntries } from "@/lib/timesheetSnapshot";
import { snapToWorkingDay, toISODate } from "@/lib/week";
import PreviewClient from "./PreviewClient";
import type { TimesheetDTO } from "@/lib/types";

async function getBaseUrl() {
  const h = headers();
  const host = h.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

async function getMyProfile() {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/my/buildings`, {
    cache: "no-store",
    headers: { cookie: headers().get("cookie") ?? "" },
  });
  if (!res.ok) return { nome: null, buildings: [], noTeam: res.status === 403 };
  return { ...(await res.json()), noTeam: false };
}

// Preview em tempo real de como a folha ficaria HOJE, com quem está
// cadastrado no prédio agora — nunca grava nada (não cria Timesheet no
// banco), é só uma leitura via buildInitialEntries (mesma função usada pra
// fotografar a folha de verdade na criação). Semana usada é só uma referência
// visual (a de hoje) — o preview não representa um período real.
export default async function PreviewPage() {
  const profile = await getMyProfile();
  const buildings: { id: string; nome: string; workOrder: string | null }[] = profile.buildings ?? [];

  const weekStart = snapToWorkingDay(toISODate(new Date()));

  const timesheets: TimesheetDTO[] = await Promise.all(
    buildings.map(async (b) => ({
      id: `preview-${b.id}`,
      buildingId: b.id,
      buildingNome: b.nome,
      buildingWorkOrder: b.workOrder,
      weekStart,
      weekEnd: null,
      periodType: "weekly",
      status: "draft",
      entries: await buildInitialEntries(BigInt(b.id), "weekly"),
      submittedEntries: null,
      submittedByUserId: null,
      submittedByNome: null,
      submittedByTeamNumber: null,
      submittedAt: null,
      reviewedByNome: null,
      reviewedAt: null,
      deletedAt: null,
      deletedByNome: null,
      fortnightPlanId: null,
    }))
  );

  return (
    <>
      <Header role="team_leader" />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10 print:max-w-none print:px-4 print:py-2">
        <div className="print:hidden">
          <h1 className="font-display text-2xl font-bold text-ink">
            <T s="Sheet preview" />
          </h1>
          <p className="mt-1 text-sm text-ink/50">
            <T s="Just a preview of how the sheet looks today, with who's currently assigned — nothing here is saved." />
          </p>
        </div>

        <div className="mt-6 print:mt-0">
          {profile.noTeam && (
            <p className="rounded-md border border-dashed border-danger/40 bg-red-50 px-4 py-8 text-center text-sm text-danger">
              <T s="Your account isn't linked to a team yet. Ask the Master to link it in Users." />
            </p>
          )}
          {!profile.noTeam && buildings.length === 0 && (
            <p className="rounded-md border border-dashed border-line px-4 py-8 text-center text-sm text-ink/50">
              <T s="No building assigned to your account yet." />
            </p>
          )}
          {buildings.length > 0 && (
            <PreviewClient teamLeaderNome={profile.nome ?? null} timesheets={timesheets} />
          )}
        </div>
      </main>
    </>
  );
}
