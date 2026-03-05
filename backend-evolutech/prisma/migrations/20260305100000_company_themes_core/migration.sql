CREATE TABLE IF NOT EXISTS "company_themes" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "logo_path" TEXT,
  "favicon_path" TEXT,
  "login_cover_path" TEXT,
  "company_display_name" TEXT,
  "primary_color" TEXT,
  "primary_foreground" TEXT,
  "secondary_color" TEXT,
  "secondary_foreground" TEXT,
  "accent_color" TEXT,
  "accent_foreground" TEXT,
  "background_color" TEXT,
  "foreground_color" TEXT,
  "card_color" TEXT,
  "card_foreground" TEXT,
  "muted_color" TEXT,
  "muted_foreground" TEXT,
  "border_color" TEXT,
  "destructive_color" TEXT,
  "sidebar_background" TEXT,
  "sidebar_foreground" TEXT,
  "sidebar_primary" TEXT,
  "sidebar_accent" TEXT,
  "border_radius" TEXT,
  "font_family" TEXT,
  "dark_mode_enabled" BOOLEAN,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "company_themes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "company_themes_company_id_key"
ON "company_themes"("company_id");

CREATE INDEX IF NOT EXISTS "company_themes_company_id_idx"
ON "company_themes"("company_id");

DO $$
BEGIN
  ALTER TABLE "company_themes"
    ADD CONSTRAINT "company_themes_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
