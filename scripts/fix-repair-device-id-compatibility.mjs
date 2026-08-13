import fs from 'node:fs';
import path from 'node:path';

const filePath = path.resolve('src/components/RepairCenter.tsx');
let source = fs.readFileSync(filePath, 'utf8');

// Resolve repair-order DT/DM database IDs against the live device registry.
source = source.replace(
  'import { db } from "../lib/data";',
  'import { db, getDeviceTypesSync, getDeviceModelsSync } from "../lib/data";'
);

const fnStart = source.indexOf('export function isProductCompatibleWithDevice(');
const fnEnd = source.indexOf('\n\ninterface RepairCenterProps', fnStart);
if (fnStart === -1 || fnEnd === -1) {
  throw new Error('Could not locate isProductCompatibleWithDevice in RepairCenter.tsx');
}

const replacementFn = `export function isProductCompatibleWithDevice(product: Product, deviceType?: string, deviceModel?: string): boolean {
  if (!product) return false;

  const compTypes = (product.compatibleDeviceTypes || []).map(v => String(v).trim().toLowerCase()).filter(Boolean);
  const compModels = (product.compatibleModels || []).map(v => String(v).trim().toLowerCase()).filter(Boolean);

  // Untagged stock must never appear as compatible with every repair device.
  if (compTypes.length === 0 && compModels.length === 0) return false;

  const rawType = String(deviceType || '').trim();
  const rawModel = String(deviceModel || '').trim();
  const deviceTypes = getDeviceTypesSync();
  const deviceModels = getDeviceModelsSync();

  const resolvedType = deviceTypes.find(t =>
    String(t.id) === rawType || t.nameAr === rawType || t.nameEn === rawType
  );
  const resolvedModel = deviceModels.find(m =>
    String(m.id) === rawModel || m.nameAr === rawModel || m.nameEn === rawModel || m.modelCode === rawModel
  );

  const typeCandidates = [
    rawType,
    resolvedType?.id || '',
    resolvedType?.nameAr || '',
    resolvedType?.nameEn || ''
  ].map(v => String(v).trim().toLowerCase()).filter(Boolean);

  const modelCandidates = [
    rawModel,
    resolvedModel?.id || '',
    resolvedModel?.nameAr || '',
    resolvedModel?.nameEn || '',
    resolvedModel?.modelCode || ''
  ].map(v => String(v).trim().toLowerCase()).filter(Boolean);

  const overlaps = (saved: string, candidates: string[]) =>
    candidates.some(candidate => saved === candidate || saved.includes(candidate) || candidate.includes(saved));

  const typeMatch = compTypes.some(saved => overlaps(saved, typeCandidates));
  const modelMatch = compModels.some(saved => overlaps(saved, modelCandidates));

  // Model-specific compatibility is stricter than device-type compatibility.
  if (compModels.length > 0) return modelMatch;
  return typeMatch;
}`;

source = source.slice(0, fnStart) + replacementFn + source.slice(fnEnd);

// Workshop quick-add/search must never fall back to all inventory.
source = source.replace(
  '                const baseListToSearch = (compatibleInventory.length > 0 ? compatibleInventory : availableInventory);',
  '                const baseListToSearch = compatibleInventory;'
);

fs.writeFileSync(filePath, source, 'utf8');
console.log('Repair compatibility patched: DT/DM IDs resolve to inventory names and no all-stock fallback is allowed.');
