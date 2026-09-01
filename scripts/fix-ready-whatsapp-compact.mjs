import fs from 'node:fs';

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

      // Keep the ready message intentionally short. If repairedItems is prepared
      // per device by the workshop, preserve it exactly so every device appears
      // with only the work performed on it.
      messageText = \`🎮 *Atari Store*\\n\\nأ/ \${name}\\nجهازك رقم *\${orderId}* جاهز للاستلام ✅\\n\\n🔧 *تم عمل:*\\n\${repaired}\\n\\n\${paymentLine}\\n\\n⚠️ يرجى الاستلام خلال 30 يومًا من تاريخ الجاهزية.\\n\\n📍 *متابعة الجهاز:*\\n\${trackingUrl}\\n\\nشكرًا لثقتك بنا ❤️\`;
      break;
    }
`;

src = src.slice(0, startIndex) + replacement + src.slice(endIndex);
fs.writeFileSync(path, src);
console.log('✓ Compact ready-for-pickup WhatsApp message enabled');
