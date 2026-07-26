import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toJSONSafe } from "@/lib/types";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; slotId: string } }
) {
  const body = await req.json();
  const horas = body.horas;

  if (typeof horas !== "number" || horas <= 0) {
    return NextResponse.json({ error: "Horas inválidas" }, { status: 400 });
  }

  const result = await prisma.buildingSlot.updateMany({
    where: { id: BigInt(params.slotId), buildingId: BigInt(params.id) },
    data: { horas },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Vaga não encontrada" }, { status: 404 });
  }

  return NextResponse.json(toJSONSafe({ id: params.slotId, horas }));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; slotId: string } }
) {
  await prisma.buildingSlot.deleteMany({
    where: { id: BigInt(params.slotId), buildingId: BigInt(params.id) },
  });
  return NextResponse.json({ ok: true });
}
