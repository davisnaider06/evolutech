CREATE TABLE IF NOT EXISTS "employee_module_permissions" (
  "id" TEXT NOT NULL,
  "empresa_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "modulo_id" TEXT NOT NULL,
  "is_allowed" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "employee_module_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "employee_module_permissions_empresa_id_user_id_modulo_id_key"
ON "employee_module_permissions"("empresa_id", "user_id", "modulo_id");

CREATE INDEX IF NOT EXISTS "employee_module_permissions_empresa_id_user_id_idx"
ON "employee_module_permissions"("empresa_id", "user_id");

CREATE INDEX IF NOT EXISTS "employee_module_permissions_empresa_id_modulo_id_idx"
ON "employee_module_permissions"("empresa_id", "modulo_id");

DO $$
BEGIN
  ALTER TABLE "employee_module_permissions"
    ADD CONSTRAINT "employee_module_permissions_empresa_id_fkey"
    FOREIGN KEY ("empresa_id") REFERENCES "companies"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
  ALTER TABLE "employee_module_permissions"
    ADD CONSTRAINT "employee_module_permissions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
  ALTER TABLE "employee_module_permissions"
    ADD CONSTRAINT "employee_module_permissions_modulo_id_fkey"
    FOREIGN KEY ("modulo_id") REFERENCES "modulos"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
