-- Avisos de agendamento: confirmacao ao marcar e lembretes D-1, 1h e 15min.
--
-- Cada aviso enviado vira uma linha aqui, e a linha e gravada ANTES do envio.
-- O UNIQUE e a trava: se o job rodar em duas instancias ao mesmo tempo, ou o
-- servidor reiniciar no meio de um ciclo, so quem conseguiu inserir envia.
--
-- `scheduled_at` entra na chave de proposito: agendamento remarcado e outro
-- horario, e a regua recomeca para ele sem precisar apagar nada.
CREATE TABLE IF NOT EXISTS "appointment_notifications" (
  "id"             TEXT NOT NULL,
  "appointment_id" TEXT NOT NULL,
  "empresa_id"     TEXT NOT NULL,
  "stage"          TEXT NOT NULL,
  "scheduled_at"   TIMESTAMP(3) NOT NULL,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "appointment_notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "appointment_notifications_appt_stage_time_key"
  ON "appointment_notifications"("appointment_id", "stage", "scheduled_at");
CREATE INDEX IF NOT EXISTS "appointment_notifications_empresa_id_idx"
  ON "appointment_notifications"("empresa_id");

ALTER TABLE "appointment_notifications"
  DROP CONSTRAINT IF EXISTS "appointment_notifications_appointment_id_fkey";
ALTER TABLE "appointment_notifications"
  ADD CONSTRAINT "appointment_notifications_appointment_id_fkey"
  FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- O lembrete de 15 minutos procura agendamentos pelo horario em todas as
-- barbearias de uma vez; os indices existentes comecam por empresa_id.
CREATE INDEX IF NOT EXISTS "idx_appointments_scheduled_at" ON "appointments"("scheduled_at");

-- Push tambem para o cliente final, que entra pelo portal com conta propria
-- (customer_accounts), nao por profiles. A inscricao pertence a um OU a outro.
ALTER TABLE "push_subscriptions" ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "customer_account_id" TEXT;
CREATE INDEX IF NOT EXISTS "push_subscriptions_customer_account_id_idx"
  ON "push_subscriptions"("customer_account_id");

ALTER TABLE "push_subscriptions"
  DROP CONSTRAINT IF EXISTS "push_subscriptions_customer_account_id_fkey";
ALTER TABLE "push_subscriptions"
  ADD CONSTRAINT "push_subscriptions_customer_account_id_fkey"
  FOREIGN KEY ("customer_account_id") REFERENCES "customer_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "push_subscriptions"
  DROP CONSTRAINT IF EXISTS "push_subscriptions_owner_check";
ALTER TABLE "push_subscriptions"
  ADD CONSTRAINT "push_subscriptions_owner_check"
  CHECK (("user_id" IS NULL) <> ("customer_account_id" IS NULL));
