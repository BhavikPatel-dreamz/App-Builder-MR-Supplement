-- Bottom tab action settings for Products, Courses, and Yagnas tabs.
ALTER TABLE "ShopSettings" ADD COLUMN IF NOT EXISTS "productsTabCollection" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "ShopSettings" ADD COLUMN IF NOT EXISTS "coursesTabCollection" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "ShopSettings" ADD COLUMN IF NOT EXISTS "yagnasTabCollection" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "ShopSettings" ADD COLUMN IF NOT EXISTS "yagnasTabProduct" JSONB NOT NULL DEFAULT '{}';
