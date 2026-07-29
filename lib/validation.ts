import { z } from "zod";

export const staffInputSchema = z
  .object({
    nome: z.string().trim().min(1, "Nome é obrigatório"),
    staffNumber: z.string().trim().min(1, "Staff number é obrigatório"),
    telefone: z.string().trim().optional().nullable(),
    // Um vínculo por prédio: papel (cleaner/team_leader) e horas são
    // independentes por prédio, permitindo que o mesmo staff seja team
    // leader em um prédio e cleaner em outro.
    assignments: z
      .array(
        z.object({
          buildingId: z.string(),
          role: z.enum(["cleaner", "team_leader"]),
          horas: z.number().nullable().optional(),
        })
      )
      .default([]),
  })
  .superRefine((data, ctx) => {
    const seen = new Set<string>();
    for (const [i, a] of data.assignments.entries()) {
      if (seen.has(a.buildingId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Prédio duplicado na lista de vínculos",
          path: ["assignments", i, "buildingId"],
        });
      }
      seen.add(a.buildingId);
    }
  });

export type StaffInput = z.infer<typeof staffInputSchema>;

export const feedbackInputSchema = z.object({
  texto: z.string().trim().min(1, "Observação não pode ser vazia"),
});

export const buildingInputSchema = z.object({
  nome: z.string().trim().min(1, "Nome do prédio é obrigatório"),
});
