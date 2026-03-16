-- Create customers table in Supabase with expanded fields
DROP TABLE IF EXISTS public.customers;

CREATE TABLE public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    address TEXT,
    city TEXT,
    birthday DATE,
    gender TEXT,
    password TEXT NOT NULL, -- Hashed password
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Create policies (Simplest version for now - allowing all through backend ANON key)
CREATE POLICY "Allow anonymous read" ON public.customers FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert" ON public.customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous update" ON public.customers FOR UPDATE USING (true);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create a trigger to auto-update updated_at
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON public.customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create branches table
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    phone TEXT NOT NULL,
    opening_time TEXT NOT NULL,
    closing_time TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create branch inventory table
-- This links products (by ID) to branches with a stock level
CREATE TABLE IF NOT EXISTS public.branch_inventory (
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    stock INTEGER DEFAULT 0,
    PRIMARY KEY (branch_id, product_id)
);

-- Add sample branches
INSERT INTO public.branches (name, address, phone, opening_time, closing_time) 
VALUES 
('Main Branch (Makati)', '123 Ayala Avenue, Makati City', '+63281234567', '08:00', '22:00'),
('BGC Branch (Late Night)', 'High Street, BGC, Taguig City', '+63287654321', '14:00', '02:00'),
('Quezon City Branch (Early)', 'Trinoma Mall, Quezon City', '+63289876543', '06:00', '18:00');

-- Note: Inventory seeding can be done via the app or additional SQL after branch IDs are generated.

-- Create orders table for transactions and delivery snapshots
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id),
    branch_id UUID REFERENCES public.branches(id),
    
    -- Delivery Snapshot (Important: Store it here so it doesn't change later)
    delivery_address TEXT NOT NULL,
    delivery_contact_number TEXT NOT NULL,
    customer_name_at_order TEXT NOT NULL,
    
    -- Financials
    total_amount DECIMAL(10,2) NOT NULL,
    payment_status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'failed'
    order_status TEXT DEFAULT 'preparing', -- 'preparing', 'out_for_delivery', 'delivered'
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for the specific items inside each order
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    price_at_purchase DECIMAL(10,2) NOT NULL
);


