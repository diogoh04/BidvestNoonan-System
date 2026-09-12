import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { toJSONSafe } from "@/lib/types";

// Prédios do TIME da conta "team_leader" logada — derivados de
// Building.teamId, nunca de um id vindo do cliente.
export async function GET() {
  const user = await getCurrentUser();
  if (!hasRole(user, "team_leader") || !user!.teamId) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const teamId = BigInt(user!.teamId);

  const [team, buildings] = await Promise.all([
    prisma.team.findUnique({
      where: { id: teamId },
      include: { leaders: { include: { staff: true } } },
    }),
    prisma.building.findMany({
      where: { teamId },
      orderBy: [{ teamOrder: "asc" }, { id: "asc" }],
    }),
  ]);

  const buildingIds = buildings.map((b) => b.id);
  const [cleanerLinks, slots] = await Promise.all([
    prisma.staffBuilding.findMany({
      where: { buildingId: { in: buildingIds }, role: "cleaner" },
      include: { staff: true },
      orderBy: [{ ordem: "asc" }, { id: "asc" }],
    }),
    prisma.buildingSlot.findMany({
      where: { buildingId: { in: buildingIds } },
      orderBy: { ordem: "asc" },
    }),
  ]);

  const leaderNames = (team?.leaders ?? [])
    .map((l) => l.staff?.nome)
    .filter((n): n is string => !!n);

  return NextResponse.json(
    toJSONSafe({
      // "Perfil" da conta: nome exibido (líderes do time) + número do time.
      // Sem líder cadastrado ainda, `nome` fica null — "Team N" já vai em
      // `teamNumber` à parte; usar isso como nome aqui fazia a linha "Team
      // Leader" da folha (ver LancarClient -> CombinedTimesheetEditor)
      // mostrar "Team 28" como se fosse o nome de uma pessoa.
      id: user!.userId,
      nome: leaderNames.length ? leaderNames.join(", ") : null,
      staffNumber: null,
      teamNumber: team?.number ?? null,
      buildings: buildings.map((b) => ({
        id: b.id.toString(),
        nome: b.nome,
        workOrder: b.workOrder,
        slots: slots.filter((s) => s.buildingId === b.id).map((s) => ({ id: s.id.toString(), horas: s.horas })),
        cleaners: cleanerLinks
          .filter((c) => c.buildingId === b.id)
          .map((c) => ({
            id: c.staff.id.toString(),
            sbId: c.id.toString(),
            nome: c.staff.nome,
            staffNumber: c.staff.staffNumber,
            telefone: c.staff.telefone,
            horasSemana: c.horas ?? c.staff.horasSemana,
            ordem: c.ordem,
            predioLabel: c.predioLabel,
            workOrder: c.workOrder,
          })),
      })),
    })
  );
}
