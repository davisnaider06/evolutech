CREATE TABLE IF NOT EXISTS "billing_reminders" (
  "id" TEXT NOT NULL,
  "empresa_id" TEXT NOT NULL,
  "billing_charge_id" TEXT NOT NULL,
  "step_code" TEXT NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'whatsapp',
  "scheduled_at" TIMESTAMP(3) NOT NULL,
  "sent_at" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'scheduled',
  "error_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "billing_reminders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "billing_reminders_empresa_id_billing_charge_id_step_code_key"
ON "billing_reminders"("empresa_id", "billing_charge_id", "step_code");

CREATE INDEX IF NOT EXISTS "billing_reminders_empresa_id_status_scheduled_at_idx"
ON "billing_reminders"("empresa_id", "status", "scheduled_at");

CREATE INDEX IF NOT EXISTS "billing_charges_empresa_id_due_date_status_idx"
ON "billing_charges"("empresa_id", "due_date", "status");

DO $$
BEGIN
  ALTER TABLE "billing_reminders"
    ADD CONSTRAINT "billing_reminders_empresa_id_fkey"
    FOREIGN KEY ("empresa_id") REFERENCES "companies"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
  ALTER TABLE "billing_reminders"
    ADD CONSTRAINT "billing_reminders_billing_charge_id_fkey"
    FOREIGN KEY ("billing_charge_id") REFERENCES "billing_charges"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
