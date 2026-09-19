import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toJSONSafe } from "@/lib/types";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { tlOwnsBuilding } from "@/lib/teamLeaderScope";
import { openBuildingAssignment } from "@/lib/staffHistory";

// POST { staffId, horas } -> cria um vínculo cleaner (StaffBuilding) neste
// prédio pra um staff já cadastrado no sistema. Pensado pra preencher uma
// "Open slot" (BuildingSlot sem staff casado — ver lib/openSlots.ts) direto
// da tela do prédio/time, sem passar pelo cadastro do staff. Master pode em
// qualquer prédio; team_leader só nos prédios do próprio time (mesma regra
// de order/route.ts e sheet/route.ts). Não bloqueia staff já alocado em
// outro prédio/time — a pessoa fica com os dois vínculos.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const buildingId = BigInt(params.id);

  if (hasRole(user, "team_leader")) {
    if (!(await tlOwnsBuilding(user!, buildingId))) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
  } else if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json();
  const staffId = body?.staffId;
  const horas = body?.horas;

  if (!staffId || typeof staffId !== "string") {
    return NextResponse.json({ error: "staffId is required" }, { status: 400 });
  }
  if (horas !== null && horas !== undefined && (typeof horas !== "number" || horas <= 0)) {
    return NextResponse.json({ error: "Invalid hours" }, { status: 400 });
  }

  const staff = await prisma.staff.findUnique({ where: { id: BigInt(staffId) } });
  if (!staff) {
    return NextResponse.json({ error: "Staff not found" }, { status: 404 });
  }
  // Staff com status especial (P45/LE/Blocked/Sick) não tem vínculo real de
  // prédio — mesma regra de POST /api/staff (ver comentário lá).
  if (staff.status) {
    return NextResponse.json({ error: "This staff has a special status and can't be assigned to a building" }, { status: 400 });
  }

  const building = await prisma.building.findUnique({ where: { id: buildingId }, select: { id: true } });
  if (!building) {
    return NextResponse.json({ error: "Building not found" }, { status: 404 });
  }

  const created = await prisma.staffBuilding.create({
    data: {
      staffId: staff.id,
      buildingId,
      role: "cleaner",
      horas: horas ?? null,
    },
  });

  await openBuildingAssignment(staff.id, buildingId, { horas: horas ?? null });

  return NextResponse.json(
    toJSONSafe({
      id: staff.id.toString(),
      sbId: created.id.toString(),
      nome: staff.nome,
      staffNumber: staff.staffNumber,
      telefone: staff.telefone,
      horasSemana: created.horas ?? staff.horasSemana,
      ordem: created.ordem,
      predioLabel: created.predioLabel,
      workOrder: created.workOrder,
    }),
    { status: 201 }
  );
}
