import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildingInputSchema } from "@/lib/validation";
import { toJSONSafe } from "@/lib/types";

export async function GET() {
  const buildings = await prisma.building.findMany({
    orderBy: { nome: "asc" },
    include: { teamLeaders: { include: { staff: true } } },
  });

  return NextResponse.json(
    toJSONSafe(
      buildings.map((b) => ({
        id: b.id.toString(),
        nome: b.nome,
        totalCleaners: b.teamLeaders.filter((l) => l.role === "cleaner").length,
        totalTeamLeaders: b.teamLeaders.filter((l) => l.role === "team_leader").length,
      }))
    )
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = buildingInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const created = await prisma.building.create({ data: { nome: parsed.data.nome } });
  return NextResponse.json(toJSONSafe({ id: created.id.toString(), nome: created.nome }), {
    status: 201,
  });
}
