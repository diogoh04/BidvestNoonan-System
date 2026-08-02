import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toJSONSafe } from "@/lib/types";
import { getCurrentUser, hasRole } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

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
