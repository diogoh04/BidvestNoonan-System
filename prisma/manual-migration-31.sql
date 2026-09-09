-- Migration 31: relatório de ajuste semanal estruturado.
--
-- A folha quinzenal é uma PREVISÃO congelada. Os ajustes do meio da quinzena
-- (pessoa faltou, entrou cover, saiu da WO...) passam a ser registrados num
-- relatório estruturado por Team Leader + semana — mesmo conteúdo que hoje
-- vai por WhatsApp, agora rastreado (status, quem revisou). O "ajuste por
-- diff de célula" (tabela `adjustment`, migration 30) foi abandonado — a
-- tabela fica, sem uso.
--
-- Rodar no Neon (DIRECT_URL) depois da migration 30.

BEGIN;

CREATE TABLE "adjustment_report" (
  "id"                   BIGSERIAL PRIMARY KEY,
  "week_start"           DATE NOT NULL,
  "status"               VARCHAR(20) NOT NULL DEFAULT 'draft',
  "submitted_by_user_id" BIGINT REFERENCES "app_user"("id") ON DELETE SET NULL,
  "submitted_at"         TIMESTAMP(3),
  "reviewed_by_user_id"  BIGINT REFERENCES "app_user"("id") ON DELETE SET NULL,
  "reviewed_at"          TIMESTAMP(3),
  "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "adjustment_item" (
  "id"           BIGSERIAL PRIMARY KEY,
  "report_id"    BIGINT NOT NULL REFERENCES "adjustment_report"("id") ON DELETE CASCADE,
  "building_id"  BIGINT NOT NULL REFERENCES "predios"("id") ON DELETE CASCADE,
  "action"       VARCHAR(30) NOT NULL,  -- add_hours | remove_hours | remove_from_building | add_to_building
  "staff_id"     BIGINT REFERENCES "worker"("id") ON DELETE SET NULL,
  "staff_nome"   VARCHAR(255),
  "staff_number" VARCHAR(50),
  "date_from"    DATE NOT NULL,
  "date_to"      DATE NOT NULL,
  "time_from"    VARCHAR(5),
  "time_to"      VARCHAR(5),
  "reason_code"  VARCHAR(10),           -- S | BH | AA | AU | P45 | HU | HP
  "is_cover"     BOOLEAN NOT NULL DEFAULT false,
  "note"         VARCHAR(500),
  "ordem"        INTEGER NOT NULL DEFAULT 0,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "adjustment_item_report_id_idx" ON "adjustment_item" ("report_id");
CREATE INDEX "adjustment_report_week_start_idx" ON "adjustment_report" ("week_start");

COMMIT;
