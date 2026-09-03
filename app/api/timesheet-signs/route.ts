import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toJSONSafe } from "@/lib/types";
import { getCurrentUser, hasRole } from "@/lib/auth";

// Sign In/Sign Out digitados direto na folha impressa por prédio (ver
// TimesheetView) — nunca escreve em Building/Timesheet, só nesta tabela
// separada.

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const subjectType = searchParams.get("subjectType");
  const subjectIdsParam = searchParams.get("subjectIds");
  if (!subjectType || !subjectIdsParam) {
    return NextResponse.json({ error: "subjectType and subjectIds are required" }, { status: 400 });
  }

  let subjectIds: bigint[];
  try {
    subjectIds = subjectIdsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => BigInt(s));
  } catch {
    return NextResponse.json({ error: "Invalid subjectIds" }, { status: 400 });
  }
  if (subjectIds.length === 0) return NextResponse.json([]);

  const rows = await prisma.timesheetSheetSign.findMany({
    where: { subjectType, subjectId: { in: subjectIds } },
  });

  return NextResponse.json(
    toJSONSafe(
      rows.map((r) => ({
        subjectType: r.subjectType,
        subjectId: r.subjectId.toString(),
        scope: r.scope,
        signIn: r.signIn,
        signOut: r.signOut,
      }))
    )
  );
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json();
  const subjectType = typeof body.subjectType === "string" ? body.subjectType : null;
  const scope = typeof body.scope === "string" ? body.scope : null;
  if (!subjectType || !scope || body.subjectId == null) {
    return NextResponse.json({ error: "subjectType, subjectId and scope are required" }, { status: 400 });
  }

  let subjectId: bigint;
  try {
    subjectId = BigInt(body.subjectId);
  } catch {
    return NextResponse.json({ error: "Invalid subjectId" }, { status: 400 });
  }

  const signIn = typeof body.signIn === "string" ? body.signIn : null;
  const signOut = typeof body.signOut === "string" ? body.signOut : null;

  const saved = await prisma.timesheetSheetSign.upsert({
    where: { subjectType_subjectId_scope: { subjectType, subjectId, scope } },
    update: { signIn, signOut },
    create: { subjectType, subjectId, scope, signIn, signOut },
  });

  return NextResponse.json(
    toJSONSafe({
      subjectType: saved.subjectType,
      subjectId: saved.subjectId.toString(),
      scope: saved.scope,
      signIn: saved.signIn,
      signOut: saved.signOut,
    })
  );
}
