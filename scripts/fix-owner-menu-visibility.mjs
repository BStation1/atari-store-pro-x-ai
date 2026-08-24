import fs from 'node:fs';

const path = 'src/App.tsx';
let src = fs.readFileSync(path, 'utf8');

const oldBlock = `  const allowedMenuItems = allMenuItems.filter(item => {\n    if (item.id === \"tracking\") return true;\n    if (!currentLoggedUser) return false;\n    const reqPerm = getViewRequiredPermission(item.id);\n    return !reqPerm || hasPermission(currentLoggedUser.roleId, currentLoggedUser.permissions, reqPerm);\n  });`;

const newBlock = `  // OWNER_MENU_VISIBILITY_GUARD\n  // The system owner must never lose access to core modules because of a stale or\n  // partially-synced permissions array. Explicitly bypass menu filtering for OWNER.\n  const normalizedRole = String(currentLoggedUser?.roleId || currentLoggedUser?.role || \"\").toUpperCase();\n  const isOwnerMenuUser = normalizedRole === \"OWNER\" || normalizedRole === \"ADMIN\";\n\n  const allowedMenuItems = isOwnerMenuUser ? allMenuItems : allMenuItems.filter(item => {\n    if (item.id === \"tracking\") return true;\n    if (!currentLoggedUser) return false;\n    const reqPerm = getViewRequiredPermission(item.id);\n    return !reqPerm || hasPermission(currentLoggedUser.roleId, currentLoggedUser.permissions, reqPerm);\n  });`;

if (!src.includes('OWNER_MENU_VISIBILITY_GUARD')) {
  if (!src.includes(oldBlock)) throw new Error('Owner menu visibility patch: target block not found');
  src = src.replace(oldBlock, newBlock);
  fs.writeFileSync(path, src);
}

console.log('✓ OWNER core menu visibility guard enabled');
