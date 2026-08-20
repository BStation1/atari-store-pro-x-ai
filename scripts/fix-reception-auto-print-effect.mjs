import fs from 'node:fs';

const path = 'src/components/Reception.tsx';
let src = fs.readFileSync(path, 'utf8');

if (!src.includes('import React, { useState, useMemo, useEffect } from "react";')) {
  src = src.replace(
    'import React, { useState, useMemo } from "react";',
    'import React, { useState, useMemo, useEffect } from "react";'
  );
}

const marker = '  const [copiedCode, setCopiedCode] = useState(false);\n';
const effect = `  const [copiedCode, setCopiedCode] = useState(false);\n\n  // Keep auto-print independent from the WhatsApp popup lifecycle.\n  // As soon as a new order becomes the last saved order, open its receipt modal.\n  useEffect(() => {\n    if (!lastSavedOrder) return;\n    setPrintOrder(lastSavedOrder);\n    setIsPrintModalOpen(true);\n  }, [lastSavedOrder?.id]);\n`;

if (!src.includes('Keep auto-print independent from the WhatsApp popup lifecycle')) {
  if (!src.includes(marker)) throw new Error('Reception auto-print patch marker not found');
  src = src.replace(marker, effect);
}

fs.writeFileSync(path, src);
console.log('✓ Reception auto-print effect ensured');
