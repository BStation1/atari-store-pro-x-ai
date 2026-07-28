/**
 * Deep Freeze & Deep Clone Utility (Phase 2G.1)
 * Provides tamper-proof deep immutability with circular reference protection.
 * @license Apache-2.0
 */

/**
 * Deep clone an object or array, preserving primitive types, Date objects,
 * null, and undefined, while stripping functions/symbols and handling circular references.
 */
export function deepClone<T>(obj: T, seen = new WeakMap<object, any>()): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (seen.has(obj as object)) {
    return seen.get(obj as object);
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }

  if (Array.isArray(obj)) {
    const copyArr: any[] = [];
    seen.set(obj, copyArr);
    for (let i = 0; i < obj.length; i++) {
      const val = obj[i];
      if (typeof val === 'function' || typeof val === 'symbol') {
        copyArr.push(null);
      } else {
        copyArr.push(deepClone(val, seen));
      }
    }
    return copyArr as unknown as T;
  }

  const copyObj: Record<string, any> = {};
  seen.set(obj as object, copyObj);

  for (const key of Object.keys(obj as object)) {
    const val = (obj as Record<string, any>)[key];
    if (typeof val === 'function' || typeof val === 'symbol') {
      continue;
    }
    copyObj[key] = deepClone(val, seen);
  }

  return copyObj as unknown as T;
}

/**
 * Deep freeze an object or array recursively using Object.freeze.
 * Protects against circular references using WeakSet.
 */
export function deepFreeze<T>(obj: T, seen = new WeakSet<object>()): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (seen.has(obj as object)) {
    return obj;
  }

  seen.add(obj as object);

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      deepFreeze(obj[i], seen);
    }
  } else {
    for (const key of Object.keys(obj as object)) {
      const val = (obj as Record<string, any>)[key];
      if (val && typeof val === 'object') {
        deepFreeze(val, seen);
      }
    }
  }

  return Object.freeze(obj);
}
