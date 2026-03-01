CREATE TABLE IF NOT EXISTS custom_taxonomy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(brand, model)
);

ALTER TABLE custom_taxonomy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read" ON custom_taxonomy FOR SELECT USING (true);

CREATE POLICY "Allow service role insert" ON custom_taxonomy FOR INSERT TO service_role WITH CHECK (true);
