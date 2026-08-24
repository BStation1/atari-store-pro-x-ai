import fs from 'node:fs';

function replaceOnce(src, from, to, label) {
  if (src.includes(to)) return src;
  if (!src.includes(from)) throw new Error(`Warranty expiry patch failed: ${label}`);
  return src.replace(from, to);
}

// 1) Generate a notification for every individual repair part whose warranty has expired.
{
  const path = 'src/lib/db.ts';
  let src = fs.readFileSync(path, 'utf8');

  if (!src.includes('PART_WARRANTY_EXPIRY_NOTIFICATIONS')) {
    const marker = `      // 3. Warranty Claim Returns\n`;
    const block = `      // PART_WARRANTY_EXPIRY_NOTIFICATIONS\n      // Each consumed part can have an independent warranty period. Warranty starts\n      // when the repair order is delivered, and expiry is calculated independently\n      // for every item so a 14-day socket and a 30-day IC do not share one date.\n      if (o.deliveryStatus === \"DELIVERED\" && o.deliveredAt) {\n        const deliveredMs = new Date(o.deliveredAt).getTime();\n        if (Number.isFinite(deliveredMs)) {\n          const customerName = o.customerName || o.customerNameSnapshot || o.guestCustomerName || o.guest_name || o.customer_name || \"عميلنا العزيز\";\n          const customerPhone = o.customerPhone || o.customerPhoneSnapshot || o.guestCustomerPhone || o.guest_phone || o.customer_phone || \"\";\n\n          (o.devices || []).forEach((device, deviceIdx) => {\n            const items = device.selectedRepairItems || [];\n            items.forEach((item, itemIdx) => {\n              const warrantyDays = Math.max(0, Math.floor(Number((item as any).warrantyDays || 0)));\n              if (warrantyDays <= 0) return;\n\n              const expiresMs = deliveredMs + warrantyDays * 24 * 60 * 60 * 1000;\n              if (nowMs < expiresMs) return;\n\n              const itemName = item.name || \"قطعة غيار\";\n              const expiryDate = new Date(expiresMs);\n              const expiryText = expiryDate.toLocaleDateString(\"ar-EG\");\n              const stableItemId = item.usageId || item.id || item.productId || itemIdx;\n              const notificationId = \`NOTIF-PART-WARRANTY-EXPIRED-\${o.id}-\${deviceIdx}-\${stableItemId}\`;\n              const orderNumber = o.orderNumber || o.order_number || o.id;\n              const whatsappMessage = [\n                \`أهلاً \${customerName} 👋\`,\n                \"\",\n                \`نحب نبلغ حضرتك إن فترة ضمان قطعة *\${itemName}* الخاصة بطلب الصيانة *\${orderNumber}* انتهت بتاريخ \${expiryText}.\`,\n                \"\",\n                \"لو محتاج أي مساعدة أو فحص جديد للجهاز إحنا تحت أمرك.\",\n                \"Atari Store 🎮\"\n              ].join(\"\\n\");\n\n              notifications.push({\n                id: notificationId,\n                title: \`⏰ انتهى ضمان: \${itemName}\`,\n                message: \`العميل [\${customerName}] - طلب [\${orderNumber}] - انتهى ضمان القطعة بتاريخ \${expiryText}.\`,\n                type: \"warning\",\n                category: \"warranty\",\n                linkView: \"repair-center\",\n                linkParams: {\n                  orderId: o.id,\n                  warrantyExpired: true,\n                  partName: itemName,\n                  expiryDate: expiryDate.toISOString(),\n                  whatsappPhone: customerPhone,\n                  whatsappMessage\n                },\n                isRead: readIds.includes(notificationId),\n                createdAt: expiryDate.toISOString(),\n                entityId: o.id,\n                entityType: \"RepairPartWarranty\"\n              });\n            });\n          });\n        }\n      }\n\n${marker}`;
    src = replaceOnce(src, marker, block, 'part warranty notification engine');
  }

  fs.writeFileSync(path, src);
}

// 2) Add a direct WhatsApp action to warranty-expiry notifications.
{
  const path = 'src/components/NotificationsDrawer.tsx';
  let src = fs.readFileSync(path, 'utf8');

  if (!src.includes('handleWarrantyWhatsApp')) {
    src = replaceOnce(
      src,
      `  Info\n} from \"lucide-react\";`,
      `  Info,\n  MessageCircle\n} from \"lucide-react\";`,
      'MessageCircle import'
    );

    const handlerAnchor = `  const handleNotificationClick = (notif: SystemNotification) => {\n`;
    const handler = `  const handleWarrantyWhatsApp = (notif: SystemNotification, e: React.MouseEvent) => {\n    e.stopPropagation();\n    const phoneRaw = String(notif.linkParams?.whatsappPhone || \"\").replace(/\\D/g, \"\");\n    const message = String(notif.linkParams?.whatsappMessage || \"\");\n    if (!phoneRaw || !message) return;\n\n    let phone = phoneRaw;\n    // Egyptian local mobile numbers are stored commonly as 01xxxxxxxxx.\n    if (phone.startsWith(\"0\") && phone.length === 11) phone = \`20\${phone.slice(1)}\`;\n    const url = \`https://wa.me/\${phone}?text=\${encodeURIComponent(message)}\`;\n    window.open(url, \"_blank\", \"noopener,noreferrer\");\n    db.markNotificationAsRead(notif.id);\n    onRefresh();\n  };\n\n${handlerAnchor}`;
    src = replaceOnce(src, handlerAnchor, handler, 'WhatsApp handler');

    const messageAnchor = `                      <p className=\"text-xs text-slate-300 leading-relaxed line-clamp-2\">\n                        {notif.message}\n                      </p>\n`;
    const messageWithAction = `${messageAnchor}                      {notif.category === \"warranty\" && notif.linkParams?.warrantyExpired && notif.linkParams?.whatsappPhone && (\n                        <button\n                          onClick={(e) => handleWarrantyWhatsApp(notif, e)}\n                          className=\"mt-2 w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition\"\n                          title=\"فتح رسالة واتساب جاهزة للعميل\"\n                        >\n                          <MessageCircle className=\"w-4 h-4\" />\n                          إرسال إشعار انتهاء الضمان على واتساب\n                        </button>\n                      )}\n`;
    src = replaceOnce(src, messageAnchor, messageWithAction, 'notification WhatsApp action');
  }

  fs.writeFileSync(path, src);
}

// 3) Refresh warranty notifications while the app is running and when the user returns to the tab.
{
  const path = 'src/App.tsx';
  let src = fs.readFileSync(path, 'utf8');

  if (!src.includes('WARRANTY_NOTIFICATION_REFRESH')) {
    const anchor = `  const handleNavigate = (view: string, params: any = null) => {\n`;
    const block = `  // WARRANTY_NOTIFICATION_REFRESH\n  // Warranty expiry is time-based, so refresh the notification engine periodically\n  // even when no database row has changed, and immediately when the user returns.\n  useEffect(() => {\n    const refreshWarrantyNotifications = () => setNotificationsTick(prev => prev + 1);\n    const intervalId = window.setInterval(refreshWarrantyNotifications, 60 * 60 * 1000);\n    const handleVisibility = () => {\n      if (document.visibilityState === \"visible\") refreshWarrantyNotifications();\n    };\n    document.addEventListener(\"visibilitychange\", handleVisibility);\n    return () => {\n      window.clearInterval(intervalId);\n      document.removeEventListener(\"visibilitychange\", handleVisibility);\n    };\n  }, []);\n\n${anchor}`;
    src = replaceOnce(src, anchor, block, 'periodic warranty refresh');
  }

  fs.writeFileSync(path, src);
}

console.log('✓ Per-part warranty expiry notifications and WhatsApp action enabled');
