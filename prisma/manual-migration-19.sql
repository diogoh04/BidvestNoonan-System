-- Rode este script UMA VEZ no SQL editor do Neon (depois do 18).
-- Feature: histórico/trilha por staff — em que prédio foi cleaner e quando,
-- que time liderou e quando, e "covers" de team leader (cobrir a função sem
-- estar conectado como líder de verdade). Uma linha por INTERVALO: aberta
-- (ended_at NULL) enquanto vale, fechada quando termina.
--
-- Aditivo: não altera nenhuma tabela existente. Nomes de prédio/time são
-- desnormalizados (snapshot) de propósito, pro histórico sobreviver a
-- rename/exclusão — mesmo padrão de worker.last_building_name.

BEGIN;

CREATE TABLE "staff_history" (
  "id"            BIGSERIAL PRIMARY KEY,
  "staff_id"      BIGINT NOT NULL REFERENCES "worker"("id")   ON DELETE CASCADE,
  "kind"          VARCHAR(30) NOT NULL,
  "building_id"   BIGINT REFERENCES "predios"("id") ON DELETE SET NULL,
  "building_name" VARCHAR(255),
  "team_id"       BIGINT REFERENCES "team"("id")    ON DELETE SET NULL,
  "team_number"   INTEGER,
  "horas"         DOUBLE PRECISION,
  "started_at"    TIMESTAMP(3) NOT NULL DEFAULT now(),
  "ended_at"      TIMESTAMP(3),
  "note"          VARCHAR(500),
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT now(),
  CONSTRAINT "staff_history_kind_check"
    CHECK ("kind" IN ('building', 'team_leader', 'team_leader_cover')),
  CONSTRAINT "staff_history_interval_check"
    CHECK ("ended_at" IS NULL OR "ended_at" >= "started_at")
);

CREATE INDEX "staff_history_staff_id_started_at_idx" ON "staff_history" ("staff_id", "started_at" DESC);
CREATE INDEX "staff_history_kind_ended_at_idx"       ON "staff_history" ("kind", "ended_at");
CREATE INDEX "staff_history_building_id_idx"         ON "staff_history" ("building_id");
CREATE INDEX "staff_history_team_id_idx"             ON "staff_history" ("team_id");

-- No máximo UMA entrada aberta por staff+alvo em cada tipo. É o que impede
-- linha duplicada quando o formulário de staff é salvo várias vezes sem
-- mudar prédio/time (o código também checa antes; isto é a rede de
-- segurança) — e faz este script falhar em vez de duplicar se for rodado
-- duas vezes.
CREATE UNIQUE INDEX "staff_history_open_building_uniq"
  ON "staff_history" ("staff_id", "building_id")
  WHERE "kind" = 'building' AND "ended_at" IS NULL;
CREATE UNIQUE INDEX "staff_history_open_team_uniq"
  ON "staff_history" ("staff_id", "team_id")
  WHERE "kind" = 'team_leader' AND "ended_at" IS NULL;
CREATE UNIQUE INDEX "staff_history_open_cover_uniq"
  ON "staff_history" ("staff_id", "team_id")
  WHERE "kind" = 'team_leader_cover' AND "ended_at" IS NULL;

-- Backfill 1: vínculos de cleaner que existem HOJE viram entradas abertas.
-- CUIDADO: staff_building.created_at é aproximado — o PUT de staff apaga e
-- recria os vínculos a cada edição do cadastro, então pra muita gente essa
-- data é a da ÚLTIMA EDIÇÃO do cadastro, não a da entrada real no prédio.
-- Daqui pra frente (após rodar este script) as datas passam a ser exatas.
INSERT INTO "staff_history"
  ("staff_id", "kind", "building_id", "building_name", "horas", "started_at")
SELECT sb."staff_id", 'building', sb."building_id", p."nome", sb."horas",
       COALESCE(sb."created_at", now())
FROM "staff_building" sb
JOIN "predios" p ON p."id" = sb."building_id"
WHERE sb."role" = 'cleaner';

-- Backfill 2: lideranças de time que existem HOJE.
INSERT INTO "staff_history"
  ("staff_id", "kind", "team_id", "team_number", "horas", "started_at")
SELECT tl."staff_id", 'team_leader', tl."team_id", t."number", tl."horas",
       COALESCE(tl."created_at", now())
FROM "team_leader" tl
JOIN "team" t ON t."id" = tl."team_id";

-- Sem backfill de "team_leader_cover" — conceito novo, sem histórico prévio.

COMMIT;
