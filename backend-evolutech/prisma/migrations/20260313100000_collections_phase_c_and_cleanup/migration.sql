ALTER TABLE "billing_reminders"
ADD COLUMN IF NOT EXISTS "attempt_count" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "billing_reminders"
ADD COLUMN IF NOT EXISTS "last_attempt_at" TIMESTAMP(3);

ALTER TABLE "billing_reminders"
ADD COLUMN IF NOT EXISTS "next_retry_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "billing_reminders_empresa_id_next_retry_at_status_idx"
ON "billing_reminders"("empresa_id", "next_retry_at", "status");

CREATE TABLE IF NOT EXISTS "collection_automation_runs" (
  "id" TEXT NOT NULL,
  "empresa_id" TEXT NOT NULL,
  "trigger_source" TEXT NOT NULL,
  "dry_run" BOOLEAN NOT NULL DEFAULT false,
  "send_now" BOOLEAN NOT NULL DEFAULT true,
  "charges_analyzed" INTEGER NOT NULL DEFAULT 0,
  "reminders_created" INTEGER NOT NULL DEFAULT 0,
  "reminders_sent" INTEGER NOT NULL DEFAULT 0,
  "reminders_failed" INTEGER NOT NULL DEFAULT 0,
  "reminders_retried" INTEGER NOT NULL DEFAULT 0,
  "processed_scheduled" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'completed',
  "error_message" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "collection_automation_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "collection_automation_runs_empresa_id_created_at_idx"
ON "collection_automation_runs"("empresa_id", "created_at");

CREATE INDEX IF NOT EXISTS "collection_automation_runs_empresa_id_status_created_at_idx"
ON "collection_automation_runs"("empresa_id", "status", "created_at");

ALTER TABLE "collection_automation_runs"
ADD CONSTRAINT "collection_automation_runs_empresa_id_fkey"
FOREIGN KEY ("empresa_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP TABLE IF EXISTS "course_manager_accounts";
