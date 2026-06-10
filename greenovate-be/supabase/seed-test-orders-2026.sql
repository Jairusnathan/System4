-- seed-test-orders-2026.sql
-- Test data: 800 orders spread across 2026 Jan-May
-- Run in Order Supabase SQL Editor after seed-test-orders-500more.sql

-- Step 1: Insert 800 test transactions (2026 Jan-May)
INSERT INTO transactions (id, tx_no, status, created_at, paid_at, subtotal, total_amount, payment_method, vat, items_count, discount_type, discount_amount, receipt_id, cashier_name, is_seed_test)
SELECT
  uuid_generate_v4(),
  (SELECT COALESCE(MAX(tx_no), 60000) FROM transactions WHERE cashier_name = 'Ecommerce' AND tx_no < 100000) + row_number() OVER (),
  status,
  created_at,
  CASE WHEN status = 'paid' THEN created_at + (INTERVAL '1 hour' * (random() * 48)::int) ELSE NULL END,
  subtotal,
  ROUND((subtotal - discount_amount)::numeric, 2),
  payment_method,
  ROUND((subtotal * 0.12)::numeric, 2),
  items_count,
  discount_type,
  discount_amount,
  NULL,
  'Ecommerce',
  true
FROM (
  SELECT
    CASE WHEN random() < 0.85 THEN 'paid' ELSE 'pending' END AS status,
    TIMESTAMP '2026-01-01' + (RANDOM() * INTERVAL '150 days') AS created_at,
    ROUND((RANDOM() * 400 + 50)::numeric, 2) AS subtotal,
    CASE WHEN random() < 0.6 THEN 'cash' ELSE 'mobile' END AS payment_method,
    (RANDOM() * 10 + 1)::int AS items_count,
    CASE WHEN random() < 0.2 THEN 'PHARMACARE10' ELSE 'None' END AS discount_type,
    CASE WHEN random() < 0.2 THEN ROUND((RANDOM() * 30)::numeric, 2) ELSE 0::numeric END AS discount_amount
  FROM generate_series(1, 800)
) base;

-- Step 2: Insert 800 test receipts (2026 Jan-May)
INSERT INTO receipts (receipt_id, receipt_number, issued_at, is_seed_test)
SELECT
  row_number() OVER () + (SELECT COALESCE(MAX(receipt_id), 0) FROM receipts),
  LPAD((row_number() OVER () + (SELECT COALESCE(MAX(receipt_id), 0) FROM receipts))::text, 10, '0'),
  TIMESTAMP '2026-01-01' + (RANDOM() * INTERVAL '150 days'),
  true
FROM generate_series(1, 800);

-- Step 3: Link receipts to transactions (1-to-1)
UPDATE transactions t
SET receipt_id = r.receipt_id
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) as rn FROM transactions
  WHERE receipt_id IS NULL AND cashier_name = 'Ecommerce' AND is_seed_test = true
) t_ranked
JOIN (
  SELECT receipt_id, ROW_NUMBER() OVER (ORDER BY receipt_id) as rn FROM receipts
  WHERE is_seed_test = true AND receipt_id NOT IN (SELECT receipt_id FROM transactions WHERE receipt_id IS NOT NULL)
) r ON t_ranked.rn = r.rn
WHERE t.id = t_ranked.id;

-- Step 4: Insert ~1600 test transaction_items
INSERT INTO transaction_items (transaction_id, name, category, unit_price, quantity, line_total, created_at, is_seed_test)
SELECT t_id, name, category, unit_price, quantity, ROUND((quantity * unit_price)::numeric, 2), tx_date, true
FROM (
  SELECT
    t.id AS t_id,
    t.created_at AS tx_date,
    CASE (row_number() OVER () % 37)
      WHEN 1 THEN 'Acetaminophen 500mg' WHEN 2 THEN 'Ibuprofen 200mg' WHEN 3 THEN 'Aspirin 8mg'
      WHEN 4 THEN 'Allergy Relief (Loratadine)' WHEN 5 THEN 'Cough Syrup' WHEN 6 THEN 'Antacid Tablets'
      WHEN 7 THEN 'Cold & Flu Relief' WHEN 8 THEN 'Multivitamin Daily' WHEN 9 THEN 'Vitamin D3 2000 IU'
      WHEN 10 THEN 'Vitamin C 1000mg' WHEN 11 THEN 'Omega-3 Fish Oil' WHEN 12 THEN 'Calcium + Vitamin D'
      WHEN 13 THEN 'Probiotic Complex' WHEN 14 THEN 'Hand Sanitizer 8oz' WHEN 15 THEN 'Toothpaste Whitening'
      WHEN 16 THEN 'Mouthwash Antiseptic' WHEN 17 THEN 'Dental Floss' WHEN 18 THEN 'Body Lotion 16oz'
      WHEN 19 THEN 'Sunscreen SPF 50' WHEN 20 THEN 'Shampoo & Conditioner' WHEN 21 THEN 'Adhesive Bandages (100ct)'
      WHEN 22 THEN 'Gauze Pads Sterile' WHEN 23 THEN 'Medical Tape' WHEN 24 THEN 'Antiseptic Wipes (50ct)'
      WHEN 25 THEN 'First Aid Kit' WHEN 26 THEN 'Thermometer Digital' WHEN 27 THEN 'Blood Pressure Monitor'
      WHEN 28 THEN 'Glucose Test Strips (50ct)' WHEN 29 THEN 'Heating Pad Electric' WHEN 30 THEN 'Compression Socks'
      WHEN 31 THEN 'Sleep Aid Tablets' WHEN 32 THEN 'Eye Drops Lubricating' WHEN 33 THEN 'Baby Diapers (Size 3)'
      WHEN 34 THEN 'Baby Wipes (80ct)' WHEN 35 THEN 'Baby Lotion 16oz' WHEN 36 THEN 'Baby Powder'
      ELSE 'Diaper Rash Cream'
    END AS name,
    CASE (row_number() OVER () % 37)
      WHEN 1 THEN 'OTC Medications' WHEN 2 THEN 'OTC Medications' WHEN 3 THEN 'OTC Medications'
      WHEN 4 THEN 'OTC Medications' WHEN 5 THEN 'OTC Medications' WHEN 6 THEN 'OTC Medications'
      WHEN 7 THEN 'OTC Medications' WHEN 8 THEN 'Vitamins & Supplements' WHEN 9 THEN 'Vitamins & Supplements'
      WHEN 10 THEN 'Vitamins & Supplements' WHEN 11 THEN 'Vitamins & Supplements' WHEN 12 THEN 'Vitamins & Supplements'
      WHEN 13 THEN 'Vitamins & Supplements' WHEN 14 THEN 'Personal Care' WHEN 15 THEN 'Personal Care'
      WHEN 16 THEN 'Personal Care' WHEN 17 THEN 'Personal Care' WHEN 18 THEN 'Personal Care'
      WHEN 19 THEN 'Personal Care' WHEN 20 THEN 'Personal Care' WHEN 21 THEN 'First Aid'
      WHEN 22 THEN 'First Aid' WHEN 23 THEN 'First Aid' WHEN 24 THEN 'First Aid'
      WHEN 25 THEN 'First Aid' WHEN 26 THEN 'First Aid' WHEN 27 THEN 'Health & Wellness'
      WHEN 28 THEN 'Health & Wellness' WHEN 29 THEN 'Health & Wellness' WHEN 30 THEN 'Health & Wellness'
      WHEN 31 THEN 'Health & Wellness' WHEN 32 THEN 'Health & Wellness' WHEN 33 THEN 'Baby Care'
      WHEN 34 THEN 'Baby Care' WHEN 35 THEN 'Baby Care' WHEN 36 THEN 'Baby Care'
      ELSE 'Baby Care'
    END AS category,
    CASE (row_number() OVER () % 37)
      WHEN 1 THEN 8.99 WHEN 2 THEN 9.49 WHEN 3 THEN 7.99 WHEN 4 THEN 12.99 WHEN 5 THEN 10.99
      WHEN 6 THEN 8.49 WHEN 7 THEN 11.99 WHEN 8 THEN 15.99 WHEN 9 THEN 12.99 WHEN 10 THEN 13.49
      WHEN 11 THEN 18.99 WHEN 12 THEN 14.99 WHEN 13 THEN 24.99 WHEN 14 THEN 5.99 WHEN 15 THEN 6.49
      WHEN 16 THEN 7.99 WHEN 17 THEN 3.99 WHEN 18 THEN 9.99 WHEN 19 THEN 12.99 WHEN 20 THEN 11.99
      WHEN 21 THEN 6.99 WHEN 22 THEN 8.49 WHEN 23 THEN 4.99 WHEN 24 THEN 7.49 WHEN 25 THEN 24.99
      WHEN 26 THEN 12.99 WHEN 27 THEN 49.99 WHEN 28 THEN 32.99 WHEN 29 THEN 29.99 WHEN 30 THEN 16.99
      WHEN 31 THEN 14.99 WHEN 32 THEN 9.99 WHEN 33 THEN 24.99 WHEN 34 THEN 6.99 WHEN 35 THEN 8.99
      WHEN 36 THEN 5.99 ELSE 7.99
    END::numeric AS unit_price,
    (RANDOM() * 5 + 1)::int AS quantity
  FROM (
    SELECT id, created_at FROM transactions
    WHERE cashier_name = 'Ecommerce' AND is_seed_test = true
      AND id NOT IN (SELECT DISTINCT transaction_id FROM transaction_items WHERE transaction_id IS NOT NULL)
  ) t
  CROSS JOIN LATERAL generate_series(1, GREATEST(1, (RANDOM() * 4)::int))
  LIMIT 1600
) sub;

-- Step 5: Insert 800 test online_orders
INSERT INTO online_orders (
  id, customer_id, receipt_id, receipt_number, transaction_id, order_number, tx_no, branch_id,
  shipping_address, payment_method, payment_status, fulfillment_status,
  delivery_method, subtotal, delivery_fee, discount_amount, total, metadata, created_at, is_seed_test
)
SELECT
  uuid_generate_v4(),
  CASE (row_number() OVER (ORDER BY t.id) % 50)
    WHEN 0 THEN '550e8400-e29b-41d4-a716-446655440059'
    WHEN 1 THEN '550e8400-e29b-41d4-a716-446655440010'
    WHEN 2 THEN '550e8400-e29b-41d4-a716-446655440011'
    WHEN 3 THEN '550e8400-e29b-41d4-a716-446655440012'
    WHEN 4 THEN '550e8400-e29b-41d4-a716-446655440013'
    WHEN 5 THEN '550e8400-e29b-41d4-a716-446655440014'
    WHEN 6 THEN '550e8400-e29b-41d4-a716-446655440015'
    WHEN 7 THEN '550e8400-e29b-41d4-a716-446655440016'
    WHEN 8 THEN '550e8400-e29b-41d4-a716-446655440017'
    WHEN 9 THEN '550e8400-e29b-41d4-a716-446655440018'
    WHEN 10 THEN '550e8400-e29b-41d4-a716-446655440019'
    WHEN 11 THEN '550e8400-e29b-41d4-a716-446655440020'
    WHEN 12 THEN '550e8400-e29b-41d4-a716-446655440021'
    WHEN 13 THEN '550e8400-e29b-41d4-a716-446655440022'
    WHEN 14 THEN '550e8400-e29b-41d4-a716-446655440023'
    WHEN 15 THEN '550e8400-e29b-41d4-a716-446655440024'
    WHEN 16 THEN '550e8400-e29b-41d4-a716-446655440025'
    WHEN 17 THEN '550e8400-e29b-41d4-a716-446655440026'
    WHEN 18 THEN '550e8400-e29b-41d4-a716-446655440027'
    WHEN 19 THEN '550e8400-e29b-41d4-a716-446655440028'
    WHEN 20 THEN '550e8400-e29b-41d4-a716-446655440029'
    WHEN 21 THEN '550e8400-e29b-41d4-a716-446655440030'
    WHEN 22 THEN '550e8400-e29b-41d4-a716-446655440031'
    WHEN 23 THEN '550e8400-e29b-41d4-a716-446655440032'
    WHEN 24 THEN '550e8400-e29b-41d4-a716-446655440033'
    WHEN 25 THEN '550e8400-e29b-41d4-a716-446655440034'
    WHEN 26 THEN '550e8400-e29b-41d4-a716-446655440035'
    WHEN 27 THEN '550e8400-e29b-41d4-a716-446655440036'
    WHEN 28 THEN '550e8400-e29b-41d4-a716-446655440037'
    WHEN 29 THEN '550e8400-e29b-41d4-a716-446655440038'
    WHEN 30 THEN '550e8400-e29b-41d4-a716-446655440039'
    WHEN 31 THEN '550e8400-e29b-41d4-a716-446655440040'
    WHEN 32 THEN '550e8400-e29b-41d4-a716-446655440041'
    WHEN 33 THEN '550e8400-e29b-41d4-a716-446655440042'
    WHEN 34 THEN '550e8400-e29b-41d4-a716-446655440043'
    WHEN 35 THEN '550e8400-e29b-41d4-a716-446655440044'
    WHEN 36 THEN '550e8400-e29b-41d4-a716-446655440045'
    WHEN 37 THEN '550e8400-e29b-41d4-a716-446655440046'
    WHEN 38 THEN '550e8400-e29b-41d4-a716-446655440047'
    WHEN 39 THEN '550e8400-e29b-41d4-a716-446655440048'
    WHEN 40 THEN '550e8400-e29b-41d4-a716-446655440049'
    WHEN 41 THEN '550e8400-e29b-41d4-a716-446655440050'
    WHEN 42 THEN '550e8400-e29b-41d4-a716-446655440051'
    WHEN 43 THEN '550e8400-e29b-41d4-a716-446655440052'
    WHEN 44 THEN '550e8400-e29b-41d4-a716-446655440053'
    WHEN 45 THEN '550e8400-e29b-41d4-a716-446655440054'
    WHEN 46 THEN '550e8400-e29b-41d4-a716-446655440055'
    WHEN 47 THEN '550e8400-e29b-41d4-a716-446655440056'
    WHEN 48 THEN '550e8400-e29b-41d4-a716-446655440057'
    ELSE '550e8400-e29b-41d4-a716-446655440058'
  END,
  t.receipt_id,
  LPAD(t.receipt_id::text, 10, '0'),
  t.id,
  'TXN-' || t.tx_no::text,
  t.tx_no,
  3,
  CASE (row_number() OVER (ORDER BY t.id) % 5)
    WHEN 0 THEN 'Blk 454 lot23, Malita, Davao Occidental'
    WHEN 1 THEN 'Pickup at Branch 3, Quezon Avenue, Quezon City'
    WHEN 2 THEN 'Manila city, Jabonga, Agusan Del Norte'
    WHEN 3 THEN 'Miilionaires Village, Manila City, Metro Manila'
    ELSE 'Quezon city greenfields, Quezon City, Metro Manila'
  END,
  CASE (row_number() OVER (ORDER BY t.id) % 4)
    WHEN 0 THEN 'Cash on Delivery'
    WHEN 1 THEN 'Maya'
    WHEN 2 THEN 'GCash'
    ELSE 'Credit / Debit Card'
  END,
  CASE WHEN random() < 0.85 THEN 'paid' ELSE 'pending' END,
  CASE (row_number() OVER (ORDER BY t.id) % 5)
    WHEN 0 THEN 'Processing'
    WHEN 1 THEN 'In Transit'
    WHEN 2 THEN 'Delivered'
    WHEN 3 THEN 'Cancelled'
    ELSE 'Processing'
  END,
  CASE WHEN random() < 0.6 THEN 'scheduled' ELSE 'claim_at_branch' END,
  ROUND((RANDOM() * 400 + 50)::numeric, 2),
  ROUND((RANDOM() * 200 + 50)::numeric, 2),
  CASE WHEN random() < 0.2 THEN ROUND((RANDOM() * 50)::numeric, 2) ELSE 0 END,
  ROUND((RANDOM() * 600 + 100)::numeric, 2),
  '{"source":"web-checkout"}'::jsonb,
  t.created_at,
  true
FROM (
  SELECT id, tx_no, receipt_id, created_at FROM transactions
  WHERE receipt_id IS NOT NULL
    AND cashier_name = 'Ecommerce'
    AND is_seed_test = true
    AND id NOT IN (SELECT transaction_id FROM online_orders WHERE transaction_id IS NOT NULL)
  ORDER BY id LIMIT 800
) t;

-- Step 6: Insert ~1600 test online_order_items
INSERT INTO online_order_items (online_order_id, product_id, product_name, category, unit_price, quantity, line_total, created_at, is_seed_test)
SELECT oo_id, product_id, product_name, category, unit_price, quantity, ROUND((quantity * unit_price)::numeric, 2), oo_created_at, true
FROM (
  SELECT
    oo.id AS oo_id,
    oo.created_at AS oo_created_at,
    ((row_number() OVER () % 37) + 1)::text AS product_id,
    CASE (row_number() OVER () % 37)
      WHEN 1 THEN 'Acetaminophen 500mg' WHEN 2 THEN 'Ibuprofen 200mg' WHEN 3 THEN 'Aspirin 8mg'
      WHEN 4 THEN 'Allergy Relief (Loratadine)' WHEN 5 THEN 'Cough Syrup' WHEN 6 THEN 'Antacid Tablets'
      WHEN 7 THEN 'Cold & Flu Relief' WHEN 8 THEN 'Multivitamin Daily' WHEN 9 THEN 'Vitamin D3 2000 IU'
      WHEN 10 THEN 'Vitamin C 1000mg' WHEN 11 THEN 'Omega-3 Fish Oil' WHEN 12 THEN 'Calcium + Vitamin D'
      WHEN 13 THEN 'Probiotic Complex' WHEN 14 THEN 'Hand Sanitizer 8oz' WHEN 15 THEN 'Toothpaste Whitening'
      WHEN 16 THEN 'Mouthwash Antiseptic' WHEN 17 THEN 'Dental Floss' WHEN 18 THEN 'Body Lotion 16oz'
      WHEN 19 THEN 'Sunscreen SPF 50' WHEN 20 THEN 'Shampoo & Conditioner' WHEN 21 THEN 'Adhesive Bandages (100ct)'
      WHEN 22 THEN 'Gauze Pads Sterile' WHEN 23 THEN 'Medical Tape' WHEN 24 THEN 'Antiseptic Wipes (50ct)'
      WHEN 25 THEN 'First Aid Kit' WHEN 26 THEN 'Thermometer Digital' WHEN 27 THEN 'Blood Pressure Monitor'
      WHEN 28 THEN 'Glucose Test Strips (50ct)' WHEN 29 THEN 'Heating Pad Electric' WHEN 30 THEN 'Compression Socks'
      WHEN 31 THEN 'Sleep Aid Tablets' WHEN 32 THEN 'Eye Drops Lubricating' WHEN 33 THEN 'Baby Diapers (Size 3)'
      WHEN 34 THEN 'Baby Wipes (80ct)' WHEN 35 THEN 'Baby Lotion 16oz' WHEN 36 THEN 'Baby Powder'
      ELSE 'Diaper Rash Cream'
    END AS product_name,
    CASE (row_number() OVER () % 37)
      WHEN 1 THEN 'OTC Medications' WHEN 2 THEN 'OTC Medications' WHEN 3 THEN 'OTC Medications'
      WHEN 4 THEN 'OTC Medications' WHEN 5 THEN 'OTC Medications' WHEN 6 THEN 'OTC Medications'
      WHEN 7 THEN 'OTC Medications' WHEN 8 THEN 'Vitamins & Supplements' WHEN 9 THEN 'Vitamins & Supplements'
      WHEN 10 THEN 'Vitamins & Supplements' WHEN 11 THEN 'Vitamins & Supplements' WHEN 12 THEN 'Vitamins & Supplements'
      WHEN 13 THEN 'Vitamins & Supplements' WHEN 14 THEN 'Personal Care' WHEN 15 THEN 'Personal Care'
      WHEN 16 THEN 'Personal Care' WHEN 17 THEN 'Personal Care' WHEN 18 THEN 'Personal Care'
      WHEN 19 THEN 'Personal Care' WHEN 20 THEN 'Personal Care' WHEN 21 THEN 'First Aid'
      WHEN 22 THEN 'First Aid' WHEN 23 THEN 'First Aid' WHEN 24 THEN 'First Aid'
      WHEN 25 THEN 'First Aid' WHEN 26 THEN 'First Aid' WHEN 27 THEN 'Health & Wellness'
      WHEN 28 THEN 'Health & Wellness' WHEN 29 THEN 'Health & Wellness' WHEN 30 THEN 'Health & Wellness'
      WHEN 31 THEN 'Health & Wellness' WHEN 32 THEN 'Health & Wellness' WHEN 33 THEN 'Baby Care'
      WHEN 34 THEN 'Baby Care' WHEN 35 THEN 'Baby Care' WHEN 36 THEN 'Baby Care'
      ELSE 'Baby Care'
    END AS category,
    CASE (row_number() OVER () % 37)
      WHEN 1 THEN 8.99 WHEN 2 THEN 9.49 WHEN 3 THEN 7.99 WHEN 4 THEN 12.99 WHEN 5 THEN 10.99
      WHEN 6 THEN 8.49 WHEN 7 THEN 11.99 WHEN 8 THEN 15.99 WHEN 9 THEN 12.99 WHEN 10 THEN 13.49
      WHEN 11 THEN 18.99 WHEN 12 THEN 14.99 WHEN 13 THEN 24.99 WHEN 14 THEN 5.99 WHEN 15 THEN 6.49
      WHEN 16 THEN 7.99 WHEN 17 THEN 3.99 WHEN 18 THEN 9.99 WHEN 19 THEN 12.99 WHEN 20 THEN 11.99
      WHEN 21 THEN 6.99 WHEN 22 THEN 8.49 WHEN 23 THEN 4.99 WHEN 24 THEN 7.49 WHEN 25 THEN 24.99
      WHEN 26 THEN 12.99 WHEN 27 THEN 49.99 WHEN 28 THEN 32.99 WHEN 29 THEN 29.99 WHEN 30 THEN 16.99
      WHEN 31 THEN 14.99 WHEN 32 THEN 9.99 WHEN 33 THEN 24.99 WHEN 34 THEN 6.99 WHEN 35 THEN 8.99
      WHEN 36 THEN 5.99 ELSE 7.99
    END::numeric AS unit_price,
    (RANDOM() * 5 + 1)::int AS quantity
  FROM (
    SELECT id, created_at FROM online_orders
    WHERE is_seed_test = true
      AND id NOT IN (SELECT DISTINCT online_order_id FROM online_order_items WHERE online_order_id IS NOT NULL)
  ) oo
  CROSS JOIN LATERAL generate_series(1, GREATEST(1, (RANDOM() * 4)::int))
  LIMIT 1600
) sub;

-- Step 7: Insert 80 test return_requests
INSERT INTO return_requests (online_order_id, customer_id, receipt_number, reason, description, items, status, created_at, is_seed_test)
SELECT
  oo.id,
  oo.customer_id,
  oo.receipt_number,
  CASE (ROW_NUMBER() OVER (ORDER BY oo.id) % 5)
    WHEN 0 THEN 'Damaged item'
    WHEN 1 THEN 'Wrong product'
    WHEN 2 THEN 'Expired'
    WHEN 3 THEN 'Defective'
    ELSE 'Not as described'
  END,
  'Test return request',
  '[{"product_id": "1", "quantity": 1}]'::jsonb,
  CASE WHEN random() < 0.6 THEN 'approved' WHEN random() < 0.8 THEN 'pending' ELSE 'rejected' END,
  oo.created_at + (INTERVAL '1 day' * (random() * 7)::int),
  true
FROM (
  SELECT id, customer_id, receipt_number, created_at, ROW_NUMBER() OVER (ORDER BY id) as rn
  FROM online_orders
  WHERE is_seed_test = true
    AND id NOT IN (SELECT online_order_id FROM return_requests WHERE online_order_id IS NOT NULL)
) oo
WHERE oo.rn <= 80;

-- Step 8: Reset receipt_id sequence to avoid conflicts with the POS system
SELECT setval(pg_get_serial_sequence('receipts', 'receipt_id'), (SELECT MAX(receipt_id) FROM receipts));
