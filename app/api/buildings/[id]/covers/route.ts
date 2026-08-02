import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toJSONSafe } from "@/lib/types";
import { getCurrentUser, hasRole } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const covers = await prisma.buildingCover.findMany({
    where: { buildingId: BigInt(params.id) },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(
    toJSONSafe(
      covers.map((c) => ({ id: c.id.toString(), nome: c.nome, staffNumber: c.staffNumber, horas: c.horas }))
    )
  );
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const body = await req.json();
  const nome = typeof body.nome === "string" ? body.nome.trim() : null;
  const staffNumber = typeof body.staffNumber === "string" ? body.staffNumber.trim() : null;
  const horas = body.horas;

  if (!nome) {
    return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
  }
  if (horas != null && (typeof horas !== "number" || horas <= 0)) {
    return NextResponse.json({ error: "Horas inválidas" }, { status: 400 });
  }

  const created = await prisma.buildingCover.create({
    data: {
      buildingId: BigInt(params.id),
      nome,
      staffNumber: staffNumber || null,
      horas: horas ?? null,
    },
  });

  return NextResponse.json(
    toJSONSafe({
      id: created.id.toString(),
      nome: created.nome,
      staffNumber: created.staffNumber,
      horas: created.horas,
    }),
    { status: 201 }
  );
}
