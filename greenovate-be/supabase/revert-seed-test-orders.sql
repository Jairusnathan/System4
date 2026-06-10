-- revert-seed-test-orders.sql
-- Revert all test data inserted by seed-test-orders.sql
-- Run this in Order Supabase SQL Editor to clean up

-- Step 1: Delete return_requests linked to test online_orders
DELETE FROM return_requests
WHERE online_order_id IN (
  SELECT id FROM online_orders WHERE order_number LIKE 'TXN-6%'
);

-- Step 2: Delete online_order_items
DELETE FROM online_order_items
WHERE online_order_id IN (
  SELECT id FROM online_orders WHERE order_number LIKE 'TXN-6%'
);

-- Step 3: Delete online_orders
DELETE FROM online_orders
WHERE order_number LIKE 'TXN-6%';

-- Step 4: Delete transaction_items
DELETE FROM transaction_items
WHERE transaction_id IN (
  SELECT id FROM transactions WHERE cashier_name = 'Ecommerce' AND tx_no >= 60001
);

-- Step 5: Clear receipt_id from transactions
UPDATE transactions
SET receipt_id = NULL
WHERE cashier_name = 'Ecommerce' AND tx_no >= 60001;

-- Step 6: Delete transactions
DELETE FROM transactions
WHERE cashier_name = 'Ecommerce' AND tx_no >= 60001;

-- Step 7: Delete receipts
DELETE FROM receipts
WHERE receipt_id >= 17200;
