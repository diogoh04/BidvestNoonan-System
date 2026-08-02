import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import OutrosStatusClient from "./OutrosStatusClient";

const LABELS: Record<string, string> = {
  p45: "P45",
  le: "LE",
  blocked: "Visa Staff Blocked",
  sick: "Sick",
};

async function getBaseUrl() {
  const h = headers();
  const host = h.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

async function getStaffByStatus(status: string) {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/staff?status=${status}`, { cache: "no-store", headers: { cookie: headers().get("cookie") ?? "" } });
  if (!res.ok) return [];
  return res.json();
}

export default async function OutrosStatusPage({ params }: { params: { status: string } }) {
  const label = LABELS[params.status];
  if (!label) notFound();

  const staff = await getStaffByStatus(params.status);

  return (
    <>
      <Header role="master" />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="font-mono text-xs uppercase tracking-widest text-ink/40">Outros</p>
        <h1 className="font-display text-2xl font-bold text-ink">{label}</h1>

        <div className="mt-6">
          <OutrosStatusClient status={params.status} label={label} initialStaff={staff} />
        </div>
      </main>
    </>
  );
}
