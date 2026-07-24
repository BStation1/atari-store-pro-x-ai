import { Customer, Invoice } from '../types';

export function getInvoiceCustomerName(
  invoice: Partial<Invoice> | null | undefined,
  customersList: Customer[] = []
): string {
  if (!invoice) return 'عميل زائر';

  if (invoice.customerNameSnapshot && invoice.customerNameSnapshot.trim() !== '') {
    return invoice.customerNameSnapshot.trim();
  }

  if (invoice.guestCustomerName && invoice.guestCustomerName.trim() !== '') {
    return invoice.guestCustomerName.trim();
  }

  if (invoice.customerId) {
    const found = customersList.find((c) => c.id === invoice.customerId);
    if (found && found.name) return found.name;
  }

  return 'عميل زائر';
}

export function getInvoiceCustomerPhone(
  invoice: Partial<Invoice> | null | undefined,
  customersList: Customer[] = []
): string {
  if (!invoice) return '';

  if (invoice.customerPhoneSnapshot && invoice.customerPhoneSnapshot.trim() !== '') {
    return invoice.customerPhoneSnapshot.trim();
  }

  if (invoice.guestCustomerPhone && invoice.guestCustomerPhone.trim() !== '') {
    return invoice.guestCustomerPhone.trim();
  }

  if (invoice.customerId) {
    const found = customersList.find((c) => c.id === invoice.customerId);
    if (found && found.phone) return found.phone;
  }

  return '';
}

export function getInvoiceCustomerBadge(invoice: Partial<Invoice> | null | undefined): {
  type: 'REGISTERED' | 'GUEST';
  label: string;
} {
  if (invoice?.customerType === 'REGISTERED' || (invoice?.customerId && !invoice?.guestCustomerName)) {
    return { type: 'REGISTERED', label: 'عميل مسجل' };
  }
  return { type: 'GUEST', label: 'عميل زائر' };
}

export function getInvoicePaymentMethodLabel(method: string | undefined): string {
  if (!method) return 'كاش';
  const m = String(method).toUpperCase();
  if (m === 'CASH_ON_DELIVERY' || m === 'CASH ONDELIVERY' || m === 'COD') return 'الدفع عند الاستلام';
  if (m === 'CASH' || m === 'MONEY') return 'كاش (نقدي)';
  if (m === 'VISA' || m === 'BANK') return 'فيزا / بنك';
  if (m === 'INSTAPAY') return 'إنستا باي';
  if (m === 'VODAFONECASH' || m === 'VODAFONE CASH') return 'فودافون كاش';
  return method;
}

export function getInvoiceOrderStatusLabel(status: string | undefined): string {
  if (!status) return 'قيد التجهيز';
  const s = String(status).toUpperCase();
  switch (s) {
    case 'PENDING':
      return 'قيد التجهيز';
    case 'READY':
      return 'جاهز للتسليم';
    case 'OUT_FOR_DELIVERY':
      return 'خرج للتسليم';
    case 'DELIVERED':
      return 'تم التسليم';
    case 'CANCELLED':
      return 'ملغي';
    default:
      return status;
  }
}

export function getCustomerNameHelper(
  order: any,
  customersList: Customer[] = []
): string {
  if (!order) return 'بدون اسم';

  if (order.customerNameSnapshot && String(order.customerNameSnapshot).trim() !== '') {
    return String(order.customerNameSnapshot).trim();
  }

  if (order.guestCustomerName && String(order.guestCustomerName).trim() !== '') {
    return String(order.guestCustomerName).trim();
  }

  if (order.customerId) {
    const found = customersList.find((c) => c.id === order.customerId);
    if (found && found.name && String(found.name).trim() !== '') {
      return String(found.name).trim();
    }
  }

  return 'بدون اسم';
}

export function getCustomerBadgeHelper(order: any): {
  type: 'REGISTERED' | 'GUEST';
  label: string;
} {
  if (!order) return { type: 'GUEST', label: 'عميل زائر' };

  if (order.customerType === 'REGISTERED') {
    return { type: 'REGISTERED', label: 'عميل مسجل' };
  }
  if (order.customerType === 'GUEST') {
    return { type: 'GUEST', label: 'عميل زائر' };
  }

  if (order.customerId && !order.guestCustomerName) {
    return { type: 'REGISTERED', label: 'عميل مسجل' };
  }

  return { type: 'GUEST', label: 'عميل زائر' };
}

export function getCustomerPhoneHelper(
  order: any,
  customersList: Customer[] = []
): string {
  if (!order) return '';

  if (order.customerPhoneSnapshot && String(order.customerPhoneSnapshot).trim() !== '') {
    return String(order.customerPhoneSnapshot).trim();
  }

  if (order.guestCustomerPhone && String(order.guestCustomerPhone).trim() !== '') {
    return String(order.guestCustomerPhone).trim();
  }

  if (order.customerId) {
    const found = customersList.find((c) => c.id === order.customerId);
    if (found && found.phone) return found.phone;
  }

  return '';
}
