import { z } from "zod";
import { TIMESHEET_DAYS } from "./types";

export const staffInputSchema = z
  .object({
    nome: z.string().trim().min(1, "Name is required"),
    // Opcional: em alguns casos o staff number ainda não saiu quando a
    // pessoa é contratada, e é preenchido depois (editando o cadastro).
    staffNumber: z.string().trim().optional().nullable(),
    telefone: z.string().trim().optional().nullable(),
    // Um vínculo por prédio+papel: horas são independentes por vínculo,
    // permitindo que o mesmo staff seja team leader em um prédio e cleaner
    // em outro — e também team leader E cleaner no mesmo prédio ao mesmo
    // tempo (dois vínculos, um por papel).
    assignments: z
      .array(
        z.object({
          buildingId: z.string(),
          role: z.enum(["cleaner", "team_leader"]),
          horas: z.number().nullable().optional(),
        })
      )
      .default([]),
    // Status especial (ver seção "Outros") — staff com status preenchido
    // não tem vínculo real de prédio (assignments é sempre limpo no servidor).
    status: z.enum(["p45", "le", "blocked", "sick"]).nullable().optional(),
    blockedAt: z.string().trim().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    const seen = new Set<string>();
    for (const [i, a] of data.assignments.entries()) {
      const key = `${a.buildingId}:${a.role}`;
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Duplicate assignment (same building and role) in the list",
          path: ["assignments", i, "buildingId"],
        });
      }
      seen.add(key);
    }
  });

export type StaffInput = z.infer<typeof staffInputSchema>;

export const feedbackInputSchema = z.object({
  texto: z.string().trim().min(1, "Note cannot be empty"),
});

export const buildingInputSchema = z.object({
  nome: z.string().trim().min(1, "Building name is required"),
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
  staffId: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

// Autocadastro em /register — sempre cria com role "pending" (o Master
// define o papel real depois em /users), então não recebe role/staffId.
export const registerInputSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
});

function checkStaffLink(data: { role?: string; staffId?: string | null }, ctx: z.RefinementCtx) {
  if (data.role === "team_leader" && !data.staffId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Select the staff (team leader) linked to this account",
      path: ["staffId"],
    });
  }
  if (data.role && data.role !== "team_leader" && data.staffId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Staff link only applies to team leader accounts",
      path: ["staffId"],
    });
  }
}

export const userInputSchema = userBaseSchema.superRefine(checkStaffLink);

// Edição: todos os campos opcionais (envia só o que muda), mas ainda
// valida a consistência papel/staffId quando role é enviado.
export const userUpdateSchema = userBaseSchema.partial().superRefine(checkStaffLink);

export type UserInput = z.infer<typeof userInputSchema>;

const timesheetDayValueSchema = z.object({
  in: z.string().trim().max(5).nullable(),
  out: z.string().trim().max(5).nullable(),
});

const timesheetDaysSchema = z.object(
  Object.fromEntries(TIMESHEET_DAYS.map((d) => [d, timesheetDayValueSchema])) as Record<
    (typeof TIMESHEET_DAYS)[number],
    typeof timesheetDayValueSchema
  >
);

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

export const timesheetCreateSchema = z.object({
  buildingId: z.string(),
  weekStart: z.string(), // "YYYY-MM-DD", deve ser uma segunda-feira
  // Se enviado e a folha ainda não existir, clona as linhas dessa semana
  // anterior (zerando os horários) em vez de fotografar o estado atual.
  copyFromWeekStart: z.string().optional(),
});

export const timesheetPatchSchema = z.object({
  entries: timesheetEntriesSchema.optional(),
  status: z.enum(["draft", "submitted", "done"]).optional(),
  // Só Master/Supervisor, só numa folha já excluída — ver PATCH em
  // /api/timesheets/[id].
  restore: z.literal(true).optional(),
});
