import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toJSONSafe } from "@/lib/types";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const slots = await prisma.buildingSlot.findMany({
    where: { buildingId: BigInt(params.id) },
    orderBy: { ordem: "asc" },
  });
  return NextResponse.json(
    toJSONSafe(slots.map((s) => ({ id: s.id.toString(), horas: s.horas })))
  );
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const horas = body.horas;
  const quantidade = body.quantidade ?? 1;

  if (typeof horas !== "number" || horas <= 0) {
    return NextResponse.json({ error: "Horas inválidas" }, { status: 400 });
  }
  if (typeof quantidade !== "number" || quantidade <= 0 || quantidade > 100) {
    return NextResponse.json({ error: "Quantidade inválida" }, { status: 400 });
  }

  const count = await prisma.buildingSlot.count({ where: { buildingId: BigInt(params.id) } });

  const created = [];
  for (let i = 0; i < quantidade; i++) {
    const s = await prisma.buildingSlot.create({
      data: { buildingId: BigInt(params.id), horas, ordem: count + i },
    });
    created.push(s);
  }

  return NextResponse.json(
    toJSONSafe(created.map((s) => ({ id: s.id.toString(), horas: s.horas }))),
    { status: 201 }
  );
}
