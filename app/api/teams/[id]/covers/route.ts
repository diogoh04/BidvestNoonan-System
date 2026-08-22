import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toJSONSafe } from "@/lib/types";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { teamLeaderCoverCreateSchema } from "@/lib/validation";
import { openTeamLeaderCover } from "@/lib/staffHistory";

// Registra um staff cobrindo a função de team leader deste time, sem
// conectá-lo como líder de verdade (não mexe em acesso nem nos prédios do
// time) — ver StaffHistory.kind="team_leader_cover" no schema.prisma.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = teamLeaderCoverCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const teamId = BigInt(params.id);
  const staffId = BigInt(parsed.data.staffId);

  const [team, staff] = await Promise.all([
    prisma.team.findUnique({ where: { id: teamId } }),
    prisma.staff.findUnique({ where: { id: staffId } }),
  ]);
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });
  if (!staff) return NextResponse.json({ error: "Staff not found" }, { status: 404 });

  const result = await openTeamLeaderCover(staffId, teamId, {
    startedAt: new Date(`${parsed.data.startedAt}T00:00:00.000Z`),
    endedAt: parsed.data.endedAt ? new Date(`${parsed.data.endedAt}T00:00:00.000Z`) : null,
    note: parsed.data.note,
  });

  if ("error" in result) {
    return NextResponse.json({ error: "This staff already has an open cover for this team" }, { status: 409 });
  }

  return NextResponse.json(toJSONSafe({ id: result.id.toString() }), { status: 201 });
}
