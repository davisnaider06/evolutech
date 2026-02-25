CREATE TABLE IF NOT EXISTS "commission_payouts" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "empresa_id" TEXT NOT NULL,
  "professional_id" TEXT NOT NULL,
  "month_ref" TIMESTAMP(3) NOT NULL,
  "computed_commission" DECIMAL(10,2) NOT NULL,
  "amount_paid" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "paid_at" TIMESTAMP(3),
  "note" TEXT,
  "created_by_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "commission_payouts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "commission_payouts_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "commission_payouts_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "commission_payouts_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "commission_payouts_empresa_id_professional_id_month_ref_key"
ON "commission_payouts"("empresa_id", "professional_id", "month_ref");

CREATE INDEX IF NOT EXISTS "commission_payouts_empresa_id_month_ref_status_idx"
ON "commission_payouts"("empresa_id", "month_ref", "status");

CREATE INDEX IF NOT EXISTS "commission_payouts_empresa_id_professional_id_month_ref_idx"
ON "commission_payouts"("empresa_id", "professional_id", "month_ref");
