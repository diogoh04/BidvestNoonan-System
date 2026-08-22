import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { closeBuildingAssignment } from "@/lib/staffHistory";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; staffId: string } }
) {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // O mesmo staff pode ter dois vínculos no mesmo prédio (cleaner e team
  // leader) — precisa saber qual dos dois remover.
  const role = new URL(req.url).searchParams.get("role");
  if (role !== "cleaner" && role !== "team_leader") {
    return NextResponse.json({ error: "Invalid or missing role" }, { status: 400 });
  }

  try {
    await prisma.staffBuilding.delete({
      where: {
        staffId_buildingId_role: {
          staffId: BigInt(params.staffId),
          buildingId: BigInt(params.id),
          role,
        },
      },
    });

    // Histórico (ver lib/staffHistory.ts) — só faz sentido pra cleaner; o
    // vínculo "team_leader" aqui é derivado de TeamLeader (lib/teams.ts já
    // cuida do histórico de liderança quando o time é que muda).
    if (role === "cleaner") {
      await closeBuildingAssignment(BigInt(params.staffId), BigInt(params.id));
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }
}
