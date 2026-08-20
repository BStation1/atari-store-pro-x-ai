import fs from 'node:fs';

function replaceOnce(src, from, to, label) {
  if (src.includes(to)) return src;
  if (!src.includes(from)) throw new Error(`Patch failed: ${label}`);
  return src.replace(from, to);
}

// 1) Make PrintReceiptModal capable of opening the browser print dialog automatically once.
{
  const path = 'src/components/PrintReceiptModal.tsx';
  let src = fs.readFileSync(path, 'utf8');

  src = replaceOnce(
    src,
    'import React, { useRef } from "react";',
    'import React, { useEffect, useRef } from "react";',
    'PrintReceiptModal React hooks'
  );

  src = replaceOnce(
    src,
    '  settings: SystemSettings;\n}',
    '  settings: SystemSettings;\n  autoPrint?: boolean;\n}',
    'PrintReceiptModal autoPrint prop'
  );

  src = replaceOnce(
    src,
    '  customer,\n  settings\n}: PrintReceiptModalProps) {',
    '  customer,\n  settings,\n  autoPrint = false\n}: PrintReceiptModalProps) {',
    'PrintReceiptModal autoPrint destructure'
  );

  src = replaceOnce(
    src,
    '  const printAreaRef = useRef<HTMLDivElement>(null);\n\n  if (!isOpen) return null;',
    `  const printAreaRef = useRef<HTMLDivElement>(null);\n  const handlePrintRef = useRef<() => void>(() => {});\n  const autoPrintTriggeredRef = useRef(false);\n\n  useEffect(() => {\n    if (!isOpen || !autoPrint || autoPrintTriggeredRef.current) return;\n\n    const timer = window.setTimeout(() => {\n      if (autoPrintTriggeredRef.current) return;\n      autoPrintTriggeredRef.current = true;\n      handlePrintRef.current();\n    }, 450);\n\n    return () => window.clearTimeout(timer);\n  }, [isOpen, autoPrint, order?.id, invoice?.id]);\n\n  if (!isOpen) return null;`,
    'PrintReceiptModal auto print effect'
  );

  src = replaceOnce(
    src,
    '    void doPrint();\n  };\n\n  const origin = typeof window !== "undefined" ? window.location.origin : "";',
    '    void doPrint();\n  };\n\n  handlePrintRef.current = handlePrint;\n\n  const origin = typeof window !== "undefined" ? window.location.origin : "";',
    'PrintReceiptModal print handler ref'
  );

  fs.writeFileSync(path, src);
}

// 2) Reception auto-opens the real browser print dialog, not only the preview modal.
{
  const path = 'src/components/Reception.tsx';
  let src = fs.readFileSync(path, 'utf8');

  src = replaceOnce(
    src,
    '          settings={settings}\n          isOpen={isPrintModalOpen}',
    '          settings={settings}\n          autoPrint={true}\n          isOpen={isPrintModalOpen}',
    'Reception autoPrint prop'
  );

  fs.writeFileSync(path, src);
}

// 3) Format WhatsApp messages as clean, independent blocks per device.
{
  const path = 'src/lib/whatsapp.ts';
  let src = fs.readFileSync(path, 'utf8');

  const oldBlock = `  const deviceList = order.devices?.length\n    ? order.devices.map(d => getDeviceDisplayName(d))\n    : ["جهاز صيانة"];\n  const devicesHeader = deviceList.length > 1\n    ? \`🎮 الأجهزة:\\n• \${deviceList.join("\\n• ")}\`\n    : \`🎮 الجهاز:\\n\${deviceList[0]}\`;\n\n  const faultsList = order.devices?.length\n    ? order.devices.map(d => d.issue || "فحص ومعاينة فنية").filter(Boolean)\n    : ["فحص ومعاينة فنية"];\n  const faultsText = faultsList.join(" + ");`;

  const newBlock = `  const deviceList = order.devices?.length\n    ? order.devices.map(d => getDeviceDisplayName(d))\n    : ["جهاز صيانة"];\n  const devicesHeader = deviceList.length > 1\n    ? \`🎮 الأجهزة:\\n• \${deviceList.join("\\n• ")}\`\n    : \`🎮 الجهاز:\\n\${deviceList[0]}\`;\n\n  const faultsList = order.devices?.length\n    ? order.devices.map(d => d.issue || "فحص ومعاينة فنية").filter(Boolean)\n    : ["فحص ومعاينة فنية"];\n  const faultsText = faultsList.join(" + ");\n\n  const deviceDetailsText = order.devices?.length\n    ? order.devices.map((device, index) => {\n        const selectedItems = (device.selectedRepairItems?.length\n          ? device.selectedRepairItems\n          : (device.technicalProcedures || [])) as any[];\n\n        const itemLines = selectedItems.length > 0\n          ? selectedItems.map(item => {\n              const quantity = Math.max(1, Number(item.quantity) || 1);\n              const unitPrice = Number(item.repairPrice ?? item.salePrice ?? 0) || 0;\n              const lineTotal = unitPrice * quantity;\n              const quantityText = quantity > 1 ? \` ×\${quantity}\` : "";\n              const priceText = lineTotal > 0 ? \` — \${lineTotal} ج.م\` : "";\n              return \`• \${item.name || "بند صيانة"}\${quantityText}\${priceText}\`;\n            })\n          : [\`• \${device.issue || "فحص ومعاينة فنية"}\`];\n\n        const itemsTotal = selectedItems.reduce((sum, item) => {\n          const quantity = Math.max(1, Number(item.quantity) || 1);\n          const unitPrice = Number(item.repairPrice ?? item.salePrice ?? 0) || 0;\n          return sum + (unitPrice * quantity);\n        }, 0);\n        const deviceTotal = Number(device.estimatedCost) || itemsTotal;\n\n        const lines = [\n          \`*🎮 الجهاز \${index + 1}*\`,\n          \`*\${getDeviceDisplayName(device)}*\`,\n          \"\",\n          \"🔧 *الشغل المطلوب:*\",\n          ...itemLines\n        ];\n\n        if (deviceTotal > 0) {\n          lines.push(\"\", \`💰 *إجمالي الجهاز:* \${deviceTotal} ج.م\`);\n        }\n\n        return lines.join(\"\\n\");\n      }).join(\"\\n\\n━━━━━━━━━━━━\\n\\n\")\n    : \"*🎮 الجهاز 1*\\n*جهاز صيانة*\\n\\n🔧 *الشغل المطلوب:*\\n• فحص ومعاينة فنية\";`;

  src = replaceOnce(src, oldBlock, newBlock, 'WhatsApp per-device details builder');

  src = replaceOnce(
    src,
    '  const costSection = estCost > 0 ? `💰 التكلفة المتوقعة:\\n${estCost} ج.م\\n\\n` : "";',
    '  const costSection = estCost > 0 ? `💵 *إجمالي الطلب:* ${estCost} ج.م\\n\\n` : "";',
    'WhatsApp total cost format'
  );

  src = replaceOnce(
    src,
    '      messageText = `🎉 مرحبًا ${name}\\n\\nتم استلام جهازك بنجاح في Atari Store.\\n\\n📋 رقم الطلب:\\n${orderId}\\n\\n${devicesHeader}\\n\\n🔧 العطل:\\n${faultsText}\\n\\n${costSection}🔗 متابعة حالة الصيانة:\\n${trackingUrl}\\n\\nشكراً لثقتك بنا ❤️`;',
    '      messageText = `👋 أهلاً ${name}\\n\\nتم استلام طلب الصيانة بنجاح في *Atari Store*.\\n\\n🧾 *رقم الطلب:* ${orderId}\\n\\n━━━━━━━━━━━━\\n\\n${deviceDetailsText}\\n\\n━━━━━━━━━━━━\\n\\n${costSection}🔗 *متابعة حالة الصيانة:*\\n${trackingUrl}\\n\\nشكراً لثقتك بنا ❤️`;',
    'REPAIR_ORDER_CREATED WhatsApp format'
  );

  src = replaceOnce(
    src,
    '      messageText = `مرحبًا ${name} 👋\\n\\nبخصوص طلب الصيانة رقم [${orderId}]:\\n${devicesHeader}\\n\\nيلزم موافقتك على المستجدات التالية:',
    '      messageText = `مرحبًا ${name} 👋\\n\\nبخصوص طلب الصيانة رقم *${orderId}*:\\n\\n${deviceDetailsText}\\n\\n━━━━━━━━━━━━\\n\\nيلزم موافقتك على المستجدات التالية:',
    'APPROVAL_REQUIRED WhatsApp format'
  );

  src = replaceOnce(
    src,
    '      messageText = `🎉 مرحبًا ${name}\\n\\nطلب الصيانة رقم [${orderId}] أصبح جاهزاً للتسليم الآن!\\n\\n${devicesHeader}\\n\\n🛠️ ما تم إصلاحه:',
    '      messageText = `🎉 مرحبًا ${name}\\n\\nطلب الصيانة رقم *${orderId}* أصبح جاهزاً للتسليم الآن!\\n\\n${deviceDetailsText}\\n\\n━━━━━━━━━━━━\\n\\n🛠️ ما تم إصلاحه:',
    'READY_FOR_PICKUP WhatsApp format'
  );

  src = replaceOnce(
    src,
    '      messageText = `✨ مرحبًا ${name}\\n\\nشكراً لتعاملك معنا! تم تسليم طلب الصيانة رقم [${orderId}] بنجاح.\\n\\n${devicesHeader}\\n\\n🛡️ معلومات الضمان:',
    '      messageText = `✨ مرحبًا ${name}\\n\\nشكراً لتعاملك معنا! تم تسليم طلب الصيانة رقم *${orderId}* بنجاح.\\n\\n${deviceDetailsText}\\n\\n━━━━━━━━━━━━\\n\\n🛡️ معلومات الضمان:',
    'DELIVERED WhatsApp format'
  );

  fs.writeFileSync(path, src);
}

console.log('✓ Auto print dialog and polished per-device WhatsApp formatting applied');
