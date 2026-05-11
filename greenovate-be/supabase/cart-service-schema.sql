-- Run this SQL in the Supabase SQL Editor for the cart-service project.
-- Project URL: https://vyudzocgyvycuetstjgy.supabase.co
-- Go to: https://supabase.com/dashboard/project/vyudzocgyvycuetstjgy/sql

CREATE TABLE IF NOT EXISTS cart_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  branch_id TEXT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cart_items_customer_id_idx ON cart_items (customer_id);
