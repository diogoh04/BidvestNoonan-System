import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { fortnightLaunchSchema } from "@/lib/validation";
import { splitFortnightEntries } from "@/lib/timesheetSnapshot";
import { toJSONSafe, type FortnightPlanDTO, type TimesheetEntries } from "@/lib/types";
import { mapTimesheet, timesheetInclude } from "@/lib/timesheetDto";

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

// POST /api/timesheets/fortnight/launch { fortnightStart } — "lança" a
// quinzenal (biweekly, em draft) do Team Leader nessa data: por prédio, a
// própria linha vira a folha da semana 1 (periodType -> weekly, entries
// truncado pros 5 dias da semana 1) e uma linha nova é criada pra semana 2
// (weekStart+7), preservando o conteúdo original das 10 colunas num
// FortnightPlan (histórico consultável na aba "Fortnightly sheets"). Daí em
// diante as duas semanas seguem o fluxo normal de submit/review — nascem
// "draft", o TL ainda usa "Send all pending" pra enviar (Launch e Submit são
// passos separados de propósito).
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!hasRole(user, "team_leader") || !user!.staffId) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = fortnightLaunchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const fortnightStart = new Date(parsed.data.fortnightStart + "T00:00:00Z");
  const week2Start = addDays(fortnightStart, 7);

  const myLinks = await prisma.staffBuilding.findMany({
    where: { staffId: BigInt(user!.staffId), role: "team_leader" },
    select: { buildingId: true },
  });
  const myBuildingIds = myLinks.map((l) => l.buildingId);

  const drafts = await prisma.timesheet.findMany({
    where: {
      buildingId: { in: myBuildingIds },
      weekStart: fortnightStart,
      periodType: "biweekly",
      status: "draft",
      deletedAt: null,
    },
  });

  if (drafts.length === 0) {
    return NextResponse.json(
      { error: "No fortnight draft found for this date." },
      { status: 404 }
    );
  }

  // Nenhuma linha ativa pode já ocupar a vaga da semana 2 — evita sobrescrever
  // silenciosamente algo que já existia ali por outro caminho.
  const week2Existing = await prisma.timesheet.findMany({
    where: { buildingId: { in: drafts.map((d) => d.buildingId) }, weekStart: week2Start, deletedAt: null },
    include: { building: true },
  });
  if (week2Existing.length > 0) {
    return NextResponse.json(
      {
        error: `A timesheet already exists for the week of ${week2Existing[0].weekStart.toISOString().slice(0, 10)} at ${week2Existing
          .map((t) => t.building.nome)
          .join(", ")}; resolve it before launching.`,
      },
      { status: 409 }
    );
  }

  const plans = await prisma.$transaction(
    async (tx) => {
      const created: FortnightPlanDTO[] = [];

      for (const draft of drafts) {
        const forecastEntries = draft.entries as unknown as TimesheetEntries;
        const { week1, week2 } = splitFortnightEntries(forecastEntries);

        const week1Timesheet = await tx.timesheet.update({
          where: { id: draft.id },
          data: { periodType: "weekly", entries: week1 as any },
          include: timesheetInclude,
        });

        const week2Timesheet = await tx.timesheet.create({
          data: {
            buildingId: draft.buildingId,
            weekStart: week2Start,
            periodType: "weekly",
            entries: week2 as any,
            status: "draft",
            createdByUserId: BigInt(user!.userId),
          },
          include: timesheetInclude,
        });

        const plan = await tx.fortnightPlan.create({
          data: {
            buildingId: draft.buildingId,
            fortnightStart,
            forecastEntries: forecastEntries as any,
            week1TimesheetId: week1Timesheet.id,
            week2TimesheetId: week2Timesheet.id,
            launchedByUserId: BigInt(user!.userId),
          },
          include: { building: true, launchedByUser: { include: { staff: true } } },
        });

        // week1Timesheet/week2Timesheet foram buscados ANTES do FortnightPlan
        // existir, então mapTimesheet() ainda não veria o link — completa à
        // mão aqui, já que o id do plano é conhecido neste ponto.
        const week1DTO = { ...mapTimesheet(week1Timesheet), fortnightPlanId: plan.id.toString() };
        const week2DTO = { ...mapTimesheet(week2Timesheet), fortnightPlanId: plan.id.toString() };

        created.push({
          id: plan.id.toString(),
          buildingId: plan.buildingId.toString(),
          buildingNome: plan.building.nome,
          fortnightStart: plan.fortnightStart.toISOString().slice(0, 10),
          forecastEntries,
          week1: week1DTO,
          week2: week2DTO,
          launchedByNome: plan.launchedByUser?.staff?.nome ?? plan.launchedByUser?.username ?? null,
          launchedAt: plan.launchedAt.toISOString(),
        });
      }

      return created;
    },
    // Timeout generoso (padrão do Prisma é 5s) — cada prédio faz 3
    // round-trips sequenciais (update semana 1 + create semana 2 + create
    // do plano) dentro da mesma transação; com latência de rede até o
    // Neon, uma quinzenal com vários prédios facilmente estoura o padrão.
    { timeout: 30_000, maxWait: 10_000 }
  );

  return NextResponse.json(toJSONSafe({ fortnightStart: parsed.data.fortnightStart, plans }));
}
