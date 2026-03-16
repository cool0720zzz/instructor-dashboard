-- =============================================
-- Supabase SQL: Run this in the Supabase SQL Editor
-- =============================================

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  license_key text UNIQUE NOT NULL,
  plan text DEFAULT 'free',
  max_instructors integer DEFAULT 3,
  naver_place_url text,
  is_active boolean DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Instructors table
CREATE TABLE IF NOT EXISTS instructors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  name text NOT NULL,
  blog_url text,
  blog_rss_url text,
  keywords jsonb DEFAULT '[]',
  display_color text DEFAULT '#22c55e',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_customers_license_key ON customers(license_key);
CREATE INDEX IF NOT EXISTS idx_instructors_customer_id ON instructors(customer_id);

-- Enable Row Level Security (optional, service key bypasses RLS)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructors ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (Vercel functions use service key)
CREATE POLICY "Service role full access on customers"
  ON customers FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on instructors"
  ON instructors FOR ALL
  USING (true)
  WITH CHECK (true);
