import fs from 'node:fs';
import path from 'node:path';

const filePath = path.resolve('src/components/RepairCenter.tsx');
let source = fs.readFileSync(filePath, 'utf8');

source = source.replace(
  'useRepairOrders, useCustomers, useProducts, useSettings, useInvoices, useCurrentUser, useRepairPartUsages',
  'useRepairOrders, useCustomers, useProducts, useSettings, useInvoices, useCurrentUser, useRepairPartUsages, useDeviceTypes, useDeviceModels'
);

source = source.replace(
  '  const { products, updateProduct, setProductLocal } = useProducts();\n  const { settings } = useSettings();',
  '  const { products, updateProduct, setProductLocal } = useProducts();\n  const { deviceTypes } = useDeviceTypes();\n  const { deviceModels } = useDeviceModels();\n  const { settings } = useSettings();'
);

const oldBlock = `                const query = partSearch.trim().toLowerCase();
                const availableInventory = products.filter(p => !p.isArchived);
                const compatibleInventory = availableInventory.filter(p => isProductCompatibleWithDevice(p, currentDevice.type, currentDevice.model));
                const baseListToSearch = (compatibleInventory.length > 0 ? compatibleInventory : availableInventory);`;

const alreadyPatchedBlock = `                const query = partSearch.trim().toLowerCase();
                const availableInventory = products.filter(p => !p.isArchived);
                const compatibleInventory = availableInventory.filter(p => isProductCompatibleWithDevice(p, currentDevice.type, currentDevice.model));
                // Never fall back to the whole inventory when this device has no matches.
                // Quick-add and search inside a repair order must stay device-specific.
                const baseListToSearch = compatibleInventory;`;

const newBlock = `                const query = partSearch.trim().toLowerCase();
                const availableInventory = products.filter(p => !p.isArchived);

                // Repair orders store the database IDs (DT-... / DM-...), while inventory
                // compatibility is intentionally saved using the Arabic/English display names.
                // Resolve both IDs to their names before matching so PS5 parts do not leak
                // into controllers, and valid PS5 parts do not disappear.
                const resolvedType = deviceTypes.find(t =>
                  t.id === String(currentDevice.type) ||
                  t.nameAr === String(currentDevice.type) ||
                  t.nameEn === String(currentDevice.type)
                );
                const resolvedModel = deviceModels.find(m =>
                  m.id === String(currentDevice.model) ||
                  m.nameAr === String(currentDevice.model) ||
                  m.nameEn === String(currentDevice.model)
                );

                const typeCandidates = [
                  String(currentDevice.type || ''),
                  resolvedType?.id || '',
                  resolvedType?.nameAr || '',
                  resolvedType?.nameEn || ''
                ].map(v => v.trim().toLowerCase()).filter(Boolean);

                const modelCandidates = [
                  String(currentDevice.model || ''),
                  resolvedModel?.id || '',
                  resolvedModel?.nameAr || '',
                  resolvedModel?.nameEn || '',
                  resolvedModel?.modelCode || ''
                ].map(v => v.trim().toLowerCase()).filter(Boolean);

                const compatibleInventory = availableInventory.filter(p => {
                  const compTypes = (p.compatibleDeviceTypes || []).map(v => String(v).trim().toLowerCase()).filter(Boolean);
                  const compModels = (p.compatibleModels || []).map(v => String(v).trim().toLowerCase()).filter(Boolean);

                  // Do not treat untagged stock as compatible with every repair device.
                  if (compTypes.length === 0 && compModels.length === 0) return false;

                  const typeMatch = compTypes.some(saved =>
                    typeCandidates.some(candidate => saved === candidate || saved.includes(candidate) || candidate.includes(saved))
                  );
                  const modelMatch = compModels.some(saved =>
                    modelCandidates.some(candidate => saved === candidate || saved.includes(candidate) || candidate.includes(saved))
                  );

                  // When a product has model-specific tags, model wins. Otherwise type is enough.
                  if (compModels.length > 0) return modelMatch;
                  return typeMatch;
                });

                // Never fall back to the entire inventory: the workshop list is device-specific.
                const baseListToSearch = compatibleInventory;`;

if (source.includes(oldBlock)) {
  source = source.replace(oldBlock, newBlock);
} else if (source.includes(alreadyPatchedBlock)) {
  source = source.replace(alreadyPatchedBlock, newBlock);
} else if (!source.includes('const typeCandidates = [')) {
  throw new Error('RepairCenter compatible inventory block was not found');
}

fs.writeFileSync(filePath, source, 'utf8');
console.log('RepairCenter compatibility now resolves DT/DM ids to inventory compatibility names.');
