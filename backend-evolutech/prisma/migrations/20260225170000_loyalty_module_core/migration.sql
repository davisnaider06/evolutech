DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LoyaltyTransactionType') THEN
    CREATE TYPE "LoyaltyTransactionType" AS ENUM (
      'earn_points',
      'redeem_points',
      'earn_cashback',
      'redeem_cashback',
      'bonus',
      'adjustment',
      'tenth_service_discount'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "company_loyalty_settings" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "empresa_id" TEXT NOT NULL,
  "points_per_service" INTEGER NOT NULL DEFAULT 1,
  "cashback_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "tenth_service_free" BOOLEAN NOT NULL DEFAULT TRUE,
  "point_value" DECIMAL(10,2) NOT NULL DEFAULT 1,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_loyalty_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "company_loyalty_settings_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "company_loyalty_settings_empresa_id_key"
ON "company_loyalty_settings"("empresa_id");

CREATE TABLE IF NOT EXISTS "customer_loyalty_profiles" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "empresa_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "points_balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "cashback_balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "total_points_earned" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "total_points_redeemed" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "total_cashback_earned" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "total_cashback_used" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "total_services_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_loyalty_profiles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_loyalty_profiles_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "customer_loyalty_profiles_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "customer_loyalty_profiles_customer_id_key"
ON "customer_loyalty_profiles"("customer_id");

CREATE UNIQUE INDEX IF NOT EXISTS "customer_loyalty_profiles_empresa_id_customer_id_key"
ON "customer_loyalty_profiles"("empresa_id", "customer_id");

CREATE INDEX IF NOT EXISTS "customer_loyalty_profiles_empresa_id_idx"
ON "customer_loyalty_profiles"("empresa_id");

CREATE INDEX IF NOT EXISTS "customer_loyalty_profiles_customer_id_idx"
ON "customer_loyalty_profiles"("customer_id");

CREATE TABLE IF NOT EXISTS "customer_loyalty_transactions" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "empresa_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "profile_id" TEXT NOT NULL,
  "order_id" TEXT,
  "transaction_type" "LoyaltyTransactionType" NOT NULL,
  "points_delta" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "cashback_delta" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "amount_reference" DECIMAL(10,2),
  "notes" TEXT,
  "created_by_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_loyalty_transactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_loyalty_transactions_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "customer_loyalty_transactions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "customer_loyalty_transactions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "customer_loyalty_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "customer_loyalty_transactions_empresa_id_customer_id_created_at_idx"
ON "customer_loyalty_transactions"("empresa_id", "customer_id", "created_at");

CREATE INDEX IF NOT EXISTS "customer_loyalty_transactions_order_id_idx"
ON "customer_loyalty_transactions"("order_id");
