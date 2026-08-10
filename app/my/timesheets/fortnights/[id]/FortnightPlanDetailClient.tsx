"use client";

import Link from "next/link";
import CombinedTimesheetEditor from "@/components/timesheets/CombinedTimesheetEditor";
import { formatWeekRange } from "@/lib/week";
import type { FortnightPlanDTO, TimesheetDTO } from "@/lib/types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB");
}

// Mostra a previsão original (10 dias, congelada no Launch) em modo
// read-only, reaproveitando o mesmo editor usado pra edição/revisão — só
// que alimentado com forecastEntries em vez do entries ao vivo de uma folha.
export default function FortnightPlanDetailClient({ plan }: { plan: FortnightPlanDTO }) {
  const synthetic: TimesheetDTO = {
    ...plan.week1,
    entries: plan.forecastEntries,
    periodType: "biweekly",
    weekStart: plan.fortnightStart,
  };

  return (
    <div>
      <p className="mb-4 text-sm text-ink/50 print:hidden">
        Original forecast launched on {formatDate(plan.launchedAt)}
        {plan.launchedByNome ? ` by ${plan.launchedByNome}` : ""} — read-only. Changes now happen on the weekly
        sheets below.
      </p>

      <div className="mb-6 flex flex-wrap gap-3 print:hidden">
        <Link
          href={`/my/timesheets/lancar?week=${plan.week1.weekStart}`}
          className="rounded-md border border-line px-4 py-2 text-sm font-medium text-ink transition hover:border-petrol hover:text-petrol"
        >
          View Week 1 ({formatWeekRange(plan.week1.weekStart)})
        </Link>
        <Link
          href={`/my/timesheets/lancar?week=${plan.week2.weekStart}`}
          className="rounded-md border border-line px-4 py-2 text-sm font-medium text-ink transition hover:border-petrol hover:text-petrol"
        >
          View Week 2 ({formatWeekRange(plan.week2.weekStart)})
        </Link>
      </div>

      <CombinedTimesheetEditor teamLeaderNome={null} timesheets={[synthetic]} onChanged={() => {}} readOnly />
    </div>
  );
}
