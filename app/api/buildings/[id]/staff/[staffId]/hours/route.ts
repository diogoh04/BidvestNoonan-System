import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toJSONSafe } from "@/lib/types";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; staffId: string } }
) {
  const body = await req.json();
  const horas = body.horasSemana;

  if (horas !== null && (typeof horas !== "number" || horas < 0)) {
    return NextResponse.json({ error: "Horas inválidas" }, { status: 400 });
  }

  try {
    const updated = await prisma.staffBuilding.update({
      where: {
        staffId_buildingId: {
          staffId: BigInt(params.staffId),
          buildingId: BigInt(params.id),
        },
      },
      data: { horas },
    });

    return NextResponse.json(
      toJSONSafe({
        staffId: updated.staffId.toString(),
        buildingId: updated.buildingId.toString(),
        horas: updated.horas,
      })
    );
  } catch {
    return NextResponse.json({ error: "Vínculo não encontrado" }, { status: 404 });
  }
}
