CREATE TABLE IF NOT EXISTS "billing_charges" (
  "id" TEXT NOT NULL,
  "empresa_id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "customer_name" TEXT NOT NULL,
  "customer_email" TEXT,
  "customer_phone" TEXT,
  "amount" DECIMAL(10,2) NOT NULL,
  "payment_method" TEXT NOT NULL DEFAULT 'pix',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "due_date" TIMESTAMP(3),
  "paid_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "billing_charges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "billing_charges_order_id_key"
  ON "billing_charges"("order_id");

CREATE INDEX IF NOT EXISTS "billing_charges_empresa_id_status_created_at_idx"
  ON "billing_charges"("empresa_id", "status", "created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'billing_charges_empresa_id_fkey'
  ) THEN
    ALTER TABLE "billing_charges"
      ADD CONSTRAINT "billing_charges_empresa_id_fkey"
      FOREIGN KEY ("empresa_id") REFERENCES "companies"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'billing_charges_order_id_fkey'
  ) THEN
    ALTER TABLE "billing_charges"
      ADD CONSTRAINT "billing_charges_order_id_fkey"
      FOREIGN KEY ("order_id") REFERENCES "orders"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

