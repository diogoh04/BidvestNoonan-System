-- Rode este script UMA VEZ no SQL editor do Neon.
-- Adiciona os campos de detalhe da saída (P45): último dia trabalhado,
-- se a saída foi por escolha própria (voluntária) e, quando não foi
-- voluntária, o motivo (lista fixa) + observação livre obrigatória só
-- quando o motivo é "other". Campos opcionais no banco — obrigatoriedade
-- condicional é validada na aplicação (lib/validation.ts).
-- Puramente aditivo: staff já existente fica com todos os campos NULL.

BEGIN;

ALTER TABLE "worker" ADD COLUMN "last_working_day" DATE;
ALTER TABLE "worker" ADD COLUMN "voluntary_leave" BOOLEAN;
ALTER TABLE "worker" ADD COLUMN "leave_reason" VARCHAR(30);
ALTER TABLE "worker" ADD COLUMN "leave_reason_note" VARCHAR(500);

ALTER TABLE "worker"
  ADD CONSTRAINT "worker_leave_reason_check"
  CHECK ("leave_reason" IS NULL OR "leave_reason" IN
    ('absences', 'transport', 'productivity', 'visa_blocked', 'other'));

COMMIT;
