import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { disconnectTeamLeader } from "@/lib/teams";

// Desconecta um team leader deste time (o time e os outros líderes, se
// houver, continuam existindo).
export async function DELETE(_req: NextRequest, { params }: { params: { id: string; staffId: string } }) {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  await disconnectTeamLeader(BigInt(params.id), BigInt(params.staffId));

  return NextResponse.json({ ok: true });
}
