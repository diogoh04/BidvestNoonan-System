import { z } from "zod";

export const staffInputSchema = z
  .object({
    nome: z.string().trim().min(1, "Name is required"),
    // Opcional: em alguns casos o staff number ainda não saiu quando a
    // pessoa é contratada, e é preenchido depois (editando o cadastro).
    staffNumber: z.string().trim().optional().nullable(),
    telefone: z.string().trim().optional().nullable(),
    // Horas são independentes por vínculo. O mesmo staff pode ter mais de um
    // vínculo "cleaner" no mesmo prédio (dois turnos/postos) — ver StaffForm
    // e schema.prisma. Na prática o formulário só manda role "cleaner" aqui;
    // team leader vai por teamsLed abaixo (não é mais vínculo de prédio).
    assignments: z
      .array(
        z.object({
          buildingId: z.string(),
          role: z.enum(["cleaner", "team_leader"]),
          horas: z.number().nullable().optional(),
        })
      )
      .default([]),
    // Times que este staff passa a liderar (ver model TeamLeader) — um time
    // pode ter mais de um líder, então isso só ADICIONA/atualiza este staff
    // como líder de cada item (ver PUT /api/staff/[id] e
    // lib/teams.ts:connectTeamLeader). Times que o staff liderava e saíram
    // dessa lista são desconectados ao salvar (não afeta outros líderes).
    teamsLed: z
      .array(
        z.object({
          teamId: z.string(),
          horas: z.number().nullable().optional(),
        })
      )
      .default([]),
    // Status especial (ver seção "Outros") — staff com status preenchido
    // não tem vínculo real de prédio (assignments é sempre limpo no servidor).
    status: z.enum(["p45", "le", "blocked", "sick"]).nullable().optional(),
    blockedAt: z.string().trim().nullable().optional(),
    // lastWorkingDay é obrigatório tanto pra "p45" quanto pra "le" (ver
    // superRefine abaixo). voluntaryLeave/leaveReasons/leaveReasonNote são
    // só do "p45": voluntaryLeave sempre exigido nesse caso; leaveReasons
    // (pode ser mais de um) só quando voluntaryLeave === false;
    // leaveReasonNote é sempre aceito nesse caso, mas só obrigatório
    // quando "other" está entre os motivos.
    lastWorkingDay: z.string().trim().nullable().optional(),
    voluntaryLeave: z.boolean().nullable().optional(),
    leaveReasons: z
      .array(z.enum(["absences", "transport", "productivity", "visa_blocked", "other"]))
      .default([]),
    leaveReasonNote: z.string().trim().max(500).nullable().optional(),
    // Só do "le" — pra qual empresa o staff está indo. Sempre opcional.
    leDestinationCompany: z.string().trim().max(255).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    // O mesmo staff PODE ter mais de um vínculo "cleaner" no mesmo prédio
    // (dois turnos/postos, cada um com suas horas — ver StaffForm). Só o
    // vínculo "team_leader" continua sendo no máximo um por prédio.
    const seenTeamLeader = new Set<string>();
    for (const [i, a] of data.assignments.entries()) {
      if (a.role !== "team_leader") continue;
      if (seenTeamLeader.has(a.buildingId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Duplicate team leader assignment for the same building",
          path: ["assignments", i, "buildingId"],
        });
      }
      seenTeamLeader.add(a.buildingId);
    }

    const seenTeams = new Set<string>();
    for (const [i, t] of data.teamsLed.entries()) {
      if (seenTeams.has(t.teamId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Duplicate team in the list",
          path: ["teamsLed", i, "teamId"],
        });
      }
      seenTeams.add(t.teamId);
    }

    if (data.status === "p45" || data.status === "le") {
      if (!data.lastWorkingDay) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Last working day is required",
          path: ["lastWorkingDay"],
        });
      }
    }

    if (data.status === "p45") {
      if (data.voluntaryLeave === null || data.voluntaryLeave === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please indicate if the departure was voluntary",
          path: ["voluntaryLeave"],
        });
      } else if (data.voluntaryLeave === false) {
        if (data.leaveReasons.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Select at least one reason",
            path: ["leaveReasons"],
          });
        } else if (data.leaveReasons.includes("other") && !data.leaveReasonNote?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Please specify the reason",
            path: ["leaveReasonNote"],
          });
        }
      }
    }
  });

export type StaffInput = z.infer<typeof staffInputSchema>;

export const feedbackInputSchema = z.object({
  texto: z.string().trim().min(1, "Note cannot be empty"),
});

export const buildingInputSchema = z.object({
  nome: z.string().trim().min(1, "Building name is required"),
});

// "YYYY-MM-DD" — vem de <input type="date">.
const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");

// POST /api/teams/[id]/covers — registra um staff cobrindo a função de team
// leader temporariamente (ver StaffHistory.kind="team_leader_cover" no
// schema.prisma). endedAt opcional: em branco = cobertura em andamento.
export const teamLeaderCoverCreateSchema = z
  .object({
    staffId: z.string().min(1, "Select the staff covering"),
    startedAt: dateOnlySchema,
    endedAt: dateOnlySchema.nullable().optional(),
    note: z.string().trim().max(500).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.endedAt && data.endedAt < data.startedAt) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "End date can't be before the start date", path: ["endedAt"] });
    }
  });

export const teamLeaderCoverCloseSchema = z.object({
  endedAt: dateOnlySchema.optional(),
});

// Reaproveitado pelo cadastro de conta em /register (registerInputSchema)
// além do formulário de usuário do Master (userBaseSchema).
export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username needs at least 3 characters")
  .regex(/^[a-z0-9._ -]+$/i, "Use only letters, numbers, space, dot, hyphen or underscore");

export const passwordSchema = z.string().min(6, "Password needs at least 6 characters");

// Schema base (ZodObject puro) usado tanto na criação (com superRefine
// abaixo) quanto na edição (via .partial(), que não existe em cima de um
// ZodEffects/superRefine — por isso fica separado).
export const userBaseSchema = z.object({
  username: usernameSchema,
  // Obrigatória na criação; opcional na edição (deixar em branco = não trocar senha)
  password: passwordSchema.optional(),
  role: z.enum(["master", "supervisor", "team_leader"]),
  // Conta "team_leader" liga a um Time (não mais a um Staff).
  teamId: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

// Autocadastro em /register — sempre cria com role "pending" (o Master
// define o papel real depois em /users), então não recebe role/staffId.
export const registerInputSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
});

function checkTeamLink(data: { role?: string; teamId?: string | null }, ctx: z.RefinementCtx) {
  if (data.role === "team_leader" && !data.teamId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Select the team this account leads",
      path: ["teamId"],
    });
  }
  if (data.role && data.role !== "team_leader" && data.teamId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Team link only applies to team leader accounts",
      path: ["teamId"],
    });
  }
}

export const userInputSchema = userBaseSchema.superRefine(checkTeamLink);

// Edição: todos os campos opcionais (envia só o que muda), mas ainda
// valida a consistência papel/teamId quando role é enviado.
export const userUpdateSchema = userBaseSchema.partial().superRefine(checkTeamLink);

export type UserInput = z.infer<typeof userInputSchema>;

const timesheetDayValueSchema = z.object({
  in: z.string().trim().max(5).nullable(),
  out: z.string().trim().max(5).nullable(),
});

// z.record em vez do objeto fixo de 5 chaves (TIMESHEET_DAYS) — a folha
// quinzenal usa outro conjunto de 10 chaves (ver getTimesheetDayKeys em
// lib/types.ts), então isso precisa aceitar qualquer chave de dia.
const timesheetDaysSchema = z.record(timesheetDayValueSchema);

export const timesheetRowSchema = z.object({
  kind: z.enum(["staff", "openSlot", "cover"]),
  refId: z.string().nullable(),
  nome: z.string().nullable(),
  staffNumber: z.string().nullable(),
  horas: z.number().nullable(),
  days: timesheetDaysSchema,
});

export const timesheetEntriesSchema = z.object({
  rows: z.array(timesheetRowSchema),
});

export const timesheetCreateSchema = z
  .object({
    buildingId: z.string(),
    weekStart: z.string(), // "YYYY-MM-DD", deve ser uma segunda-feira
    // Fim real do período — opcional; quando enviado, a folha passa a ter
    // duração livre (ver /my/timesheets/lancar, que deixa o Team Leader
    // escolher início E fim) em vez da duração fixa de sempre por periodType.
    weekEnd: z.string().optional(),
    // "weekly" (padrão) ou "biweekly" — só é usado na criação; ignorado se a
    // folha já existir pra esse prédio+semana (fica imutável, igual weekStart).
    periodType: z.enum(["weekly", "biweekly"]).optional(),
    // Se enviado e a folha ainda não existir, clona as linhas dessa semana
    // anterior (zerando os horários) em vez de fotografar o estado atual.
    copyFromWeekStart: z.string().optional(),
  })
  .refine((v) => !v.weekEnd || v.weekEnd >= v.weekStart, {
    message: "weekEnd must not be before weekStart",
    path: ["weekEnd"],
  })
  .refine(
    (v) => {
      if (!v.weekEnd) return true;
      const start = new Date(v.weekStart + "T00:00:00Z").getTime();
      const end = new Date(v.weekEnd + "T00:00:00Z").getTime();
      // Teto de segurança pra não deixar a folha crescer sem limite (largura
      // da tabela impressa/tela cresce uma coluna por dia útil) — 31 dias
      // corridos cobre folgadamente uma quinzena+ "torta" (início/fim fora
      // de segunda/sexta).
      return (end - start) / 86400000 <= 31;
    },
    { message: "Period cannot be longer than 31 days", path: ["weekEnd"] }
  );

export const timesheetPatchSchema = z.object({
  entries: timesheetEntriesSchema.optional(),
  status: z.enum(["draft", "submitted", "done"]).optional(),
  // Só Master/Supervisor, só numa folha já excluída — ver PATCH em
  // /api/timesheets/[id].
  restore: z.literal(true).optional(),
});

// ---------- Relatório de ajuste semanal ----------

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const adjustmentItemSchema = z.object({
  action: z.enum(["add_hours", "remove_hours", "remove_from_building", "add_to_building"]),
  buildingId: z.string(),
  staffId: z.string().nullable().optional(),
  staffNome: z.string().trim().max(255).nullable().optional(),
  staffNumber: z.string().trim().max(50).nullable().optional(),
  dateFrom: z.string(), // "YYYY-MM-DD"
  dateTo: z.string(),
  timeFrom: z.string().regex(HHMM).nullable().optional(),
  timeTo: z.string().regex(HHMM).nullable().optional(),
  reasonCode: z.enum(["S", "BH", "AA", "AU", "P45", "HU", "HP"]).nullable().optional(),
  isCover: z.boolean().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

export const adjustmentReportCreateSchema = z.object({
  weekStart: z.string(), // segunda-feira "YYYY-MM-DD"
});

// TL edita os itens enquanto draft e transiciona pra submitted;
// Master/Supervisor transiciona pra done. Nunca os dois no mesmo PATCH.
export const adjustmentReportPatchSchema = z.object({
  items: z.array(adjustmentItemSchema).optional(),
  status: z.enum(["submitted", "done"]).optional(),
});
