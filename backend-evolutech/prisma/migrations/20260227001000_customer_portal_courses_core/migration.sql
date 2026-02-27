DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'Role'
      AND e.enumlabel = 'CLIENTE'
  ) THEN
    ALTER TYPE "Role" ADD VALUE 'CLIENTE';
  END IF;
END
$$;

ALTER TABLE "appointments"
ADD COLUMN IF NOT EXISTS "customer_id" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'appointments_customer_id_fkey'
  ) THEN
    ALTER TABLE "appointments"
    ADD CONSTRAINT "appointments_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "appointments_empresa_id_customer_id_scheduled_at_idx"
ON "appointments"("empresa_id", "customer_id", "scheduled_at");

CREATE TABLE IF NOT EXISTS "customer_accounts" (
  "id" TEXT NOT NULL,
  "empresa_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "last_login_at" TIMESTAMP(3),
  CONSTRAINT "customer_accounts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_accounts_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "customer_accounts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "customer_accounts_customer_id_key"
ON "customer_accounts"("customer_id");

CREATE UNIQUE INDEX IF NOT EXISTS "customer_accounts_empresa_id_email_key"
ON "customer_accounts"("empresa_id", "email");

CREATE INDEX IF NOT EXISTS "customer_accounts_empresa_id_is_active_idx"
ON "customer_accounts"("empresa_id", "is_active");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'CourseAccessStatus'
      AND e.enumlabel = 'active'
  ) THEN
    CREATE TYPE "CourseAccessStatus" AS ENUM ('active', 'pending', 'canceled', 'expired');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "courses" (
  "id" TEXT NOT NULL,
  "empresa_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "price" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "courses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "courses_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "courses_empresa_id_is_active_idx"
ON "courses"("empresa_id", "is_active");

CREATE TABLE IF NOT EXISTS "course_accesses" (
  "id" TEXT NOT NULL,
  "empresa_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "course_id" TEXT NOT NULL,
  "status" "CourseAccessStatus" NOT NULL DEFAULT 'active',
  "start_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "end_at" TIMESTAMP(3),
  "amount_paid" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "course_accesses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "course_accesses_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "course_accesses_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "course_accesses_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "course_accesses_empresa_id_customer_id_course_id_key"
ON "course_accesses"("empresa_id", "customer_id", "course_id");

CREATE INDEX IF NOT EXISTS "course_accesses_empresa_id_customer_id_status_idx"
ON "course_accesses"("empresa_id", "customer_id", "status");

CREATE INDEX IF NOT EXISTS "course_accesses_empresa_id_course_id_status_idx"
ON "course_accesses"("empresa_id", "course_id", "status");
