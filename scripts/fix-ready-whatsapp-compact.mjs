import fs from 'node:fs';

// 1) Keep the READY_FOR_PICKUP WhatsApp body short and readable.
{
  const path = 'src/lib/whatsapp.ts';
  let src = fs.readFileSync(path, 'utf8');

  const start = '    case "READY_FOR_PICKUP": {';
  const end = '    case "DELIVERED": {';
  const startIndex = src.indexOf(start);
  const endIndex = src.indexOf(end, startIndex);
  if (startIndex < 0 || endIndex < 0) throw new Error('READY_FOR_PICKUP block not found');

  const replacement = `    case "READY_FOR_PICKUP": {
      const repaired = extra?.repairedItems || faultsText || "تمت الصيانة بنجاح";
      const finalPrice = extra?.newTotal ?? order.finalRepairPrice ?? order.totalEstimatedCost ?? 0;
      const paid = order.advancePayment || 0;
      const remaining = Math.max(0, finalPrice - paid);
      const paymentLine = remaining > 0
        ? \`💰 *المطلوب: \${remaining} ج.م*\`
        : \"💰 *الحساب مدفوع بالكامل ✅*\";

      messageText = \`🎮 *Atari Store*\\n\\nأ/ \${name}\\nجهازك رقم *\${orderId}* جاهز للاستلام ✅\\n\\n🔧 *تم عمل:*\\n\${repaired}\\n\\n\${paymentLine}\\n\\n⚠️ يرجى الاستلام خلال 30 يومًا من تاريخ الجاهزية.\\n\\n📍 *متابعة الجهاز:*\\n\${trackingUrl}\\n\\nشكرًا لثقتك بنا ❤️\`;
      break;
    }
`;

  src = src.slice(0, startIndex) + replacement + src.slice(endIndex);
  fs.writeFileSync(path, src);
}

// 2) Build "تم عمل" from the real workshop part usages, including quantity and
// customer-facing selling totals. This intentionally uses the price currently
// stored on the usage so workshop discounts/price edits are reflected exactly.
{
  const path = 'src/components/RepairCenter.tsx';
  let src = fs.readFileSync(path, 'utf8');

  const oldLine = '        repairedItems: order.devices?.map(d => `${getDeviceDisplayName(d)}: ${d.issue || "إصلاح بنجاح"}`).join(" + "),';
  const newBlock = `        repairedItems: (() => {
          const orderIds = [order.id, (order as any).uuid, (order as any).orderId].filter(Boolean).map(String);
          const usages = (partUsages || []).filter((usage: any) => {
            const usageOrderId = String(usage.repairOrderId || usage.repair_order_id || '');
            const status = String(usage.accountingStatus || usage.accounting_status || '').toUpperCase();
            return orderIds.includes(usageOrderId) && status !== 'RETURNED' && status !== 'REVERSED';
          });

          if (usages.length > 0) {
            return usages.map((usage: any) => {
              const name = String(usage.partName || usage.part_name_snapshot || 'قطعة غيار').trim();
              const qty = Math.max(1, Number(usage.quantity || 1));
              const unitSell = Number(usage.sellingPrice ?? usage.selling_price ?? 0);
              const storedTotal = Number(usage.sellingTotal ?? usage.selling_total ?? 0);
              const total = storedTotal > 0 ? storedTotal : unitSell * qty;
              const qtyText = qty > 1 ? \` ×\${qty}\` : '';
              return \`• \${name}\${qtyText} — \${total.toLocaleString('ar-EG')} ج.م\`;
            }).join('\\n');
          }

          return order.devices?.map(d => \`• \${getDeviceDisplayName(d)}: \${d.issue || 'إصلاح بنجاح'}\`).join('\\n') || '• تمت الصيانة بنجاح';
        })(),`;

  if (src.includes(oldLine)) {
    src = src.replace(oldLine, newBlock);
  } else if (!src.includes("const orderIds = [order.id, (order as any).uuid")) {
    throw new Error('Could not patch READY repairedItems in RepairCenter.tsx');
  }

  fs.writeFileSync(path, src);
}

console.log('✓ Compact ready WhatsApp now includes workshop item quantities and selling totals');
