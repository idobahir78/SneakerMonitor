-- Database: SneakerMonitor v7.0 Schema

-- 1. Create the Products Table
CREATE TABLE IF NOT EXISTS public.products (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    price NUMERIC,
    site TEXT NOT NULL,
    image_url TEXT,
    product_url TEXT UNIQUE NOT NULL,
    sizes JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create the System State Table
CREATE TABLE IF NOT EXISTS public.system_state (
    id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    is_scanning BOOLEAN DEFAULT false,
    last_run TIMESTAMPTZ DEFAULT now()
);

-- 3. Initial state for metadata
INSERT INTO public.system_state (id, is_scanning)
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_state ENABLE ROW LEVEL SECURITY;

-- 5. Create Policies (Allow public read access)
CREATE POLICY "Allow public read access on products" ON public.products
    FOR SELECT USING (true);

CREATE POLICY "Allow public read access on system_state" ON public.system_state
    FOR SELECT USING (true);

-- 6. Cleanup Function (Cron-like trigger for manual/scheduled runs)
-- monitor.js will call this: DELETE FROM public.products WHERE created_at < now() - interval '24 hours';
