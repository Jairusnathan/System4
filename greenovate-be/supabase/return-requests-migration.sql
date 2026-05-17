-- Run this in your ORDER-SERVICE Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.return_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  online_order_id uuid REFERENCES public.online_orders(id) ON DELETE SET NULL,
  customer_id     text NOT NULL,
  receipt_number  text NOT NULL,
  reason          text NOT NULL,
  description     text,
  items           jsonb NOT NULL DEFAULT '[]'::jsonb,
  status          text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewing', 'approved', 'rejected', 'completed')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS return_requests_customer_id_idx ON public.return_requests (customer_id);
CREATE INDEX IF NOT EXISTS return_requests_receipt_number_idx ON public.return_requests (receipt_number);
CREATE INDEX IF NOT EXISTS return_requests_status_idx ON public.return_requests (status);
