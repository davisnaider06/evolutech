CREATE TABLE IF NOT EXISTS "commission_profiles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "empresa_id" UUID NOT NULL,
  "professional_id" UUID NOT NULL,
  "service_commission_pct" DECIMAL(5,2) NOT NULL DEFAULT 40,
  "product_commission_pct" DECIMAL(5,2) NOT NULL DEFAULT 10,
  "monthly_fixed_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "commission_profiles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "commission_profiles_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "commission_profiles_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "commission_profiles_empresa_id_professional_id_key"
ON "commission_profiles"("empresa_id", "professional_id");

CREATE INDEX IF NOT EXISTS "commission_profiles_empresa_id_is_active_idx"
ON "commission_profiles"("empresa_id", "is_active");

CREATE INDEX IF NOT EXISTS "commission_profiles_empresa_id_professional_id_idx"
ON "commission_profiles"("empresa_id", "professional_id");

CREATE TABLE IF NOT EXISTS "commission_adjustments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "empresa_id" UUID NOT NULL,
  "professional_id" UUID NOT NULL,
  "month_ref" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "reason" TEXT,
  "created_by_user_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "commission_adjustments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "commission_adjustments_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "commission_adjustments_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "commission_adjustments_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "commission_adjustments_empresa_id_professional_id_month_ref_idx"
ON "commission_adjustments"("empresa_id", "professional_id", "month_ref");

CREATE INDEX IF NOT EXISTS "commission_adjustments_empresa_id_month_ref_idx"
ON "commission_adjustments"("empresa_id", "month_ref");
