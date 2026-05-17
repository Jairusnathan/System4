-- Run this in your INVENTORY / POS Supabase SQL Editor (SECOND_SUPABASE_URL).
-- Alters the existing storebranches table to add the missing metadata columns.

ALTER TABLE public.storebranches
  ADD COLUMN IF NOT EXISTS address      TEXT,
  ADD COLUMN IF NOT EXISTS phone        TEXT,
  ADD COLUMN IF NOT EXISTS latitude     NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS longitude    NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS opening_time TIME DEFAULT '08:00:00',
  ADD COLUMN IF NOT EXISTS closing_time TIME DEFAULT '20:00:00',
  ADD COLUMN IF NOT EXISTS is_active    BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE public.storebranches SET
  address      = 'Ayala Avenue, Makati City, Metro Manila',
  phone        = '09171234567',
  latitude     = 14.5547299,
  longitude    = 121.0244452,
  opening_time = '08:00:00',
  closing_time = '20:00:00',
  is_active    = TRUE
WHERE id = 1;

UPDATE public.storebranches SET
  address      = 'Ortigas Center, Pasig City, Metro Manila',
  phone        = '09181234567',
  latitude     = 14.5869164,
  longitude    = 121.0607074,
  opening_time = '09:00:00',
  closing_time = '21:00:00',
  is_active    = TRUE
WHERE id = 2;

UPDATE public.storebranches SET
  address      = 'Quezon Avenue, Quezon City, Metro Manila',
  phone        = '09191234567',
  latitude     = 14.6395146,
  longitude    = 121.0336707,
  opening_time = '08:30:00',
  closing_time = '19:30:00',
  is_active    = TRUE
WHERE id = 3;
