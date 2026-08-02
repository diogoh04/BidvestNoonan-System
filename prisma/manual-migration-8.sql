-- Rode este script UMA VEZ no SQL editor do Neon.
-- Permite role='pending' em app_user — conta criada pela própria pessoa em
-- /register, ainda sem papel definido, até o Master aprovar em /users e
-- escolher o papel real (master/supervisor/team_leader).

BEGIN;

ALTER TABLE "app_user" DROP CONSTRAINT "app_user_role_check";
ALTER TABLE "app_user"
  ADD CONSTRAINT "app_user_role_check" CHECK ("role" IN ('master', 'supervisor', 'team_leader', 'pending'));

COMMIT;
