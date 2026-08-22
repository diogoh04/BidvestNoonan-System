"use client";

import { useRouter } from "next/navigation";
import { toISODate, getMonday, getMonthKey } from "@/lib/week";

export default function HoursViewToggle({ view, basePath }: { view: "week" | "month"; basePath: string }) {
  const router = useRouter();

  return (
    <div className="flex gap-1">
      <button
        onClick={() => router.push(`${basePath}?view=week&week=${toISODate(getMonday(new Date()))}`)}
        className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
          view === "week" ? "border-petrol bg-petrol text-white" : "border-line bg-white text-ink hover:border-petrol"
        }`}
      >
        Week
      </button>
      <button
        onClick={() => router.push(`${basePath}?view=month&month=${getMonthKey(new Date())}`)}
        className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
          view === "month" ? "border-petrol bg-petrol text-white" : "border-line bg-white text-ink hover:border-petrol"
        }`}
      >
        Month
      </button>
    </div>
  );
}
