// Include pra resolver o nome exibido de uma conta de acesso: staff direto
// (contas antigas) ou, pras contas novas, os líderes conectados do time.
export const userNameInclude = {
  staff: true,
  team: { include: { leaders: { include: { staff: true } } } },
} as const;

// Nome que aparece pro supervisor (não o login técnico): o Staff da conta,
// ou os líderes do time da conta, ou "Team N", ou o username.
export function userDisplayName(u: any): string | null {
  if (!u) return null;
  if (u.staff?.nome) return u.staff.nome;
  const leaders: string[] = (u.team?.leaders ?? [])
    .map((l: any) => l.staff?.nome)
    .filter((n: unknown): n is string => !!n);
  if (leaders.length) return leaders.join(", ");
  if (u.team?.number != null) return `Team ${u.team.number}`;
  return u.username ?? null;
}

// "Team N" da conta, se houver.
export function userTeamNumber(u: any): number | null {
  return u?.team?.number ?? null;
}
