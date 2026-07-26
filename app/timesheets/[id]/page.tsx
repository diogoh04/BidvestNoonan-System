import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import TimesheetView from "./TimesheetView";

async function getBaseUrl() {
  const h = headers();
  const host = h.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

async function getBuilding(id: string) {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/buildings/${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Falha ao carregar prédio");
  return res.json();
}

export default async function TimesheetPage({ params }: { params: { id: string } }) {
  const building = await getBuilding(params.id);
  if (!building) notFound();

  return (
    <>
      <div className="print:hidden">
        <Header />
      </div>
      <TimesheetView building={building} />
    </>
  );
}
