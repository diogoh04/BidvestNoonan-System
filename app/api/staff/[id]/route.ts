import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffInputSchema } from "@/lib/validation";
import { toJSONSafe, StaffDTO } from "@/lib/types";

function mapStaff(w: any): StaffDTO {
  return {
    id: w.id.toString(),
    nome: w.nome,
    telefone: w.telefone,
    staffNumber: w.staffNumber,
    role: w.role,
    buildingId: w.buildingId ? w.buildingId.toString() : null,
    buildingNome: w.building?.nome ?? null,
    createdAt: w.createdAt ? w.createdAt.toISOString() : null,
    buildings: w.buildingsAsTeamLeader?.map((sb: any) => ({

      id: sb.building.id.toString(),
      nome: sb.building.nome,
    })),
  };
}


export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const staff = await prisma.staff.findUnique({
    where: { id: BigInt(params.id) },
    include: {
      buildingsAsTeamLeader: { include: { building: true } },
      observations: { orderBy: { data: "desc" } },
    },
  });

  if (!staff) return NextResponse.json({ error: "Staff não encontrado" }, { status: 404 });

  return NextResponse.json(
    toJSONSafe({
      ...mapStaff(staff),
      observations: staff.observations.map((f) => ({
        id: f.id.toString(),
        texto: f.texto,
        data: f.data ? f.data.toISOString() : null,
      })),
    })
  );
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const parsed = staffInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const staffId = BigInt(params.id);

  await prisma.staffBuilding.deleteMany({ where: { staffId } });

  const updated = await prisma.staff.update({
    where: { id: staffId },
    data: {
      nome: data.nome,
      staffNumber: data.staffNumber,
      telefone: data.telefone || null,
      role: data.role,
      buildingsAsTeamLeader:
        data.buildingIds && data.buildingIds.length > 0
          ? { create: data.buildingIds.map((id) => ({ buildingId: BigInt(id) })) }
          : undefined,
    },
    include: { buildingsAsTeamLeader: { include: { building: true } } },
  });

  return NextResponse.json(toJSONSafe(mapStaff(updated)));
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.staff.delete({ where: { id: BigInt(params.id) } });
  return NextResponse.json({ ok: true });
}
