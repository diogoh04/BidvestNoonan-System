import { cookies } from "next/headers";
import { verifySessionToken } from "./session";
import { prisma } from "./prisma";
import type { AppRole } from "./types";

export type SessionUser = {
  userId: string;
  role: AppRole;
  staffId: string | null;
};

// Sem ida ao banco: role/staffId já vêm dentro do cookie assinado.
export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = cookies().get("session")?.value;
  const payload = await verifySessionToken(token);
  if (!payload) return null;
  return { userId: payload.userId, role: payload.role, staffId: payload.staffId };
}

export function hasRole(user: SessionUser | null, ...roles: AppRole[]): boolean {
  return !!user && roles.includes(user.role);
}

// Um Team Leader só pode ver/comentar em cleaners de prédios onde ele
// mesmo tem o vínculo StaffBuilding role="team_leader" — nunca em staff de
// prédios de outro team leader.
export async function teamLeaderCanAccessStaff(user: SessionUser, staffId: bigint): Promise<boolean> {
  if (!user.staffId) return false;
  const link = await prisma.staffBuilding.findFirst({
    where: {
      staffId,
      role: "cleaner",
      building: { teamLeaders: { some: { staffId: BigInt(user.staffId), role: "team_leader" } } },
    },
  });
  return !!link;
}
