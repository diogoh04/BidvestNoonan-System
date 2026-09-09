import { cookies } from "next/headers";
import { verifySessionToken } from "./session";
import { prisma } from "./prisma";
import type { AppRole } from "./types";

export type SessionUser = {
  userId: string;
  role: AppRole;
  staffId: string | null;
  // Time da conta "team_leader" (ver User.teamId / lib/teamLeaderScope.ts).
  teamId: string | null;
};

// Sem ida ao banco: role/staffId/teamId já vêm dentro do cookie assinado.
export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = cookies().get("session")?.value;
  const payload = await verifySessionToken(token);
  if (!payload) return null;
  return {
    userId: payload.userId,
    role: payload.role,
    staffId: payload.staffId,
    teamId: payload.teamId ?? null,
  };
}

export function hasRole(user: SessionUser | null, ...roles: AppRole[]): boolean {
  return !!user && roles.includes(user.role);
}

// Um Team Leader só pode ver/comentar em cleaners de prédios do TIME dele.
export async function teamLeaderCanAccessStaff(user: SessionUser, staffId: bigint): Promise<boolean> {
  if (!user.teamId) return false;
  const link = await prisma.staffBuilding.findFirst({
    where: {
      staffId,
      role: "cleaner",
      building: { teamId: BigInt(user.teamId) },
    },
  });
  return !!link;
}
