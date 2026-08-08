import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffInputSchema } from "@/lib/validation";
import { toJSONSafe, StaffDTO } from "@/lib/types";
import { getCurrentUser, hasRole } from "@/lib/auth";

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
    status: w.status ?? null,
    blockedAt: w.blockedAt ? w.blockedAt.toISOString() : null,
    lastWorkingDay: w.lastWorkingDay ? w.lastWorkingDay.toISOString() : null,
    voluntaryLeave: w.voluntaryLeave ?? null,
    leaveReason: w.leaveReason ?? null,
    leaveReasonNote: w.leaveReasonNote ?? null,
  };
}


export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const staff = await prisma.staff.findUnique({
    where: { id: BigInt(params.id) },
    include: {
      buildingsAsTeamLeader: { include: { building: true } },
      observations: { orderBy: { data: "desc" } },
    },
  });

  if (!staff) return NextResponse.json({ error: "Staff not found" }, { status: 404 });

  return NextResponse.json(
    toJSONSafe({
      ...mapStaff(staff),
      observations: staff.observations.map((f) => ({
        id: f.id.toString(),
        texto: f.texto,
        data: f.data ? f.data.toISOString() : null,
      })),
    })
  );
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = staffInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const staffId = BigInt(params.id);

  // Staff com status especial (P45/LE/Blocked) não tem vínculo real de
  // prédio — ignora quaisquer assignments enviados nesse caso.
  const assignments = data.status ? [] : data.assignments;

  await prisma.staffBuilding.deleteMany({ where: { staffId } });

  const updated = await prisma.staff.update({
    where: { id: staffId },
    data: {
      nome: data.nome,
      staffNumber: data.staffNumber || null,
      telefone: data.telefone || null,
      status: data.status ?? null,
      blockedAt: data.status === "blocked" && data.blockedAt ? new Date(data.blockedAt) : null,
      lastWorkingDay: data.status === "p45" && data.lastWorkingDay ? new Date(data.lastWorkingDay) : null,
      voluntaryLeave: data.status === "p45" ? data.voluntaryLeave ?? null : null,
      leaveReason: data.status === "p45" && data.voluntaryLeave === false ? data.leaveReason ?? null : null,
      leaveReasonNote:
        data.status === "p45" && data.voluntaryLeave === false && data.leaveReason === "other"
          ? data.leaveReasonNote?.trim() || null
          : null,
      buildingsAsTeamLeader:
        assignments.length > 0
          ? {
              create: assignments.map((a) => ({
                buildingId: BigInt(a.buildingId),
                role: a.role,
                horas: a.horas ?? null,
              })),
            }
          : undefined,
    },
    include: { buildingsAsTeamLeader: { include: { building: true } } },
  });

  return NextResponse.json(toJSONSafe(mapStaff(updated)));
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  await prisma.staff.delete({ where: { id: BigInt(params.id) } });
  return NextResponse.json({ ok: true });
}
