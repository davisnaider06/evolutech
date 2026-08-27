-- Imagens (logo, favicon, capa de curso) passam a viver no proprio banco,
-- substituindo o storage do Supabase.
CREATE TABLE IF NOT EXISTS "media_assets" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT,
    "kind" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "media_assets_empresa_id_kind_idx" ON "media_assets"("empresa_id", "kind");

DO $$ BEGIN
    ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_empresa_id_fkey"
        FOREIGN KEY ("empresa_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
