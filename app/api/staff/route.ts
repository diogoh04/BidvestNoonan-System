import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffInputSchema } from "@/lib/validation";
import { toJSONSafe, StaffDTO } from "@/lib/types";

function mapStaff(w: any): StaffDTO {
  return {
    id: w.id.toString(),
    nome: w.nome,
    telefone: w.telefone,
    staffNumber: w.staffNumber,
    createdAt: w.createdAt ? w.createdAt.toISOString() : null,
    buildings: (w.buildingsAsTeamLeader ?? []).map((sb: any) => ({
      id: sb.building.id.toString(),
      nome: sb.building.nome,
      role: sb.role,
      horas: sb.horas,
    })),
  };
}

// GET /api/staff?q=nome ou staff number&buildingId=123&role=cleaner
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const buildingId = searchParams.get("buildingId");
  const role = searchParams.get("role");

  const and: any[] = [];

  if (role === "cleaner" || role === "team_leader") {
    and.push({ buildingsAsTeamLeader: { some: { role } } });
  }

  if (q) {
    and.push({
      OR: [
        { nome: { contains: q, mode: "insensitive" } },
        { staffNumber: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (buildingId) {
    and.push({
      OR: [
        { buildingId: BigInt(buildingId) },
        { buildingsAsTeamLeader: { some: { buildingId: BigInt(buildingId) } } },
      ],
    });
  }

  const where: any = and.length > 0 ? { AND: and } : {};

  const staff = await prisma.staff.findMany({
    where,
    include: { buildingsAsTeamLeader: { include: { building: true } } },
    orderBy: { nome: "asc" },
  });

  return NextResponse.json(toJSONSafe(staff.map(mapStaff)));
}

// POST /api/staff  - cadastra cleaner ou team leader
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = staffInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  const created = await prisma.staff.create({
    data: {
      nome: data.nome,
      staffNumber: data.staffNumber,
      telefone: data.telefone || null,
      buildingsAsTeamLeader:
        data.assignments.length > 0
          ? {
              create: data.assignments.map((a) => ({
                buildingId: BigInt(a.buildingId),
                role: a.role,
                horas: a.horas ?? null,
              })),
            }
          : undefined,
    },
    include: { buildingsAsTeamLeader: { include: { building: true } } },
  });

  return NextResponse.json(toJSONSafe(mapStaff(created)), { status: 201 });
}
