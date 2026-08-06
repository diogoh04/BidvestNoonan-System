import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toJSONSafe } from "@/lib/types";
import { getCurrentUser, hasRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const teamLeaders = await prisma.staff.findMany({
    where: { buildingsAsTeamLeader: { some: { role: "team_leader" } } },
    orderBy: { nome: "asc" },
    include: { buildingsAsTeamLeader: { include: { building: true } } },
  });

  return NextResponse.json(
    toJSONSafe(
      teamLeaders.map((tl) => ({
        id: tl.id.toString(),
        nome: tl.nome,
        staffNumber: tl.staffNumber,
        telefone: tl.telefone,
        buildings: tl.buildingsAsTeamLeader
          .filter((l) => l.role === "team_leader")
          .map((l) => ({
            id: l.building.id.toString(),
            nome: l.building.nome,
          })),
      }))
    )
  );
}
