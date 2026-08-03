-- Preserve the removed rows in a private recovery table, retain the oldest
-- opening balance per product, and prevent concurrent clients from recreating
-- duplicates.

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.inventory_opening_balance_duplicates_backup_20260804
AS
SELECT *
FROM public.inventory_movements
WHERE false;

REVOKE ALL ON private.inventory_opening_balance_duplicates_backup_20260804
FROM PUBLIC, anon, authenticated;

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY product_id
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM public.inventory_movements
  WHERE reference_id = 'OPENING_BALANCE'
)
INSERT INTO private.inventory_opening_balance_duplicates_backup_20260804
SELECT movement.*
FROM public.inventory_movements movement
JOIN ranked ON ranked.id = movement.id
WHERE ranked.rn > 1;

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY product_id
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM public.inventory_movements
  WHERE reference_id = 'OPENING_BALANCE'
)
DELETE FROM public.inventory_movements movement
USING ranked
WHERE movement.id = ranked.id
  AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_movements_one_opening_balance_per_product
ON public.inventory_movements(product_id)
WHERE reference_id = 'OPENING_BALANCE';

COMMENT ON TABLE private.inventory_opening_balance_duplicates_backup_20260804 IS
'Recoverable backup of duplicate OPENING_BALANCE rows removed on 2026-08-04.';
