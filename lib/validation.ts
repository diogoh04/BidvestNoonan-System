import { z } from "zod";

export const staffInputSchema = z
  .object({
    nome: z.string().trim().min(1, "Nome é obrigatório"),
    staffNumber: z.string().trim().min(1, "Staff number é obrigatório"),
    telefone: z.string().trim().optional().nullable(),
    role: z.enum(["cleaner", "team_leader"]),
    // cleaner: 0 ou 1 prédio (opcional). team_leader: 1+ prédios (obrigatório).
    buildingId: z.string().optional().nullable(), // usado quando role = cleaner
    buildingIds: z.array(z.string()).optional(), // usado quando role = team_leader
  })
  .superRefine((data, ctx) => {
    if (data.role === "team_leader") {
      if (!data.buildingIds || data.buildingIds.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Team leader precisa de pelo menos um prédio",
          path: ["buildingIds"],
        });
      }
    }
  });

export type StaffInput = z.infer<typeof staffInputSchema>;

export const feedbackInputSchema = z.object({
  texto: z.string().trim().min(1, "Observação não pode ser vazia"),
});

export const buildingInputSchema = z.object({
  nome: z.string().trim().min(1, "Nome do prédio é obrigatório"),
});
