-- ============================================================================
-- Migration: Add quick faults & repair pricing fields to repair_orders
-- Description: Adds selected_quick_faults, suggested_repair_price, and final_repair_price
-- to public.repair_orders with backward-compatible defaults.
-- ============================================================================

ALTER TABLE public.repair_orders 
ADD COLUMN IF NOT EXISTS selected_quick_faults TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS suggested_repair_price NUMERIC(12, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS final_repair_price NUMERIC(12, 2) DEFAULT 0.00;
