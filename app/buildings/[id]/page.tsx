import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import BuildingCard from "@/components/BuildingCard";
import BuildingStaffHistoryCard from "@/components/BuildingStaffHistoryCard";

async function getBaseUrl() {
  const h = headers();
  const host = h.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

async function getBuilding(id: string) {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/buildings/${id}`, { cache: "no-store", headers: { cookie: headers().get("cookie") ?? "" } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load building");
  return res.json();
}

export default async function BuildingDetailPage({ params }: { params: { id: string } }) {
  const building = await getBuilding(params.id);
  if (!building) notFound();

  return (
    <>
      <Header role="master" />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px] lg:items-start">
          <BuildingCard building={building} />
          <BuildingStaffHistoryCard buildingId={building.id} />
        </div>
      </main>
    </>
  );
}
