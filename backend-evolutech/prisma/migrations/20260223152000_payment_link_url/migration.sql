ALTER TABLE "payment_transactions"
  ADD COLUMN IF NOT EXISTS "payment_link_url" TEXT;

