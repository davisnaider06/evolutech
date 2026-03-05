-- Add media fields to courses
ALTER TABLE "courses"
ADD COLUMN IF NOT EXISTS "content_type" TEXT NOT NULL DEFAULT 'video',
ADD COLUMN IF NOT EXISTS "content_url" TEXT,
ADD COLUMN IF NOT EXISTS "cover_image_url" TEXT;

-- Create course manager accounts (separate login for course module)
CREATE TABLE IF NOT EXISTS "course_manager_accounts" (
  "id" TEXT NOT NULL,
  "empresa_id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "last_login_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "course_manager_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "course_manager_accounts_empresa_id_email_key"
ON "course_manager_accounts"("empresa_id", "email");

CREATE INDEX IF NOT EXISTS "course_manager_accounts_empresa_id_is_active_idx"
ON "course_manager_accounts"("empresa_id", "is_active");

ALTER TABLE "course_manager_accounts"
ADD CONSTRAINT "course_manager_accounts_empresa_id_fkey"
FOREIGN KEY ("empresa_id") REFERENCES "companies"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
