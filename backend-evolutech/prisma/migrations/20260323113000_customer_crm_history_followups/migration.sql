ALTER TABLE "appointment_services"
ADD COLUMN IF NOT EXISTS "recommended_return_days" INTEGER;

CREATE TABLE IF NOT EXISTS "customer_service_history_entries" (
  "id" TEXT NOT NULL,
  "empresa_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'manual',
  "appointment_id" TEXT,
  "service_id" TEXT,
  "service_name" TEXT NOT NULL,
  "professional_id" TEXT,
  "professional_name" TEXT,
  "service_date" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "return_in_days" INTEGER,
  "return_due_at" TIMESTAMP(3),
  "follow_up_sent_at" TIMESTAMP(3),
  "created_by_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "customer_service_history_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "customer_service_history_entries_empresa_id_customer_id_service_date_idx"
ON "customer_service_history_entries"("empresa_id", "customer_id", "service_date");

CREATE INDEX IF NOT EXISTS "customer_service_history_entries_empresa_id_return_due_at_idx"
ON "customer_service_history_entries"("empresa_id", "return_due_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customer_service_history_entries_empresa_id_fkey'
  ) THEN
    ALTER TABLE "customer_service_history_entries"
    ADD CONSTRAINT "customer_service_history_entries_empresa_id_fkey"
    FOREIGN KEY ("empresa_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customer_service_history_entries_customer_id_fkey'
  ) THEN
    ALTER TABLE "customer_service_history_entries"
    ADD CONSTRAINT "customer_service_history_entries_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
