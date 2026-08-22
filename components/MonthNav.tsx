"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getMonthKey, formatMonthLabel, prevMonth, nextMonth } from "@/lib/week";

export default function MonthNav({ month, basePath }: { month: string; basePath: string }) {
  const router = useRouter();
  const thisMonth = getMonthKey(new Date());

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => router.push(`${basePath}?view=month&month=${prevMonth(month)}`)}
        className="rounded-md border border-line p-1.5 text-ink/60 transition hover:border-petrol hover:text-petrol"
      >
        <ChevronLeft size={16} />
      </button>
      <span className="min-w-[140px] text-center text-sm font-medium text-ink">{formatMonthLabel(month)}</span>
      <button
        onClick={() => router.push(`${basePath}?view=month&month=${nextMonth(month)}`)}
        className="rounded-md border border-line p-1.5 text-ink/60 transition hover:border-petrol hover:text-petrol"
      >
        <ChevronRight size={16} />
      </button>
      {month !== thisMonth && (
        <button
          onClick={() => router.push(`${basePath}?view=month&month=${thisMonth}`)}
          className="rounded-md border border-line px-2 py-1 text-xs text-ink/60 transition hover:border-petrol hover:text-petrol"
        >
          This month
        </button>
      )}
    </div>
  );
}
