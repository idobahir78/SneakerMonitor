-- Supabase SQL Migration for Multi-User Search Isolation
-- This script replaces the old system_state with search_jobs 
-- and adds the search_id to products.

-- 1. Create the new search_jobs table
CREATE TABLE IF NOT EXISTS public.search_jobs (
    id TEXT PRIMARY KEY,
    is_scanning BOOLEAN DEFAULT false,
    last_run TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add search_id to the products table if it doesn't exist
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS search_id TEXT;

-- 3. (Optional) Initialize the default scheduled_system_run in search_jobs
INSERT INTO public.search_jobs (id, is_scanning, last_run)
VALUES ('scheduled_system_run', false, NOW())
ON CONFLICT (id) DO NOTHING;

-- Note: You can now safely delete the old system_state table if you wish.
-- DROP TABLE IF EXISTS public.system_state;
