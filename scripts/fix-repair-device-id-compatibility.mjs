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

// Multi-device repair orders: keep an independent active device inside the workshop.
const workspaceStateNeedle = '  const [workspaceTab, setWorkspaceTab] = useState<"workshop" | "timeline" | "audit">("workshop");';
if (source.includes(workspaceStateNeedle) && !source.includes('const [activeDeviceIdx, setActiveDeviceIdx]')) {
  source = source.replace(
    workspaceStateNeedle,
    `${workspaceStateNeedle}\n  const [activeDeviceIdx, setActiveDeviceIdx] = useState<number>(0);\n\n  useEffect(() => {\n    setActiveDeviceIdx(prev => {\n      const count = selectedOrder?.devices?.length || 0;\n      return count > 0 && prev < count ? prev : 0;\n    });\n  }, [selectedOrder?.id, selectedOrder?.devices?.length]);`
  );
}

// Always open a newly selected order on its first device.
source = source.replace(
  '                    setSelectedOrder(order);\n                    setWorkspaceTab("workshop");',
  '                    setSelectedOrder(order);\n                    setActiveDeviceIdx(0);\n                    setWorkspaceTab("workshop");'
);

// Replace the old hard-coded first-device workshop binding.
source = source.replace(
  `                const currentDevice = selectedOrder.devices[0] || { type: 'PlayStation', model: 'PS5', issue: '' };\n                const devIdx = 0;`,
  `                const safeDeviceIdx = Math.min(activeDeviceIdx, Math.max(0, selectedOrder.devices.length - 1));\n                const currentDevice = selectedOrder.devices[safeDeviceIdx] || { type: 'PlayStation', model: 'PS5', issue: '' };\n                const devIdx = safeDeviceIdx;`
);

// Show one tab/button for every received device/controller inside the order.
const workshopReturnNeedle = `                  <div className="space-y-4 font-sans text-right">\n                    {/* -----------------------------------------\n                        SECTION 1: COMPACT HEADER CARD`;
if (source.includes(workshopReturnNeedle) && !source.includes('اختيار الجهاز داخل أمر الصيانة')) {
  source = source.replace(
    workshopReturnNeedle,
    `                  <div className="space-y-4 font-sans text-right">\n                    {selectedOrder.devices.length > 1 && (\n                      <div className="bg-[#11131e] border border-[#2a2d42] rounded-xl p-2.5">\n                        <div className="flex items-center gap-2 mb-2 text-xs font-bold text-gray-300">\n                          <Gamepad2 className="w-4 h-4 text-indigo-400" />\n                          <span>اختيار الجهاز داخل أمر الصيانة ({selectedOrder.devices.length})</span>\n                        </div>\n                        <div className="flex flex-wrap gap-2">\n                          {selectedOrder.devices.map((device, index) => (\n                            <button\n                              key={device.id || index}\n                              type="button"\n                              onClick={() => {\n                                setActiveDeviceIdx(index);\n                                setAddPartDevIdx(index);\n                                setPartSearch("");\n                              }}\n                              className={\`px-3 py-2 rounded-lg border text-xs font-bold transition-all cursor-pointer \${\n                                index === safeDeviceIdx\n                                  ? "bg-indigo-600 border-indigo-400 text-white shadow-md shadow-indigo-950/40"\n                                  : "bg-gray-950 border-[#2a2d42] text-gray-300 hover:border-indigo-500/50 hover:text-white"\n                              }\`}\n                            >\n                              <span className="text-indigo-300 ml-1">#{index + 1}</span>\n                              {getDeviceDisplayName(device)}\n                            </button>\n                          ))}\n                        </div>\n                      </div>\n                    )}\n\n                    {/* -----------------------------------------\n                        SECTION 1: COMPACT HEADER CARD`
  );
}

fs.writeFileSync(filePath, source, 'utf8');
console.log('Repair workshop patched: compatibility fixed and multi-device orders can switch between every received device.');
