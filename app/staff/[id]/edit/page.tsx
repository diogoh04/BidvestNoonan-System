import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import StaffForm from "@/components/StaffForm";

async function getBaseUrl() {
  const h = headers();
  const host = h.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

async function getStaff(id: string) {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/staff/${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Falha ao carregar staff");
  return res.json();
}

export default async function EditStaffPage({ params }: { params: { id: string } }) {
  const staff = await getStaff(params.id);
  if (!staff) notFound();

  return (
    <>
      <Header />
      <main className="mx-auto max-w-xl px-6 py-10">
        <h1 className="font-display text-2xl font-bold text-ink">Editar Staff</h1>
        <p className="mt-1 text-sm text-ink/50">{staff.nome}</p>
        <div className="mt-6">
          <StaffForm
            initial={{
              id: staff.id,
              nome: staff.nome ?? "",
              staffNumber: staff.staffNumber ?? "",
              telefone: staff.telefone ?? "",
              assignments:
                staff.buildings?.map((b: any) => ({
                  buildingId: b.id,
                  role: b.role,
                  horas: b.horas ?? null,
                })) ?? [],
              status: staff.status ?? null,
              blockedAt: staff.blockedAt ?? null,
            }}
          />
        </div>
      </main>
    </>
  );
}
