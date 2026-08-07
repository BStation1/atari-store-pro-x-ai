import { RepairPartUsage, Product, QUICK_FAULTS_LIST } from '../types';

export function getUsageSellingUnitPrice(pu: RepairPartUsage, productsList: Product[]): number {
  if (pu.sellingPrice !== undefined && pu.sellingPrice !== null) {
    return Number(pu.sellingPrice);
  }
  const prod = productsList.find(p =>
    p.id === pu.inventoryItemId ||
    (p as any).uuid === pu.inventoryItemId ||
    p.sku === pu.sku ||
    (p.nameAr || p.name) === pu.partName
  );
  if (prod && prod.sellPrice !== undefined && prod.sellPrice !== null) {
    return Number(prod.sellPrice);
  }
  return pu.unitCost ?? 0;
}

export function calculateSuggestedPriceForFaults(faultLabels: string[]): number {
  if (!faultLabels || faultLabels.length === 0) return 0;
  return faultLabels.reduce((sum, label) => {
    const item = QUICK_FAULTS_LIST.find(f => f.label === label);
    return sum + (item ? item.defaultSellingPrice : 0);
  }, 0);
}
