import type { UserDTO } from "./types";

// `u` deve vir com `userNameInclude` (ver lib/userName.ts).
export function mapUser(u: any): UserDTO {
  const teamLeaders: string[] = (u.team?.leaders ?? [])
    .map((l: any) => l.staff?.nome)
    .filter((n: unknown): n is string => !!n);
  const teamLabel = u.team
    ? [u.team.number != null ? `Team ${u.team.number}` : "Team", teamLeaders.join(", ")]
        .filter(Boolean)
        .join(" — ")
    : null;
  return {
    id: u.id.toString(),
    username: u.username,
    role: u.role,
    active: u.active,
    teamId: u.teamId ? u.teamId.toString() : null,
    teamLabel,
    createdAt: u.createdAt ? u.createdAt.toISOString() : null,
  };
}
