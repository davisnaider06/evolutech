DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubscriptionInterval') THEN
    CREATE TYPE "SubscriptionInterval" AS ENUM ('monthly', 'quarterly', 'yearly');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubscriptionStatus') THEN
    CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'pending', 'expired', 'canceled', 'suspended');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "subscription_plans" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "empresa_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "interval" "SubscriptionInterval" NOT NULL DEFAULT 'monthly',
  "price" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "included_services" INTEGER,
  "is_unlimited" BOOLEAN NOT NULL DEFAULT FALSE,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "subscription_plans_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "subscription_plans_empresa_id_is_active_idx"
ON "subscription_plans"("empresa_id", "is_active");

CREATE TABLE IF NOT EXISTS "customer_subscriptions" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "empresa_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "plan_id" TEXT NOT NULL,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'active',
  "start_at" TIMESTAMP(3) NOT NULL,
  "end_at" TIMESTAMP(3) NOT NULL,
  "remaining_services" INTEGER,
  "auto_renew" BOOLEAN NOT NULL DEFAULT TRUE,
  "amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_subscriptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_subscriptions_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "customer_subscriptions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "customer_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "customer_subscriptions_empresa_id_customer_id_status_end_at_idx"
ON "customer_subscriptions"("empresa_id", "customer_id", "status", "end_at");

CREATE INDEX IF NOT EXISTS "customer_subscriptions_empresa_id_plan_id_status_idx"
ON "customer_subscriptions"("empresa_id", "plan_id", "status");

CREATE TABLE IF NOT EXISTS "subscription_usages" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "empresa_id" TEXT NOT NULL,
  "subscription_id" TEXT NOT NULL,
  "order_id" TEXT,
  "service_id" TEXT,
  "service_name" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "amount_discounted" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by_user_id" TEXT,
  CONSTRAINT "subscription_usages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "subscription_usages_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "subscription_usages_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "customer_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "subscription_usages_empresa_id_subscription_id_used_at_idx"
ON "subscription_usages"("empresa_id", "subscription_id", "used_at");
