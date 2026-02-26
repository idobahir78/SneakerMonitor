-- Fix Multi-User Unique Constraints
-- The previous schema had a UNIQUE constraint on product_url, which means 
-- different users cannot find the same product without overwriting each other.
-- We must drop the old constraint and create a new composite constraint.

-- 1. Drop the old unique constraint on product_url.
-- Note: In Supabase/Postgres, the default name for a unique constraint on a column is often table_column_key.
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_product_url_key;

-- 2. Add a new composite UNIQUE constraint allowing the same product for DIFFERENT search sessions.
ALTER TABLE public.products ADD CONSTRAINT products_url_session_key UNIQUE (product_url, search_id);
