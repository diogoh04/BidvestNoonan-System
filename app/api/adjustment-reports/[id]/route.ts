import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { adjustmentReportPatchSchema } from "@/lib/validation";
import { toJSONSafe } from "@/lib/types";
import { adjustmentReportInclude, mapAdjustmentReport } from "@/lib/adjustmentReportDto";
import { tlBuildingIds } from "@/lib/teamLeaderScope";

async function load(id: bigint, user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) {
  const report = await prisma.adjustmentReport.findUnique({ where: { id }, include: adjustmentReportInclude });
  if (!report) return { report: null, isOwnerTL: false, allowed: false };

  const isOwnerTL =
    hasRole(user, "team_leader") &&
    report.submittedByUserId != null &&
    report.submittedByUserId.toString() === user.userId;

  // Supervisor/Master não vê rascunho alheio.
  const allowed =
    isOwnerTL || (hasRole(user, "master", "supervisor") && report.status !== "draft");

  return { report, isOwnerTL, allowed };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  const { report, allowed } = await load(BigInt(params.id), user);
  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  return NextResponse.json(toJSONSafe(mapAdjustmentReport(report)));
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  const { report, isOwnerTL } = await load(BigInt(params.id), user);
  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });

  const parsed = adjustmentReportPatchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { items, status } = parsed.data;

  // --- Master/Supervisor: só marcar como done ---
  if (status === "done") {
    if (!hasRole(user, "master", "supervisor")) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    if (report.status !== "submitted") {
      return NextResponse.json({ error: "Only a submitted report can be marked done" }, { status: 409 });
    }
    const updated = await prisma.adjustmentReport.update({
      where: { id: report.id },
      data: { status: "done", reviewedByUserId: BigInt(user.userId), reviewedAt: new Date() },
      include: adjustmentReportInclude,
    });
    return NextResponse.json(toJSONSafe(mapAdjustmentReport(updated)));
  }

  // --- TL dono: editar itens / enviar ---
  if (!isOwnerTL) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  if (report.status !== "draft") {
    return NextResponse.json({ error: "This report was already sent" }, { status: 409 });
  }

  // Prédios do time deste TL — todo item tem que ser de um deles.
  const myBuildingIds = new Set((await tlBuildingIds(user)).map((id) => id.toString()));

  if (items) {
    for (const it of items) {
      if (!myBuildingIds.has(it.buildingId)) {
        return NextResponse.json({ error: "One of the items is not in your buildings" }, { status: 403 });
      }
    }

    // Snapshot de nome/número do staff (o relatório é documento histórico).
    const staffIds = items
      .map((it) => it.staffId)
      .filter((v): v is string => !!v)
      .map((v) => BigInt(v));
    const staffById = new Map(
      (
        await prisma.staff.findMany({ where: { id: { in: staffIds } }, select: { id: true, nome: true, staffNumber: true } })
      ).map((s) => [s.id.toString(), s])
    );

    await prisma.$transaction([
      prisma.adjustmentItem.deleteMany({ where: { reportId: report.id } }),
      ...items.map((it, i) => {
        const s = it.staffId ? staffById.get(it.staffId) : null;
        return prisma.adjustmentItem.create({
          data: {
            reportId: report.id,
            buildingId: BigInt(it.buildingId),
            action: it.action,
            staffId: it.staffId ? BigInt(it.staffId) : null,
            staffNome: s?.nome ?? it.staffNome?.trim() ?? null,
            staffNumber: s?.staffNumber ?? it.staffNumber?.trim() ?? null,
            dateFrom: new Date(it.dateFrom + "T00:00:00Z"),
            dateTo: new Date(it.dateTo + "T00:00:00Z"),
            timeFrom: it.timeFrom ?? null,
            timeTo: it.timeTo ?? null,
            reasonCode: it.reasonCode ?? null,
            isCover: it.isCover ?? false,
            note: it.note?.trim() || null,
            ordem: i,
          },
        });
      }),
    ]);
  }

  if (status === "submitted") {
    const count = await prisma.adjustmentItem.count({ where: { reportId: report.id } });
    if (count === 0) {
      return NextResponse.json({ error: "Add at least one item before sending" }, { status: 400 });
    }
    await prisma.adjustmentReport.update({
      where: { id: report.id },
      data: { status: "submitted", submittedAt: new Date() },
    });
  }

  const fresh = await prisma.adjustmentReport.findUnique({
    where: { id: report.id },
    include: adjustmentReportInclude,
  });
  return NextResponse.json(toJSONSafe(mapAdjustmentReport(fresh)));
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  const { report, isOwnerTL } = await load(BigInt(params.id), user);
  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  // Só o TL dono, e só enquanto rascunho — depois de enviado não dá mais.
  if (!isOwnerTL || report.status !== "draft") {
    return NextResponse.json({ error: "Only your own draft can be deleted" }, { status: 403 });
  }

  await prisma.adjustmentReport.delete({ where: { id: report.id } });
  return NextResponse.json({ ok: true });
}
