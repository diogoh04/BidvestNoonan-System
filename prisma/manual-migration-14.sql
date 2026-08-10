-- Rode este script UMA VEZ no SQL editor do Neon.
-- P45: motivo de saída passa a aceitar mais de um (leave_reason -> array
-- leave_reasons). Migra o único registro existente antes de descartar a
-- coluna antiga.

BEGIN;

ALTER TABLE "worker" ADD COLUMN "leave_reasons" TEXT[] NOT NULL DEFAULT '{}';

UPDATE "worker" SET "leave_reasons" = ARRAY["leave_reason"]::text[] WHERE "leave_reason" IS NOT NULL;

ALTER TABLE "worker" DROP CONSTRAINT IF EXISTS "worker_leave_reason_check";
ALTER TABLE "worker" DROP COLUMN "leave_reason";

ALTER TABLE "worker"
  ADD CONSTRAINT "worker_leave_reasons_check"
  CHECK ("leave_reasons" <@ ARRAY['absences', 'transport', 'productivity', 'visa_blocked', 'other']::text[]);

COMMIT;
