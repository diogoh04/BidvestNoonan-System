import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toJSONSafe } from "@/lib/types";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const buildingId = BigInt(params.id);

  const building = await prisma.building.findUnique({ where: { id: buildingId } });
  if (!building) return NextResponse.json({ error: "Prédio não encontrado" }, { status: 404 });

  const links = await prisma.staffBuilding.findMany({
    where: { buildingId },
    include: { staff: true },
  });

  const slots = await prisma.buildingSlot.findMany({
    where: { buildingId },
    orderBy: { ordem: "asc" },
  });

  const mapLink = (l: (typeof links)[number]) => ({
    id: l.staff.id.toString(),
    nome: l.staff.nome,
    staffNumber: l.staff.staffNumber,
    telefone: l.staff.telefone,
    role: l.staff.role,
    horasSemana: l.horas ?? l.staff.horasSemana,
  });

  return NextResponse.json(
    toJSONSafe({
      id: building.id.toString(),
      nome: building.nome,
      horasDisponiveis: building.horasDisponiveis,
      workOrder: building.workOrder,
      slots: slots.map((s) => ({ id: s.id.toString(), horas: s.horas })),
      cleaners: links.filter((l) => l.staff.role === "cleaner").map(mapLink),
      teamLeaders: links.filter((l) => l.staff.role === "team_leader").map(mapLink),
    })
  );
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const data: any = {};

  if ("nome" in body) {
    const nome = body.nome;
    if (typeof nome !== "string" || nome.trim() === "") {
      return NextResponse.json({ error: "Nome inválido" }, { status: 400 });
    }
    data.nome = nome.trim();
  }

  if ("horasDisponiveis" in body) {
    const horas = body.horasDisponiveis;
    if (horas !== null && (typeof horas !== "number" || horas < 0)) {
      return NextResponse.json({ error: "Horas inválidas" }, { status: 400 });
    }
    data.horasDisponiveis = horas;
  }

  if ("workOrder" in body) {
    const wo = body.workOrder;
    if (wo !== null && typeof wo !== "string") {
      return NextResponse.json({ error: "Work Order inválido" }, { status: 400 });
    }
    data.workOrder = wo;
  }

  try {
    const updated = await prisma.building.update({
      where: { id: BigInt(params.id) },
      data,
    });

    return NextResponse.json(
      toJSONSafe({
        id: updated.id.toString(),
        nome: updated.nome,
        horasDisponiveis: updated.horasDisponiveis,
        workOrder: updated.workOrder,
      })
    );
  } catch {
    return NextResponse.json({ error: "Não foi possível salvar (nome já existe?)" }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const buildingId = BigInt(params.id);

  await prisma.staff.updateMany({ where: { buildingId }, data: { buildingId: null } });
  await prisma.building.delete({ where: { id: buildingId } });

  return NextResponse.json({ ok: true });
}
