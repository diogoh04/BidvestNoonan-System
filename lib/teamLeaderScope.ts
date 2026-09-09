import { prisma } from "./prisma";
import type { SessionUser } from "./auth";

// Prédios que a conta "team_leader" logada enxerga/edita — SEMPRE derivados
// do time da conta (User.teamId), nunca de um id vindo do cliente. Substitui
// o antigo caminho por StaffBuilding role="team_leader".
export async function tlBuildingIds(user: SessionUser): Promise<bigint[]> {
  if (!user.teamId) return [];
  const rows = await prisma.building.findMany({
    where: { teamId: BigInt(user.teamId) },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export async function tlOwnsBuilding(user: SessionUser, buildingId: bigint): Promise<boolean> {
  if (!user.teamId) return false;
  const b = await prisma.building.findFirst({
    where: { id: buildingId, teamId: BigInt(user.teamId) },
    select: { id: true },
  });
  return !!b;
}
