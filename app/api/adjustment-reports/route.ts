import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { adjustmentReportCreateSchema } from "@/lib/validation";
import { toJSONSafe } from "@/lib/types";
import { adjustmentReportInclude, mapAdjustmentReport } from "@/lib/adjustmentReportDto";

// GET /api/adjustment-reports — TL: os próprios; Master/Supervisor: todos.
// Pendentes (submitted) primeiro, depois mais recente.
export async function GET(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  const where: any = {};
  if (hasRole(user, "team_leader")) {
    where.submittedByUserId = BigInt(user.userId);
  } else if (!hasRole(user, "master", "supervisor")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  } else {
    // Supervisor/Master não vê rascunhos de TL — só o que foi enviado.
    where.status = { in: ["submitted", "done"] };
  }

  const reports = await prisma.adjustmentReport.findMany({
    where,
    include: adjustmentReportInclude,
    // "submitted" antes de "done"; "draft" fica no fim (só o TL vê).
    orderBy: [{ status: "asc" }, { weekStart: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(toJSONSafe(reports.map(mapAdjustmentReport)));
}

// POST /api/adjustment-reports { weekStart } — GET-or-create: se o TL já tem
// um rascunho pra essa semana, devolve ele (pra ir acumulando os ajustes até
// enviar); senão cria um novo.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!hasRole(user, "team_leader") || !user!.teamId) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const parsed = adjustmentReportCreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const weekStart = new Date(parsed.data.weekStart + "T00:00:00Z");
  const submittedByUserId = BigInt(user!.userId);

  const existing = await prisma.adjustmentReport.findFirst({
    where: { submittedByUserId, weekStart, status: "draft" },
    include: adjustmentReportInclude,
  });
  if (existing) {
    return NextResponse.json(toJSONSafe(mapAdjustmentReport(existing)));
  }

  const created = await prisma.adjustmentReport.create({
    data: { weekStart, status: "draft", submittedByUserId },
    include: adjustmentReportInclude,
  });

  return NextResponse.json(toJSONSafe(mapAdjustmentReport(created)), { status: 201 });
}
