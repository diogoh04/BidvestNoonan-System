import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toJSONSafe } from "@/lib/types";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const horas = body.horasSemana;

  if (horas !== null && (typeof horas !== "number" || horas < 0)) {
    return NextResponse.json({ error: "Horas inválidas" }, { status: 400 });
  }

  const updated = await prisma.staff.update({
    where: { id: BigInt(params.id) },
    data: { horasSemana: horas },
  });

  return NextResponse.json(
    toJSONSafe({ id: updated.id.toString(), horasSemana: updated.horasSemana })
  );
}
