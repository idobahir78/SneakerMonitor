-- 1. Add "is_scheduled" boolean to the search_jobs table, default false to prevent automatic running
-- 2. Add "search_term" and "size_filter" to persist the exact query the user wants scheduled
ALTER TABLE public.search_jobs
ADD COLUMN IF NOT EXISTS is_scheduled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS search_term TEXT,
ADD COLUMN IF NOT EXISTS size_filter TEXT;

-- 3. We allow anyone to read these records (since search_id maps to URL hash)
--    but we need to make sure our Update policies allow users to flip the toggle.
--    (Assuming existing policies allow anon/auth updates. If not, the anon user needs update rights here)
CREATE POLICY "Allow anon updates to search_jobs" ON public.search_jobs
    FOR UPDATE USING (true);
