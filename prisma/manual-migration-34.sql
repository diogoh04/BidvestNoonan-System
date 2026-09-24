-- Rode este script UMA VEZ no SQL editor do Neon (depois do 33).
-- Feature: nome do Team Leader digitado à mão na folha (Log timesheet do
-- Team Leader) em vez de puxado automaticamente de TeamLeader/Team.leaders.
-- Guardado junto do override "header" já existente (mesma linha do nome do
-- prédio) — ver TimesheetSheetOverride.teamLeaderNome no schema.prisma e
-- CombinedTimesheetEditor.tsx.
--
-- Aditivo: 1 coluna nullable, sem dado a migrar (comportamento antigo
-- continua igual pra quem já tem override salvo, só sem o nome ainda).

BEGIN;

ALTER TABLE "timesheet_sheet_override" ADD COLUMN "team_leader_nome" VARCHAR(255);

COMMIT;
