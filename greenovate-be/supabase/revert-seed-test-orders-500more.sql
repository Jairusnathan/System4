-- revert-seed-test-orders-500more.sql
-- Revert all test data inserted by seed-test-orders-500more.sql
-- Run this in Order Supabase SQL Editor to clean up the 500 additional orders

-- Step 1: Delete return_requests linked to additional test online_orders
DELETE FROM return_requests
WHERE online_order_id IN (
  SELECT id FROM online_orders WHERE order_number LIKE 'TXN-6%' AND CAST(SUBSTRING(order_number, 5) AS INTEGER) >= 60251
);

-- Step 2: Delete online_order_items for additional orders
DELETE FROM online_order_items
WHERE online_order_id IN (
  SELECT id FROM online_orders WHERE order_number LIKE 'TXN-6%' AND CAST(SUBSTRING(order_number, 5) AS INTEGER) >= 60251
);

-- Step 3: Delete additional online_orders
DELETE FROM online_orders
WHERE order_number LIKE 'TXN-6%' AND CAST(SUBSTRING(order_number, 5) AS INTEGER) >= 60251;

-- Step 4: Delete additional transaction_items
DELETE FROM transaction_items
WHERE transaction_id IN (
  SELECT id FROM transactions WHERE cashier_name = 'Ecommerce' AND tx_no >= 60251
);

-- Step 5: Clear receipt_id from additional transactions
UPDATE transactions
SET receipt_id = NULL
WHERE cashier_name = 'Ecommerce' AND tx_no >= 60251;

-- Step 6: Delete additional transactions
DELETE FROM transactions
WHERE cashier_name = 'Ecommerce' AND tx_no >= 60251;

-- Step 7: Delete additional receipts
DELETE FROM receipts
WHERE receipt_id >= 17450;
