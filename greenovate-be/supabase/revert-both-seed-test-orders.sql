-- revert-both-seed-test-orders.sql
-- Reverts ALL test seed data across all 3 seed files
-- Safe: only deletes rows where is_seed_test = true, never touches real data
-- Run in Order Supabase SQL Editor

-- Step 1: Delete test return_requests
DELETE FROM return_requests WHERE is_seed_test = true;

-- Step 2: Delete test online_order_items
DELETE FROM online_order_items WHERE is_seed_test = true;

-- Step 3: Delete test online_orders
DELETE FROM online_orders WHERE is_seed_test = true;

-- Step 4: Delete test transaction_items
DELETE FROM transaction_items WHERE is_seed_test = true;

-- Step 5: Save receipt_ids before clearing (while transactions still exist)
CREATE TEMP TABLE receipts_to_delete AS
SELECT receipt_id FROM transactions WHERE is_seed_test = true AND receipt_id IS NOT NULL;

-- Step 6: Clear receipt_id FK from test transactions
UPDATE transactions SET receipt_id = NULL WHERE is_seed_test = true;

-- Step 7: Delete test transactions
DELETE FROM transactions WHERE is_seed_test = true;

-- Step 8: Delete test receipts
DELETE FROM receipts WHERE is_seed_test = true;

-- Cleanup
DROP TABLE receipts_to_delete;
