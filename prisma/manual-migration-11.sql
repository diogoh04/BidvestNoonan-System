-- Rode este script UMA VEZ no SQL editor do Neon.
-- Adiciona a opção de folha de ponto quinzenal ("biweekly"), ao lado da
-- semanal ("weekly") que já existe. Uma folha quinzenal continua ocupando
-- só o week_start da primeira semana (não cria uma segunda linha pra
-- semana 2) — o quadro de dias da segunda semana vive dentro do mesmo
-- registro, em entries.rows[].days. Puramente aditivo: toda folha já
-- existente vira "weekly" por padrão, comportamento idêntico ao de hoje.

BEGIN;

ALTER TABLE "timesheet"
  ADD COLUMN "period_type" VARCHAR(20) NOT NULL DEFAULT 'weekly';

ALTER TABLE "timesheet"
  ADD CONSTRAINT "timesheet_period_type_check" CHECK ("period_type" IN ('weekly', 'biweekly'));

COMMIT;
