import { hardDeleteDeliveredRepairOrder } from './hardDeleteRepairOrder';

type LocalRepairOrder = {
  id?: string;
  orderNumber?: string;
  uuid?: string;
  status?: string;
  deliveryStatus?: string;
};

const BUTTON_MARKER = 'atari-hard-delete-delivered-order';
let scheduled = false;
let busy = false;

function getLocalOrders(): LocalRepairOrder[] {
  try {
    const parsed = JSON.parse(localStorage.getItem('atari_repair_orders') || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isDelivered(order: LocalRepairOrder): boolean {
  const status = String(order.status || '').toLowerCase();
  return status === 'delivered' || status.includes('deliver') || String(order.deliveryStatus || '').toUpperCase() === 'DELIVERED';
}

function orderAliases(order: LocalRepairOrder): string[] {
  return [order.id, order.orderNumber, order.uuid]
    .filter((value): value is string => Boolean(value && String(value).trim()))
    .map(value => String(value).trim());
}

function resolveSelectedDeliveredOrder(deliveryButton: HTMLButtonElement): LocalRepairOrder | null {
  const orders = getLocalOrders().filter(isDelivered);
  if (orders.length === 0) return null;

  let node: HTMLElement | null = deliveryButton.parentElement;
  for (let depth = 0; node && depth < 10; depth += 1, node = node.parentElement) {
    const text = node.innerText || '';
    const matches = orders.filter(order => {
      const aliases = orderAliases(order);
      return aliases.some(alias => text.includes(alias) || text.includes(`#${alias}`) || text.includes(`#${alias.slice(0, 8)}`));
    });
    if (matches.length === 1) return matches[0];
  }

  const bodyText = document.body?.innerText || '';
  const workspaceMatches = orders.filter(order => {
    const displayRef = String(order.orderNumber || order.id || '').trim();
    if (!displayRef) return false;
    return bodyText.includes(`#${displayRef}`) || bodyText.includes(`#${displayRef.slice(0, 8)}`);
  });
  return workspaceMatches.length === 1 ? workspaceMatches[0] : null;
}

function findDeliveredActionButton(): HTMLButtonElement | null {
  const buttons = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];
  return (
    buttons.find(button => {
      const text = (button.textContent || '').replace(/\s+/g, ' ').trim();
      return button.disabled && text.includes('تم التسليم') && (text.includes('🚚') || button.className.includes('bg-cyan-700'));
    }) || null
  );
}

function buildHardDeleteButton(deliveryButton: HTMLButtonElement): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset[BUTTON_MARKER] = '1';
  button.className =
    'w-full bg-red-700 hover:bg-red-600 text-white font-extrabold text-xs py-3 px-4 rounded-xl shadow transition cursor-pointer flex items-center justify-center gap-2 border border-red-400/30 mt-2';
  button.innerHTML = '<span aria-hidden="true">🗑️</span><span>حذف نهائي للأوردر</span>';
  button.title = 'يحذف الأوردر نهائياً ويعيد قطع الغيار المسحوبة إلى المخزون';

  button.addEventListener('click', async event => {
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;

    const order = resolveSelectedDeliveredOrder(deliveryButton);
    const orderId = String(order?.id || order?.orderNumber || '').trim();
    if (!order || !orderId) {
      window.alert('تعذر تحديد أمر الصيانة المحدد. افتح الأوردر المسلّم مرة أخرى ثم حاول الحذف.');
      return;
    }

    const firstConfirm = window.confirm(
      `تحذير: سيتم حذف أمر الصيانة [${orderId}] نهائياً من قاعدة البيانات، وحذف الفاتورة والسجلات المرتبطة به، وإرجاع أي قطع غيار مسحوبة إلى المخزون.\n\nهل تريد الاستمرار؟`
    );
    if (!firstConfirm) return;

    const secondConfirm = window.confirm(
      `تأكيد أخير: حذف [${orderId}] نهائياً لا يمكن التراجع عنه.\n\nاضغط موافق لتنفيذ الحذف الآن.`
    );
    if (!secondConfirm) return;

    busy = true;
    const originalHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span>⏳</span><span>جاري إرجاع البضاعة وحذف الأوردر...</span>';

    try {
      const result = await hardDeleteDeliveredRepairOrder(orderId);
      if (!result.success) {
        throw new Error(result.error || 'تعذر تنفيذ الحذف النهائي.');
      }

      window.alert(
        `تم حذف الأوردر [${orderId}] نهائياً بنجاح.\n` +
          `تم إرجاع ${result.restoredUnits} قطعة إلى المخزون (${result.restoredProducts} صنف).\n` +
          `تم حذف ${result.deletedPartUsages} سجل قطع غيار و${result.deletedInvoices} فاتورة مرتبطة.`
      );

      window.location.reload();
    } catch (error: any) {
      console.error('[HardDeleteRepairOrder] Failed:', error);
      window.alert(error?.message || 'حدث خطأ أثناء الحذف النهائي للأوردر. لم يتم اعتبار العملية ناجحة.');
      button.disabled = false;
      button.innerHTML = originalHtml;
    } finally {
      busy = false;
    }
  });

  return button;
}

function ensureButton() {
  scheduled = false;
  if (busy) return;

  const deliveryButton = findDeliveredActionButton();
  const existing = document.querySelector(`[data-${BUTTON_MARKER.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)}="1"]`);

  if (!deliveryButton) {
    existing?.remove();
    return;
  }

  const container = deliveryButton.parentElement;
  if (!container) return;

  if (existing && existing.parentElement === container) return;
  existing?.remove();

  const hardDeleteButton = buildHardDeleteButton(deliveryButton);
  deliveryButton.insertAdjacentElement('afterend', hardDeleteButton);
}

function scheduleEnsureButton() {
  if (scheduled) return;
  scheduled = true;
  window.setTimeout(ensureButton, 80);
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleEnsureButton, { once: true });
  } else {
    scheduleEnsureButton();
  }

  const observer = new MutationObserver(scheduleEnsureButton);
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
}
