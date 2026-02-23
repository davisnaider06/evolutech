-- Payment gateways per company (multi-tenant)
CREATE TABLE IF NOT EXISTS "payment_gateways" (
  "id" TEXT NOT NULL,
  "empresa_id" TEXT NOT NULL,
  "provedor" TEXT NOT NULL,
  "nome_exibicao" TEXT NOT NULL,
  "public_key" TEXT,
  "secret_key_encrypted" TEXT,
  "webhook_secret_encrypted" TEXT,
  "ambiente" TEXT NOT NULL DEFAULT 'sandbox',
  "is_active" BOOLEAN NOT NULL DEFAULT false,
  "webhook_url" TEXT,
  "configuracoes" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payment_gateways_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "payment_gateways"
  ADD COLUMN IF NOT EXISTS "webhook_secret_encrypted" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "payment_gateways_empresa_id_provedor_key"
  ON "payment_gateways"("empresa_id", "provedor");

CREATE INDEX IF NOT EXISTS "payment_gateways_empresa_id_is_active_idx"
  ON "payment_gateways"("empresa_id", "is_active");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payment_gateways_empresa_id_fkey'
  ) THEN
    ALTER TABLE "payment_gateways"
      ADD CONSTRAINT "payment_gateways_empresa_id_fkey"
      FOREIGN KEY ("empresa_id") REFERENCES "companies"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Payment transaction tracking for gateway reconciliation/reporting
CREATE TABLE IF NOT EXISTS "payment_transactions" (
  "id" TEXT NOT NULL,
  "empresa_id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "gateway_id" TEXT,
  "provider" TEXT NOT NULL,
  "payment_method" TEXT NOT NULL,
  "external_payment_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "amount" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'brl',
  "qr_code_text" TEXT,
  "qr_code_image_url" TEXT,
  "gateway_response" JSONB,
  "paid_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "payment_transactions_empresa_id_status_created_at_idx"
  ON "payment_transactions"("empresa_id", "status", "created_at");

CREATE INDEX IF NOT EXISTS "payment_transactions_external_payment_id_provider_idx"
  ON "payment_transactions"("external_payment_id", "provider");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payment_transactions_empresa_id_fkey'
  ) THEN
    ALTER TABLE "payment_transactions"
      ADD CONSTRAINT "payment_transactions_empresa_id_fkey"
      FOREIGN KEY ("empresa_id") REFERENCES "companies"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payment_transactions_order_id_fkey'
  ) THEN
    ALTER TABLE "payment_transactions"
      ADD CONSTRAINT "payment_transactions_order_id_fkey"
      FOREIGN KEY ("order_id") REFERENCES "orders"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payment_transactions_gateway_id_fkey'
  ) THEN
    ALTER TABLE "payment_transactions"
      ADD CONSTRAINT "payment_transactions_gateway_id_fkey"
      FOREIGN KEY ("gateway_id") REFERENCES "payment_gateways"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

