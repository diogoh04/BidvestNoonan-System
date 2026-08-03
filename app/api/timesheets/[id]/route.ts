import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { timesheetPatchSchema } from "@/lib/validation";
import { toJSONSafe, TimesheetDTO } from "@/lib/types";

function mapTimesheet(t: any): TimesheetDTO {
  return {
    id: t.id.toString(),
    buildingId: t.buildingId.toString(),
    buildingNome: t.building.nome,
    buildingWorkOrder: t.building.workOrder,
    weekStart: t.weekStart.toISOString().slice(0, 10),
    status: t.status,
    entries: t.entries,
    submittedByUserId: t.submittedByUserId ? t.submittedByUserId.toString() : null,
    submittedByNome: t.submittedByUser?.staff?.nome ?? t.submittedByUser?.username ?? null,
    submittedAt: t.submittedAt ? t.submittedAt.toISOString() : null,
    reviewedByNome: t.reviewedByUser?.staff?.nome ?? t.reviewedByUser?.username ?? null,
    reviewedAt: t.reviewedAt ? t.reviewedAt.toISOString() : null,
    deletedAt: t.deletedAt ? t.deletedAt.toISOString() : null,
    deletedByNome: t.deletedByUser?.staff?.nome ?? t.deletedByUser?.username ?? null,
  };
}

const timesheetInclude = {
  building: true,
  submittedByUser: { include: { staff: true } },
  reviewedByUser: { include: { staff: true } },
  deletedByUser: { include: { staff: true } },
} as const;

async function loadWithOwnership(id: bigint, user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) {
  const timesheet = await prisma.timesheet.findUnique({
    where: { id },
    include: timesheetInclude,
  });
  if (!timesheet) return { timesheet: null, allowed: false };

  if (hasRole(user, "master", "supervisor")) return { timesheet, allowed: true };

  if (hasRole(user, "team_leader") && user.staffId) {
    const owns = await prisma.staffBuilding.findFirst({
      where: { staffId: BigInt(user.staffId), buildingId: timesheet.buildingId, role: "team_leader" },
    });
    return { timesheet, allowed: !!owns };
  }

  return { timesheet, allowed: false };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { timesheet, allowed } = await loadWithOwnership(BigInt(params.id), user);
  if (!timesheet) return NextResponse.json({ error: "Folha não encontrada" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  return NextResponse.json(toJSONSafe(mapTimesheet(timesheet)));
}

// PATCH — dois usos bem separados, nunca misturados na mesma chamada:
//  - Team Leader (dono do prédio): edita `entries` enquanto draft/submitted,
//    e pode transicionar draft -> submitted.
//  - Master/Supervisor: só pode transicionar submitted -> done (não edita
//    os horários lançados).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { timesheet, allowed } = await loadWithOwnership(BigInt(params.id), user);
  if (!timesheet) return NextResponse.json({ error: "Folha não encontrada" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const body = await req.json();
  const parsed = timesheetPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { entries, status, restore } = parsed.data;

  const data: Record<string, unknown> = {};

  if (hasRole(user, "team_leader")) {
    if (timesheet.status === "done") {
      return NextResponse.json({ error: "Folha já concluída pelo supervisor" }, { status: 409 });
    }
    if (entries) data.entries = entries as any;
    if (status) {
      if (status !== "submitted" || timesheet.status !== "draft") {
        return NextResponse.json({ error: "Transição de status inválida" }, { status: 400 });
      }
      data.status = "submitted";
      data.submittedByUserId = BigInt(user.userId);
      data.submittedAt = new Date();
    }
  } else if (hasRole(user, "master", "supervisor")) {
    if (entries) {
      return NextResponse.json(
        { error: "Master/Supervisor não editam os horários lançados" },
        { status: 403 }
      );
    }
    if (restore) {
      if (!timesheet.deletedAt) {
        return NextResponse.json({ error: "Folha não está na lixeira" }, { status: 409 });
      }
      data.deletedAt = null;
      data.deletedByUserId = null;
    }
    if (status) {
      if (status !== "done" || timesheet.status !== "submitted") {
        return NextResponse.json({ error: "Transição de status inválida" }, { status: 400 });
      }
      data.status = "done";
      data.reviewedByUserId = BigInt(user.userId);
      data.reviewedAt = new Date();
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(toJSONSafe(mapTimesheet(timesheet)));
  }

  const updated = await prisma.timesheet.update({
    where: { id: timesheet.id },
    data,
    include: timesheetInclude,
  });

  return NextResponse.json(toJSONSafe(mapTimesheet(updated)));
}

// DELETE — na verdade move pra lixeira (deletedAt/deletedByUserId), nunca
// apaga a linha de fato: dá pra restaurar depois em /review/excluidas se
// foi excluída sem querer. Team Leader só na folha do próprio prédio
// enquanto ela ainda não foi concluída pelo supervisor (preserva o
// histórico já revisado); Master e Supervisor podem em qualquer status.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { timesheet, allowed } = await loadWithOwnership(BigInt(params.id), user);
  if (!timesheet) return NextResponse.json({ error: "Folha não encontrada" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  if (hasRole(user, "team_leader") && timesheet.status === "done") {
    return NextResponse.json({ error: "Folha já concluída pelo supervisor não pode ser excluída" }, { status: 409 });
  }

  await prisma.timesheet.update({
    where: { id: timesheet.id },
    data: { deletedAt: new Date(), deletedByUserId: BigInt(user.userId) },
  });
  return NextResponse.json({ ok: true });
}
