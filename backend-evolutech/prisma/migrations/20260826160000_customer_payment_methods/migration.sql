-- Cartao autorizado pelo cliente para a cobranca recorrente da mensalidade.
-- Guarda apenas referencias do gateway e os dados visiveis do cartao;
-- nenhum dado sensivel trafega ou fica armazenado aqui.
CREATE TABLE IF NOT EXISTS "customer_payment_methods" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "external_customer_id" TEXT NOT NULL,
    "external_payment_method_id" TEXT NOT NULL,
    "brand" TEXT,
    "last4" TEXT,
    "exp_month" INTEGER,
    "exp_year" INTEGER,
    "is_default" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_payment_methods_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "customer_payment_methods_unique"
    ON "customer_payment_methods"("empresa_id", "customer_id", "provider", "external_payment_method_id");
CREATE INDEX IF NOT EXISTS "customer_payment_methods_empresa_id_customer_id_is_active_idx"
    ON "customer_payment_methods"("empresa_id", "customer_id", "is_active");

DO $$ BEGIN
    ALTER TABLE "customer_payment_methods" ADD CONSTRAINT "customer_payment_methods_empresa_id_fkey"
        FOREIGN KEY ("empresa_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "customer_payment_methods" ADD CONSTRAINT "customer_payment_methods_customer_id_fkey"
        FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
