import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { timesheetPatchSchema } from "@/lib/validation";
import { toJSONSafe } from "@/lib/types";
import { mapTimesheet, timesheetInclude } from "@/lib/timesheetDto";
import { tlOwnsBuilding } from "@/lib/teamLeaderScope";

async function loadWithOwnership(id: bigint, user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) {
  const timesheet = await prisma.timesheet.findUnique({
    where: { id },
    include: timesheetInclude,
  });
  if (!timesheet) return { timesheet: null, allowed: false };

  if (hasRole(user, "master", "supervisor")) return { timesheet, allowed: true };

  if (hasRole(user, "team_leader")) {
    return { timesheet, allowed: await tlOwnsBuilding(user, timesheet.buildingId) };
  }

  return { timesheet, allowed: false };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  const { timesheet, allowed } = await loadWithOwnership(BigInt(params.id), user);
  if (!timesheet) return NextResponse.json({ error: "Timesheet not found" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  return NextResponse.json(toJSONSafe(mapTimesheet(timesheet)));
}

// PATCH — dois usos bem separados, nunca misturados na mesma chamada:
//  - Team Leader (dono do prédio): edita `entries` (auto-save) enquanto a
//    folha ainda é `draft`, e transiciona draft -> submitted ("Send to
//    supervisor"). Depois de enviada a PREVISÃO está congelada — mudanças do
//    meio da quinzena viram AdjustmentReport (relatório à parte), não edição
//    aqui.
//  - Master/Supervisor: só pode transicionar submitted -> done (não edita
//    os horários lançados).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  const { timesheet, allowed } = await loadWithOwnership(BigInt(params.id), user);
  if (!timesheet) return NextResponse.json({ error: "Timesheet not found" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const body = await req.json();
  const parsed = timesheetPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { entries, status, restore } = parsed.data;

  const data: Record<string, unknown> = {};

  if (hasRole(user, "team_leader")) {
    if (timesheet.status !== "draft") {
      return NextResponse.json(
        { error: "This forecast was already sent to the supervisor. Log changes as an adjustment report." },
        { status: 409 }
      );
    }
    if (entries) data.entries = entries as any;
    if (status) {
      // "Send to supervisor": draft -> submitted. Vale pra weekly e biweekly
      // (o Launch foi removido — a quinzenal é enviada e revisada inteira).
      if (status !== "submitted") {
        return NextResponse.json({ error: "Invalid status transition" }, { status: 400 });
      }
      data.status = "submitted";
      data.submittedByUserId = BigInt(user.userId);
      data.submittedAt = new Date();
      // "A folha como foi salva a primeira vez" — congelada aqui, nunca mais
      // reescrita. É o que o supervisor revê.
      data.submittedSnapshot = (entries ?? timesheet.entries) as any;
    }
  } else if (hasRole(user, "master", "supervisor")) {
    if (entries) {
      return NextResponse.json(
        { error: "Master/Supervisor cannot edit logged hours" },
        { status: 403 }
      );
    }
    if (restore) {
      if (!timesheet.deletedAt) {
        return NextResponse.json({ error: "Timesheet is not in the trash" }, { status: 409 });
      }
      data.deletedAt = null;
      data.deletedByUserId = null;
    }
    if (status) {
      if (status !== "done" || timesheet.status !== "submitted") {
        return NextResponse.json({ error: "Invalid status transition" }, { status: 400 });
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

// DELETE — por padrão move pra lixeira (deletedAt/deletedByUserId), nunca
// apaga a linha de fato: dá pra restaurar depois em /review/excluidas se foi
// excluída sem querer. Team Leader só na folha do próprio prédio enquanto
// ela ainda não foi concluída pelo supervisor (preserva o histórico já
// revisado); Master e Supervisor podem em qualquer status.
//
// ?permanent=1 — apaga de vez (tira do banco de verdade), só disponível pra
// quem já está NA lixeira (deletedAt já setado) e só Master/Supervisor,
// direto de /review/excluidas. Usado pra limpar folha de teste — sem isso
// ela ficaria acumulando na lixeira pra sempre.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  const { timesheet, allowed } = await loadWithOwnership(BigInt(params.id), user);
  if (!timesheet) return NextResponse.json({ error: "Timesheet not found" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const permanent = new URL(req.url).searchParams.get("permanent") === "1";
  if (permanent) {
    if (!hasRole(user, "master", "supervisor")) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    if (!timesheet.deletedAt) {
      return NextResponse.json({ error: "Only an already-deleted timesheet can be permanently removed" }, { status: 409 });
    }
    await prisma.timesheet.delete({ where: { id: timesheet.id } });
    return NextResponse.json({ ok: true });
  }

  if (hasRole(user, "team_leader") && timesheet.status === "done") {
    return NextResponse.json({ error: "Timesheet already completed by supervisor cannot be deleted" }, { status: 409 });
  }

  await prisma.timesheet.update({
    where: { id: timesheet.id },
    data: { deletedAt: new Date(), deletedByUserId: BigInt(user.userId) },
  });
  return NextResponse.json({ ok: true });
}
