"use client";

import dynamic from "next/dynamic";
import type { DashboardDTO } from "@/lib/types";

const DashboardView = dynamic(() => import("./DashboardView"), { ssr: false });

export default function DashboardViewLoader({ data }: { data: DashboardDTO }) {
  return <DashboardView data={data} />;
}
