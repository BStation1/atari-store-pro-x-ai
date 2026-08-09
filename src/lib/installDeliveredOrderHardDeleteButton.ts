import { hardDeleteRepairOrderAnyStatus } from './hardDeleteRepairOrderCompat';

type LocalRepairOrder = { id?: string; orderNumber?: string; uuid?: string; status?: string; deliveryStatus?: string; };
const BUTTON_DATA_ATTRIBUTE = 'data-atari-hard-delete-delivered-order';
let scheduled = false;
let busy = false;

function getLocalOrders(): LocalRepairOrder[] { try { const parsed = JSON.parse(localStorage.getItem('atari_repair_orders') || '[]'); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
function orderAliases(order: LocalRepairOrder): string[] { return [order.id, order.orderNumber, order.uuid].filter((v): v is string => Boolean(v && String(v).trim())).map(v => String(v).trim()); }
function findOrderByReference(orders: LocalRepairOrder[], reference: string): LocalRepairOrder | null {
  const ref = String(reference || '').trim().toLowerCase();
  if (!ref) return null;
  const matches = orders.filter(order => orderAliases(order).some(alias => {
    const normalized = alias.toLowerCase();
    return normalized === ref || normalized.startsWith(ref) || ref.startsWith(normalized);
  }));
  return matches.length === 1 ? matches[0] : null;
}
function resolveSelectedOrder(anchorButton: HTMLButtonElement): LocalRepairOrder | null {
  const orders = getLocalOrders(); if (!orders.length) return null;
  let node: HTMLElement | null = anchorButton.parentElement;
  for (let depth = 0; node && depth < 12; depth += 1, node = node.parentElement) {
    const text = node.innerText || '';
    const atrRefs = Array.from(text.matchAll(/ATR[-\s]?\d{3,}/gi)).map(match => match[0].replace(/\s+/g, '-'));
    for (const ref of atrRefs) { const exact = findOrderByReference(orders, ref); if (exact) return exact; }
    const matches = orders.filter(order => orderAliases(order).some(alias => text.includes(alias) || text.includes(`#${alias}`) || text.includes(`#${alias.slice(0, 8)}`)));
    if (matches.length === 1) return matches[0];
  }
  const bodyText = document.body?.innerText || '';
  const atrRefs = Array.from(bodyText.matchAll(/ATR[-\s]?\d{3,}/gi)).map(match => match[0].replace(/\s+/g, '-'));
  for (const ref of atrRefs) { const exact = findOrderByReference(orders, ref); if (exact) return exact; }
  const matches = orders.filter(order => orderAliases(order).some(alias => bodyText.includes(`#${alias}`) || bodyText.includes(`#${alias.slice(0, 8)}`)));
  return matches.length === 1 ? matches[0] : null;
}
function findDeliveryActionButton(): HTMLButtonElement | null {
  return (Array.from(document.querySelectorAll('button')) as HTMLButtonElement[]).find(button => {
    const text = (button.textContent || '').replace(/\s+/g, ' ').trim();
    return text.includes('تم التسليم') && (text.includes('🚚') || button.className.includes('bg-cyan-700'));
  }) || null;
}
function buildHardDeleteButton(anchorButton: HTMLButtonElement): HTMLButtonElement {
  const button = document.createElement('button'); button.type = 'button'; button.setAttribute(BUTTON_DATA_ATTRIBUTE, '1');
  button.className = 'w-full bg-red-700 hover:bg-red-600 text-white font-extrabold text-xs py-3 px-4 rounded-xl shadow transition cursor-pointer flex items-center justify-center gap-2 border border-red-400/30 mt-2';
  button.innerHTML = '<span aria-hidden="true">🗑️</span><span>حذف نهائي للأوردر</span>'; button.title = 'يحذف الأوردر نهائياً مهما كانت حالته ويعيد قطع الغيار المسحوبة إلى المخزون';
  button.addEventListener('click', async event => {
    event.preventDefault(); event.stopPropagation(); if (busy) return;
    const order = resolveSelectedOrder(anchorButton); const orderId = String(order?.id || order?.orderNumber || '').trim();
    if (!order || !orderId) { window.alert('تعذر تحديد أمر الصيانة المحدد. افتح الأوردر مرة أخرى ثم حاول الحذف.'); return; }
    if (!window.confirm(`تحذير: سيتم حذف أمر الصيانة [${orderId}] نهائياً مهما كانت حالته، وحذف السجلات المرتبطة به، وإرجاع أي قطع غيار مسحوبة إلى المخزون.\n\nهل تريد الاستمرار؟`)) return;
    if (!window.confirm(`تأكيد أخير: حذف [${orderId}] نهائياً لا يمكن التراجع عنه.\n\nاضغط موافق لتنفيذ الحذف الآن.`)) return;
    busy = true; const originalHtml = button.innerHTML; button.disabled = true; button.innerHTML = '<span>⏳</span><span>جاري إرجاع البضاعة وحذف الأوردر...</span>';
    try {
      const result = await hardDeleteRepairOrderAnyStatus(orderId);
      if (!result.success) throw new Error(result.error || 'تعذر تنفيذ الحذف النهائي.');
      window.alert(`تم حذف الأوردر [${orderId}] نهائياً بنجاح.\nتم إرجاع ${result.restoredUnits} قطعة إلى المخزون (${result.restoredProducts} صنف).\nتم حذف ${result.deletedPartUsages} سجل قطع غيار و${result.deletedInvoices} فاتورة مرتبطة.`);
      window.location.reload();
    } catch (error: any) { console.error('[HardDeleteRepairOrder] Failed:', error); window.alert(error?.message || 'حدث خطأ أثناء الحذف النهائي للأوردر.'); button.disabled = false; button.innerHTML = originalHtml; }
    finally { busy = false; }
  });
  return button;
}
function ensureButton() {
  scheduled = false; if (busy) return; const anchorButton = findDeliveryActionButton(); const existing = document.querySelector(`[${BUTTON_DATA_ATTRIBUTE}="1"]`);
  if (!anchorButton) { existing?.remove(); return; } const container = anchorButton.parentElement; if (!container) return;
  if (existing && existing.parentElement === container) return; existing?.remove(); anchorButton.insertAdjacentElement('afterend', buildHardDeleteButton(anchorButton));
}
function scheduleEnsureButton() { if (scheduled) return; scheduled = true; window.setTimeout(ensureButton, 80); }
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleEnsureButton, { once: true }); else scheduleEnsureButton();
  const observer = new MutationObserver(scheduleEnsureButton); observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
}
