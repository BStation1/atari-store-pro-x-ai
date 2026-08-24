import fs from 'node:fs';

function replaceOnce(src, from, to, label) {
  if (src.includes(to)) return src;
  if (!src.includes(from)) throw new Error(`Ready reminder patch failed: ${label}`);
  return src.replace(from, to);
}

// 1) Add the 30-day pickup policy notice to the READY_FOR_PICKUP WhatsApp message.
{
  const path = 'src/lib/whatsapp.ts';
  let src = fs.readFileSync(path, 'utf8');
  if (!src.includes('READY_PICKUP_30_DAY_POLICY')) {
    const anchor = `💵 المتبقي للتحصيل: \${remaining} ج.م\\n\\n🔗 متابعة حالة الصيانة:`;
    const replacement = `💵 المتبقي للتحصيل: \${remaining} ج.م\\n\\n⚠️ *تنبيه مهم بخصوص الاستلام*\\nيرجى استلام الجهاز خلال 30 يومًا من تاريخ الجاهزية. بعد انتهاء هذه المدة لا يتحمل المحل مسؤولية التلف أو الفقد الناتج عن تأخر الاستلام، وذلك وفق سياسة المحل وشروط الاستلام.\\n\\n🔗 متابعة حالة الصيانة:`;
    src = replaceOnce(src, anchor, replacement, 'ready WhatsApp policy');
    src = src.replace('    case "READY_FOR_PICKUP": {', '    case "READY_FOR_PICKUP": {\n      // READY_PICKUP_30_DAY_POLICY');
  }
  fs.writeFileSync(path, src);
}

// 2) Create one pickup reminder milestone every 5 days while order is Ready, capped at day 30.
{
  const path = 'src/lib/db.ts';
  let src = fs.readFileSync(path, 'utf8');
  if (!src.includes('READY_PICKUP_30_DAY_REMINDERS')) {
    const marker = `      // 2. Warranty Expiring Soon (within 7 days)\n`;
    const block = `      // READY_PICKUP_30_DAY_REMINDERS\n      if (o.status === RepairStatus.Ready && o.deliveryStatus !== \"DELIVERED\" && o.completionDate) {\n        const readyMs = new Date(o.completionDate).getTime();\n        if (Number.isFinite(readyMs) && nowMs >= readyMs) {\n          const elapsedDays = Math.floor((nowMs - readyMs) / (24 * 60 * 60 * 1000));\n          if (elapsedDays >= 5) {\n            const milestone = Math.min(30, Math.floor(elapsedDays / 5) * 5);\n            const remainingDays = Math.max(0, 30 - milestone);\n            const customerName = o.customerName || o.customerNameSnapshot || o.guestCustomerName || o.guest_name || o.customer_name || \"عميلنا العزيز\";\n            const customerPhone = o.customerPhone || o.customerPhoneSnapshot || o.guestCustomerPhone || o.guest_phone || o.customer_phone || \"\";\n            const orderNumber = o.orderNumber || o.order_number || o.id;\n            const notificationId = \`NOTIF-READY-PICKUP-\${o.id}-DAY-\${milestone}\`;\n            const isFinal = milestone >= 30;\n            const counterLine = isFinal\n              ? \"مرّ 30 يومًا على جاهزية الجهاز للاستلام.\"\n              : \`مرّ \${milestone} يومًا على جاهزية الجهاز، والمتبقي \${remainingDays} يومًا من مهلة الاستلام.\`;\n            const whatsappMessage = [\n              \`أهلاً \${customerName} 👋\`,\n              \"\",\n              \`تذكير بخصوص طلب الصيانة *\${orderNumber}*.\`,\n              counterLine,\n              \"\",\n              isFinal\n                ? \"⚠️ انتهت مهلة الاستلام البالغة 30 يومًا. وفق سياسة المحل وشروط الاستلام، لا يتحمل المحل مسؤولية التلف أو الفقد الناتج عن تأخر الاستلام بعد هذه المدة.\"\n                : \"⚠️ يرجى الاستلام قبل انتهاء 30 يومًا من تاريخ الجاهزية. بعد انتهاء المدة لا يتحمل المحل مسؤولية التلف أو الفقد الناتج عن تأخر الاستلام، وفق سياسة المحل وشروط الاستلام.\",\n              \"\",\n              \"Atari Store 🎮\"\n            ].join(\"\\n\");\n\n            notifications.push({\n              id: notificationId,\n              title: isFinal ? \"🚨 انتهت مهلة استلام الجهاز\" : \`⏳ تذكير استلام - اليوم \${milestone}\`,\n              message: isFinal\n                ? \`العميل [\${customerName}] - الطلب [\${orderNumber}] تجاوز 30 يومًا وهو جاهز للتسليم.\`\n                : \`العميل [\${customerName}] - مر \${milestone} يومًا، والمتبقي \${remainingDays} يومًا للاستلام.\`,\n              type: isFinal ? \"alert\" : \"warning\",\n              category: \"repair\",\n              linkView: \"repair-center\",\n              linkParams: {\n                orderId: o.id,\n                pickupReminder: true,\n                pickupMilestone: milestone,\n                elapsedDays: milestone,\n                remainingDays,\n                whatsappPhone: customerPhone,\n                whatsappMessage\n              },\n              isRead: readIds.includes(notificationId),\n              createdAt: new Date(readyMs + milestone * 24 * 60 * 60 * 1000).toISOString(),\n              entityId: o.id,\n              entityType: \"RepairPickupReminder\"\n            });\n          }\n        }\n      }\n\n${marker}`;
    src = replaceOnce(src, marker, block, 'pickup reminder notifications');
  }
  fs.writeFileSync(path, src);
}

// 3) Reuse the existing prepared-WhatsApp action for pickup reminders.
{
  const path = 'src/components/NotificationsDrawer.tsx';
  let src = fs.readFileSync(path, 'utf8');
  if (!src.includes('pickupReminder && notif.linkParams?.whatsappPhone')) {
    const anchor = `                      {notif.category === \"warranty\" && notif.linkParams?.warrantyExpired && notif.linkParams?.whatsappPhone && (\n                        <button\n                          onClick={(e) => handleWarrantyWhatsApp(notif, e)}\n                          className=\"mt-2 w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition\"\n                          title=\"فتح رسالة واتساب جاهزة للعميل\"\n                        >\n                          <MessageCircle className=\"w-4 h-4\" />\n                          إرسال إشعار انتهاء الضمان على واتساب\n                        </button>\n                      )}\n`;
    const replacement = `${anchor}                      {notif.category === \"repair\" && notif.linkParams?.pickupReminder && notif.linkParams?.whatsappPhone && (\n                        <button\n                          onClick={(e) => handleWarrantyWhatsApp(notif, e)}\n                          className=\"mt-2 w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition\"\n                          title=\"فتح رسالة تذكير الاستلام على واتساب\"\n                        >\n                          <MessageCircle className=\"w-4 h-4\" />\n                          {Number(notif.linkParams?.remainingDays || 0) > 0\n                            ? \`إرسال تذكير واتساب - باقي \${notif.linkParams.remainingDays} يوم\`\n                            : \"إرسال إشعار انتهاء مهلة الاستلام\"}\n                        </button>\n                      )}\n`;
    src = replaceOnce(src, anchor, replacement, 'pickup WhatsApp button');
  }
  fs.writeFileSync(path, src);
}

console.log('✓ Ready-for-pickup 30-day policy and 5-day WhatsApp reminders enabled');
