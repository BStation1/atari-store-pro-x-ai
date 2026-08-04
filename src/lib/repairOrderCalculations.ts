import { RepairPartUsage, Product, QUICK_FAULTS_LIST } from '../types';

export function getUsageSellingUnitPrice(pu: RepairPartUsage, productsList: Product[]): number {
  if (pu.sellingPrice && pu.sellingPrice > 0) return pu.sellingPrice;
  const prod = productsList.find(p => p.id === pu.inventoryItemId);
  if (prod && prod.sellPrice && prod.sellPrice > 0) return prod.sellPrice;
  return pu.unitCost || 0;
}

export function calculateSuggestedPriceForFaults(faultLabels: string[]): number {
  if (!faultLabels || faultLabels.length === 0) return 0;
  return faultLabels.reduce((sum, label) => {
    const item = QUICK_FAULTS_LIST.find(f => f.label === label);
    return sum + (item ? (item.defaultSellingPrice ?? 0) : 0);
  }, 0);
}

