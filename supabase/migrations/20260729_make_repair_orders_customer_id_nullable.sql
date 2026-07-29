-- Migration: Support Guest Repair Orders by removing NOT NULL constraint from customer_id
-- Version: 20260729

ALTER TABLE public.repair_orders 
ALTER COLUMN customer_id DROP NOT NULL;
