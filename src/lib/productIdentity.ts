import type { Product, RepairPartUsage } from '../types';

const normalize = (value: unknown): string => String(value ?? '').trim().toLowerCase();

export function productMatchesRepairUsage(product: Product, usage: RepairPartUsage): boolean {
  const usageItemId = normalize(usage.inventoryItemId);
  const usageSku = normalize(usage.sku);
  const productId = normalize(product.id);
  const productUuid = normalize((product as Product & { uuid?: string }).uuid);
  const productSku = normalize(product.sku);

  return Boolean(
    (usageItemId && (usageItemId === productId || usageItemId === productUuid)) ||
    (usageSku && productSku && usageSku === productSku)
  );
}

export function findProductForRepairUsage(
  products: Product[],
  usage: RepairPartUsage
): Product | undefined {
  return products.find(product => productMatchesRepairUsage(product, usage));
}
