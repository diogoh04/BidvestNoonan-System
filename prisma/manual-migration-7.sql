-- Rode este script UMA VEZ no SQL editor do Neon.
-- Cria as tabelas de login por usuário (app_user) e folha de ponto digital
-- (timesheet). Puramente aditivo — nenhuma tabela existente é alterada e
-- nada no app lê essas tabelas ainda, então é seguro rodar a qualquer
-- momento antes da troca do login (ver plano de rollout).

BEGIN;

CREATE TABLE "app_user" (
  "id" BIGSERIAL PRIMARY KEY,
  "username" VARCHAR(100) NOT NULL,
  "password_hash" VARCHAR(255) NOT NULL,
  "role" VARCHAR(20) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "staff_id" BIGINT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "app_user_username_key" UNIQUE ("username"),
  CONSTRAINT "app_user_staff_id_key" UNIQUE ("staff_id"),
  CONSTRAINT "app_user_role_check" CHECK ("role" IN ('master', 'supervisor', 'team_leader')),
  CONSTRAINT "app_user_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "worker"("id") ON DELETE SET NULL
);

CREATE TABLE "timesheet" (
  "id" BIGSERIAL PRIMARY KEY,
  "building_id" BIGINT NOT NULL,
  "week_start" DATE NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
  "entries" JSONB NOT NULL DEFAULT '{"rows":[]}'::jsonb,

  "created_by_user_id" BIGINT,
  "submitted_by_user_id" BIGINT,
  "submitted_at" TIMESTAMPTZ,
  "reviewed_by_user_id" BIGINT,
  "reviewed_at" TIMESTAMPTZ,

  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "timesheet_building_id_week_start_key" UNIQUE ("building_id", "week_start"),
  CONSTRAINT "timesheet_status_check" CHECK ("status" IN ('draft', 'submitted', 'done')),
  CONSTRAINT "timesheet_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "predios"("id") ON DELETE CASCADE,
  CONSTRAINT "timesheet_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "app_user"("id") ON DELETE SET NULL,
  CONSTRAINT "timesheet_submitted_by_user_id_fkey" FOREIGN KEY ("submitted_by_user_id") REFERENCES "app_user"("id") ON DELETE SET NULL,
  CONSTRAINT "timesheet_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "app_user"("id") ON DELETE SET NULL
);

CREATE INDEX "timesheet_status_idx" ON "timesheet" ("status");
CREATE INDEX "timesheet_building_id_idx" ON "timesheet" ("building_id");

COMMIT;
