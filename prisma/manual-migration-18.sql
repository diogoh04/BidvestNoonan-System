-- Rode este script UMA VEZ no SQL editor do Neon (depois do 15 e 16).
-- Feature: um time pode ter mais de um team leader (co-liderança) — antes
-- Team.leader_id só guardava um. Cria a tabela "team_leader" (N:N entre
-- team e worker), migra o líder único que já existia pra lá, e remove as
-- colunas antigas.

BEGIN;

CREATE TABLE "team_leader" (
  "team_id" BIGINT NOT NULL REFERENCES "team"("id") ON DELETE CASCADE,
  "staff_id" BIGINT NOT NULL REFERENCES "worker"("id") ON DELETE CASCADE,
  "horas" DOUBLE PRECISION,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("team_id", "staff_id")
);

INSERT INTO "team_leader" ("team_id", "staff_id", "horas")
SELECT "id", "leader_id", "leader_hours"
FROM "team"
WHERE "leader_id" IS NOT NULL;

ALTER TABLE "team" DROP COLUMN "leader_id";
ALTER TABLE "team" DROP COLUMN "leader_hours";

COMMIT;
