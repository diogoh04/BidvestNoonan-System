-- Rode este script UMA VEZ no SQL editor do Neon.
-- Move o "papel" (cleaner/team_leader) de uma coluna única em worker.role
-- para um papel por vínculo em staff_building, permitindo que o mesmo staff
-- seja team_leader em um prédio e cleaner em outro.
-- Não apaga nada: worker.role continua existindo (só deixa de ser usado
-- pela aplicação para decidir cleaner/team_leader).

BEGIN;

-- 1) Papel por vínculo staff+prédio (mesmo domínio de worker.role)
ALTER TABLE "staff_building"
  ADD COLUMN IF NOT EXISTS "role" varchar(20) NOT NULL DEFAULT 'cleaner';

ALTER TABLE "staff_building"
  ADD CONSTRAINT "staff_building_role_check" CHECK ("role" IN ('cleaner', 'team_leader'));

-- 2) Backfill: cada vínculo existente herda o role atual do staff,
-- preservando o comportamento de hoje até que alguém edite o cadastro.
UPDATE "staff_building" sb
SET "role" = w."role"
FROM "worker" w
WHERE w."id" = sb."staff_id";

COMMIT;
