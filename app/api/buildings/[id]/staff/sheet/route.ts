import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toJSONSafe } from "@/lib/types";
import { getCurrentUser, hasRole } from "@/lib/auth";

// Building/WO que aparecem NA FOLHA pra um vínculo específico (ver
// StaffBuilding.predioLabel/workOrder e lib/timesheetRows.ts). Vazio = usa o
// nome/WO do prédio. Editável na folha (modo Edit) e na página do prédio.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json();
  if (!body?.sbId) {
    return NextResponse.json({ error: "sbId is required" }, { status: 400 });
  }

  const norm = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

  const data: { predioLabel?: string | null; workOrder?: string | null } = {};
  if ("predioLabel" in body) data.predioLabel = norm(body.predioLabel);
  if ("workOrder" in body) data.workOrder = norm(body.workOrder);
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const target = await prisma.staffBuilding.findFirst({
    where: { id: BigInt(body.sbId), buildingId: BigInt(params.id), role: "cleaner" },
  });
  if (!target) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  const updated = await prisma.staffBuilding.update({ where: { id: target.id }, data });

  return NextResponse.json(
    toJSONSafe({
      sbId: updated.id.toString(),
      predioLabel: updated.predioLabel,
      workOrder: updated.workOrder,
    })
  );
}
