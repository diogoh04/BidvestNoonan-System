-- Rode este script UMA VEZ no SQL editor do Neon.
-- Feature: /teams — o time (Team) vira a unidade estável: tem número e
-- prédios alocados a ele, independente de quem é o team leader no momento.
-- O team leader passa a ser uma "conexão" (team.leader_id) que pode ser
-- trocada sem mexer nos prédios do time.
--
-- IMPORTANTE: staff_building.role='team_leader' NÃO é apagado nem substituído
-- aqui — esse vínculo continua sendo a fonte de verdade do portal de
-- autoatendimento do Team Leader (login "team_leader": /my, /my/timesheets,
-- fortnight plans, review...), que não tem nada a ver com esta feature. Dali
-- pra frente, toda mudança feita através do Team (conectar/trocar líder,
-- mover prédio de time) mantém esse vínculo sincronizado automaticamente
-- (ver lib/teams.ts: syncBuildingTeamChange / syncTeamLeaderChange) — o
-- backfill abaixo só faz a foto inicial pra igualar os dois.
--
-- Esse script:
--   1) cria a tabela "team";
--   2) adiciona predios.team_id;
--   3) faz o backfill: um Team por team leader que já existe hoje (levando
--      junto as horas atuais em worker.horas_semana como leader_hours) e
--      liga os prédios que esse team leader já liderava ao Team criado.
--
-- Se um prédio tinha mais de um team leader (caso raro hoje), só o primeiro
-- team leader iterado vira o "dono" desse prédio no Team novo — o restante
-- continua com o vínculo antigo intacto (ainda aparece no vínculo legado,
-- só não no Team novo), consistente com o novo modelo (1 prédio = 1 time).

BEGIN;

CREATE TABLE "team" (
  "id" BIGSERIAL PRIMARY KEY,
  "number" INTEGER,
  "leader_id" BIGINT REFERENCES "worker"("id") ON DELETE SET NULL,
  "leader_hours" DOUBLE PRECISION,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT now()
);

ALTER TABLE "predios" ADD COLUMN "team_id" BIGINT REFERENCES "team"("id") ON DELETE SET NULL;

DO $$
DECLARE
  r RECORD;
  new_team_id BIGINT;
BEGIN
  FOR r IN
    SELECT DISTINCT sb.staff_id, w.horas_semana
    FROM staff_building sb
    JOIN worker w ON w.id = sb.staff_id
    WHERE sb.role = 'team_leader'
  LOOP
    INSERT INTO "team" ("leader_id", "leader_hours")
    VALUES (r.staff_id, r.horas_semana)
    RETURNING id INTO new_team_id;

    UPDATE "predios" p
    SET "team_id" = new_team_id
    WHERE p."team_id" IS NULL
      AND p."id" IN (
        SELECT building_id FROM staff_building
        WHERE staff_id = r.staff_id AND role = 'team_leader'
      );
  END LOOP;
END $$;

COMMIT;
