import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toJSONSafe } from "@/lib/types";
import { getCurrentUser, hasRole } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; staffId: string } }
) {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const body = await req.json();
  const horas = body.horasSemana;
  const role = body.role;

  if (horas !== null && (typeof horas !== "number" || horas < 0)) {
    return NextResponse.json({ error: "Horas inválidas" }, { status: 400 });
  }

  // O mesmo staff pode ter dois vínculos no mesmo prédio (cleaner e team
  // leader), cada um com suas próprias horas — precisa saber qual dos dois.
  if (role !== "cleaner" && role !== "team_leader") {
    return NextResponse.json({ error: "Papel (role) inválido ou ausente" }, { status: 400 });
  }

  try {
    const updated = await prisma.staffBuilding.update({
      where: {
        staffId_buildingId_role: {
          staffId: BigInt(params.staffId),
          buildingId: BigInt(params.id),
          role,
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
