import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toJSONSafe } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const teamLeaders = await prisma.staff.findMany({
    where: { role: "team_leader" },
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
        buildings: tl.buildingsAsTeamLeader.map((l) => ({
          id: l.building.id.toString(),
          nome: l.building.nome,
        })),
      }))
    )
  );
}
