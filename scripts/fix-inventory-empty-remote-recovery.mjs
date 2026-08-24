import fs from 'node:fs';

function replaceOnce(src, from, to, label) {
  if (src.includes(to)) return src;
  if (!src.includes(from)) throw new Error(`Inventory recovery patch failed: ${label}`);
  return src.replace(from, to);
}

const path = 'src/lib/supabaseProducts.ts';
let src = fs.readFileSync(path, 'utf8');

if (!src.includes('INVENTORY_EMPTY_REMOTE_RECOVERY_V1')) {
  src = replaceOnce(
    src,
    "const PRODUCTS_STORAGE_KEY = 'atari_products';\nconst CATEGORIES_STORAGE_KEY = 'atari_categories';",
    "const PRODUCTS_STORAGE_KEY = 'atari_products';\nconst PRODUCTS_RECOVERY_KEY = 'atari_products_recovery_v1';\nconst CATEGORIES_STORAGE_KEY = 'atari_categories';\n\n// INVENTORY_EMPTY_REMOTE_RECOVERY_V1\nfunction isProductLikeArray(value: unknown): value is Product[] {\n  return Array.isArray(value) && value.length > 0 && value.every((item: any) =>\n    item && typeof item === 'object' && typeof item.name === 'string' &&\n    ('quantity' in item || 'sellPrice' in item || 'purchasePrice' in item || 'sku' in item)\n  );\n}\n\nfunction findLegacyProductsBackup(): Product[] {\n  if (typeof localStorage === 'undefined') return [];\n  let best: Product[] = [];\n  try {\n    for (let i = 0; i < localStorage.length; i++) {\n      const key = localStorage.key(i);\n      if (!key || key === PRODUCTS_STORAGE_KEY || key === PRODUCTS_RECOVERY_KEY) continue;\n      const normalized = key.toLowerCase();\n      if (!/(product|inventory|stock|backup)/.test(normalized)) continue;\n      const raw = localStorage.getItem(key);\n      if (!raw) continue;\n      try {\n        const parsed = JSON.parse(raw);\n        if (isProductLikeArray(parsed) && parsed.length > best.length) best = parsed;\n        else if (parsed && typeof parsed === 'object') {\n          const candidates = [(parsed as any).products, (parsed as any).inventory, (parsed as any).stock];\n          for (const candidate of candidates) {\n            if (isProductLikeArray(candidate) && candidate.length > best.length) best = candidate;\n          }\n        }\n      } catch {}\n    }\n  } catch (e) {\n    console.warn('Could not scan legacy product backups:', e);\n  }\n  return best;\n}",
    'recovery helpers'
  );

  src = replaceOnce(
    src,
    "      const stored = localStorage.getItem(PRODUCTS_STORAGE_KEY);\n      if (stored) return JSON.parse(stored);",
    "      const stored = localStorage.getItem(PRODUCTS_STORAGE_KEY);\n      if (stored) {\n        const parsed = JSON.parse(stored);\n        if (isProductLikeArray(parsed)) return parsed;\n      }\n\n      const recoveryRaw = localStorage.getItem(PRODUCTS_RECOVERY_KEY);\n      if (recoveryRaw) {\n        const recovery = JSON.parse(recoveryRaw);\n        if (isProductLikeArray(recovery)) {\n          localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(recovery));\n          return recovery;\n        }\n      }\n\n      const legacy = findLegacyProductsBackup();\n      if (legacy.length > 0) {\n        localStorage.setItem(PRODUCTS_RECOVERY_KEY, JSON.stringify(legacy));\n        localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(legacy));\n        return legacy;\n      }",
    'backup recovery read'
  );

  src = replaceOnce(
    src,
    "      localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));",
    "      // Never allow an empty remote response to destroy the last known non-empty stock snapshot.\n      const currentRaw = localStorage.getItem(PRODUCTS_STORAGE_KEY);\n      if (currentRaw) {\n        try {\n          const current = JSON.parse(currentRaw);\n          if (isProductLikeArray(current)) {\n            localStorage.setItem(PRODUCTS_RECOVERY_KEY, JSON.stringify(current));\n          }\n        } catch {}\n      }\n      if (products.length > 0) {\n        localStorage.setItem(PRODUCTS_RECOVERY_KEY, JSON.stringify(products));\n        localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));\n      } else if (!localStorage.getItem(PRODUCTS_STORAGE_KEY)) {\n        localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify([]));\n      }",
    'backup write protection'
  );

  src = replaceOnce(
    src,
    "  const products = (data || []).map(mapRowToProduct);\n  setLocalProductsBackup(products, false);\n  return products;",
    "  const products = (data || []).map(mapRowToProduct);\n  if (products.length === 0) {\n    const local = getLocalProductsBackup();\n    if (local.length > 0) {\n      console.warn('⚠️ Supabase products is empty; preserving and using the last non-empty local inventory snapshot.');\n      return local;\n    }\n    return [];\n  }\n  setLocalProductsBackup(products, false);\n  return products;",
    'empty remote protection'
  );

  src = replaceOnce(
    src,
    "    if (existingData) {\n      const existingProducts = existingData.map(mapRowToProduct);\n      setLocalProductsBackup(existingProducts, false);",
    "    if (existingData) {\n      const existingProducts = existingData.map(mapRowToProduct);\n\n      if (existingProducts.length === 0 && localProducts.length > 0) {\n        console.warn('⚠️ Supabase products is empty; returning local recovery snapshot without overwriting it.');\n        return {\n          products: localProducts,\n          localCount,\n          uploadedCount: 0,\n          totalSupabaseCount: 0,\n          openingBalanceMovementsCreated: 0,\n        };\n      }\n\n      if (existingProducts.length > 0) setLocalProductsBackup(existingProducts, false);",
    'legacy migration empty guard'
  );

  src = src.replace(
    "    setLocalProductsBackup([], false);\n    return {\n      products: [],",
    "    const recovered = getLocalProductsBackup();\n    return {\n      products: recovered,"
  );
}

fs.writeFileSync(path, src);
console.log('✓ Inventory empty-remote protection and local recovery enabled');
