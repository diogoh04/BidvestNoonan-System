-- Rode este script UMA VEZ no SQL editor do Neon.
-- Adiciona o status "sick" às opções permitidas em worker.status
-- (P45 / LE / Blocked / Sick), ao lado dos que já existem. Diferente de
-- Blocked, Sick não tem data associada — é só mais uma categoria em Outros.

BEGIN;

ALTER TABLE "worker" DROP CONSTRAINT "worker_status_check";
ALTER TABLE "worker"
  ADD CONSTRAINT "worker_status_check" CHECK ("status" IN ('p45', 'le', 'blocked', 'sick'));

COMMIT;
