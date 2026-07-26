import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { feedbackInputSchema } from "@/lib/validation";
import { toJSONSafe } from "@/lib/types";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const observations = await prisma.feedback.findMany({
    where: { workerId: BigInt(params.id) },
    orderBy: { data: "desc" },
  });

  return NextResponse.json(
    toJSONSafe(
      observations.map((f) => ({
        id: f.id.toString(),
        texto: f.texto,
        data: f.data ? f.data.toISOString() : null,
      }))
    )
  );
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const parsed = feedbackInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const created = await prisma.feedback.create({
    data: {
      texto: parsed.data.texto,
      workerId: BigInt(params.id),
    },
  });

  return NextResponse.json(
    toJSONSafe({ id: created.id.toString(), texto: created.texto, data: created.data?.toISOString() ?? null }),
    { status: 201 }
  );
}
