"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toISODate, formatWeekRange } from "@/lib/week";

export default function WeekNav({ weekStart, basePath }: { weekStart: string; basePath: string }) {
  const router = useRouter();

  function go(offsetDays: number) {
    const d = new Date(weekStart + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + offsetDays);
    router.push(`${basePath}?week=${toISODate(d)}`);
  }

  const thisMonday = toISODate(
    (() => {
      const d = new Date();
      const day = d.getUTCDay();
      const diff = day === 0 ? -6 : 1 - day;
      d.setUTCDate(d.getUTCDate() + diff);
      return d;
    })()
  );

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => go(-7)}
        className="rounded-md border border-line p-1.5 text-ink/60 transition hover:border-petrol hover:text-petrol"
      >
        <ChevronLeft size={16} />
      </button>
      <span className="min-w-[110px] text-center text-sm font-medium text-ink">{formatWeekRange(weekStart)}</span>
      <button
        onClick={() => go(7)}
        className="rounded-md border border-line p-1.5 text-ink/60 transition hover:border-petrol hover:text-petrol"
      >
        <ChevronRight size={16} />
      </button>
      {weekStart !== thisMonday && (
        <button
          onClick={() => router.push(`${basePath}?week=${thisMonday}`)}
          className="rounded-md border border-line px-2 py-1 text-xs text-ink/60 transition hover:border-petrol hover:text-petrol"
        >
          This week
        </button>
      )}
    </div>
  );
}
