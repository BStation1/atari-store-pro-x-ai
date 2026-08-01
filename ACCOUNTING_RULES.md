# Atari Store Pro X AI — Official Accounting Rules

Version: 2.0  
Status: Frozen business specification

## Single source of truth

All profit, partner-share, settlement, and purchase-cost values must come from `accountingEngineV2.ts`.
UI components must display engine results and must not implement their own profit-sharing formulas.

## Purchase cost priority

1. Physical outgoing `inventory_movements` purchase-cost snapshots.
2. Active `repair_part_usages` purchase-cost snapshots.
3. Explicit device-level purchase-cost fields.
4. Legacy `devices[].partsCost` only when no linked movement or usage exists.

Selling prices must never be used as purchase cost.
A physical withdrawal must be counted once only.

## Work types

### Shop work

- Net profit = Revenue − Purchase cost
- Ahmed = 50% of net profit
- Abdo = 50% of net profit

### Ahmed private work

- Net profit = Revenue − Purchase cost
- Ahmed = 100% of net profit
- Abdo = 0

### Abdo private work

- Net profit = Revenue − Purchase cost
- Ahmed = 25% of net profit
- Abdo = 75% of net profit
- Amount due from Abdo to Ahmed = Ahmed's 25% share only

## Frozen examples

| Work | Revenue | Purchase cost | Net profit | Ahmed | Abdo | Due from Abdo |
|---|---:|---:|---:|---:|---:|---:|
| Shop | 2,000 | 300 | 1,700 | 850 | 850 | 0 |
| Ahmed | 4,000 | 400 | 3,600 | 3,600 | 0 | 0 |
| Abdo | 6,000 | 600 | 5,400 | 1,350 | 4,050 | 1,350 |
