import fs from 'node:fs';
import path from 'node:path';

const filePath = path.resolve('src/components/RepairCenter.tsx');
let source = fs.readFileSync(filePath, 'utf8');

const universalOld = `  if (compTypes.length === 0 && compModels.length === 0) {
    return true; // Universal part if no restrictions
  }`;
const universalNew = `  if (compTypes.length === 0 && compModels.length === 0) {
    // Untagged products must not appear as compatible with every repair device.
    // A product has to be explicitly linked to a device type/model in Inventory.
    return false;
  }`;

const fallbackOld = `                const baseListToSearch = (compatibleInventory.length > 0 ? compatibleInventory : availableInventory);`;
const fallbackNew = `                // Never fall back to the whole inventory when this device has no matches.
                // Quick-add and search inside a repair order must stay device-specific.
                const baseListToSearch = compatibleInventory;`;

let changed = false;

if (source.includes(universalOld)) {
  source = source.replace(universalOld, universalNew);
  changed = true;
} else if (!source.includes(universalNew)) {
  throw new Error('Could not find compatibility default block in RepairCenter.tsx');
}

if (source.includes(fallbackOld)) {
  source = source.replace(fallbackOld, fallbackNew);
  changed = true;
} else if (!source.includes(fallbackNew)) {
  throw new Error('Could not find inventory fallback block in RepairCenter.tsx');
}

if (changed) {
  fs.writeFileSync(filePath, source, 'utf8');
  console.log('Repair part compatibility fixed: only explicitly compatible products are shown per device.');
} else {
  console.log('Repair part compatibility patch already applied.');
}
