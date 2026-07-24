import { Customer, Invoice, InvoiceItem, PaymentMethod, UserRole } from '../types';
import { roundMoney } from './accountingEngine';

export interface CreateGuestInvoiceInput {
  customerType: 'REGISTERED' | 'GUEST';
  customerId?: string;
  guestName?: string;
  guestPhone?: string;
  guestNote?: string;
  items: InvoiceItem[];
  totalAmount: number;
  discount?: number;
  paidAmount?: number;
  paymentMethod: PaymentMethod | string;
  type?: 'repair' | 'sales' | 'parts_sale';
  orderId?: string;
  createdById?: string;
  createdByName?: string;
  date?: string;
}

export interface ConvertGuestResult {
  success: boolean;
  code?: 'PHONE_COLLISION' | 'SUCCESS' | 'ERROR';
  existingCustomer?: Customer;
  updatedInvoice?: Invoice;
  newCustomerCreated?: Customer;
  message?: string;
}

export interface ConfirmDeliveryOptions {
  actionIfRemainingBalance?: 'COLLECT_NOW' | 'CONVERT_TO_REGISTERED';
  targetRegisteredCustomerId?: string;
}

export interface ConfirmDeliveryResult {
  success: boolean;
  updatedInvoice: Invoice;
  paymentCollected: number;
  convertedToRegistered?: boolean;
  message?: string;
}

export function createGuestOrRegisteredInvoice(
  input: CreateGuestInvoiceInput,
  customersList: Customer[] = []
): { invoice: Invoice; isGuest: boolean } {
  const isGuest = input.customerType === 'GUEST';
  const isCod =
    input.paymentMethod === 'CASH_ON_DELIVERY' ||
    input.paymentMethod === PaymentMethod.CashOnDelivery ||
    input.paymentMethod === 'COD';

  if (isGuest) {
    if (!input.guestName || !input.guestName.trim()) {
      throw new Error('اسم العميل الزائر إجباري');
    }

    if (isCod && (!input.guestPhone || !input.guestPhone.trim())) {
      throw new Error('رقم الهاتف إجباري لطلبات العميل الزائر بنظام الدفع عند الاستلام');
    }
  } else {
    if (!input.customerId) {
      throw new Error('يجب اختيار عميل مسجل');
    }
  }

  const dateStr = input.date || new Date().toISOString().slice(0, 10);
  const invoiceId = `INV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

  let nameSnapshot = '';
  let phoneSnapshot = '';

  if (isGuest) {
    nameSnapshot = input.guestName?.trim() || 'عميل زائر';
    phoneSnapshot = input.guestPhone?.trim() || '';
  } else {
    const regCust = customersList.find((c) => c.id === input.customerId);
    nameSnapshot = regCust?.name || 'عميل مسجل';
    phoneSnapshot = regCust?.phone || '';
  }

  const total = roundMoney(input.totalAmount || 0);
  const paid = roundMoney(input.paidAmount || 0);
  const isFullyPaid = paid >= total && total > 0;

  const invoice: Invoice = {
    id: invoiceId,
    customerId: isGuest ? (undefined as any) : input.customerId,
    items: input.items || [],
    totalAmount: total,
    discount: input.discount || 0,
    paidAmount: paid,
    paymentMethod: input.paymentMethod,
    date: dateStr,
    type: input.type || 'sales',
    isPaid: isFullyPaid,

    customerType: isGuest ? 'GUEST' : 'REGISTERED',
    guestCustomerName: isGuest ? input.guestName?.trim() : undefined,
    guestCustomerPhone: isGuest ? input.guestPhone?.trim() : undefined,
    guestCustomerNote: isGuest ? input.guestNote?.trim() : undefined,
    customerNameSnapshot: nameSnapshot,
    customerPhoneSnapshot: phoneSnapshot,

    orderStatus: isCod ? 'PENDING' : 'DELIVERED',
    isCancelled: false
  };

  return { invoice, isGuest };
}

export function checkPhoneCollisionForGuest(
  phone: string,
  customersList: Customer[]
): Customer | undefined {
  if (!phone || !phone.trim()) return undefined;
  const cleanPhone = phone.trim().replace(/\s+/g, '');
  return customersList.find(
    (c) => c.phone && c.phone.trim().replace(/\s+/g, '') === cleanPhone
  );
}

export function convertGuestToRegisteredCustomerEngine(
  invoice: Invoice,
  customersList: Customer[],
  targetCustomerId?: string,
  newCustomerData?: { name: string; phone: string; email?: string }
): ConvertGuestResult {
  if (invoice.isCancelled) {
    return { success: false, message: 'لا يمكن تحويل فاتورة ملغاة' };
  }

  const phoneToCheck = newCustomerData?.phone || invoice.guestCustomerPhone || invoice.customerPhoneSnapshot || '';

  // If no targetCustomerId given, check collision
  if (!targetCustomerId && newCustomerData) {
    const existing = checkPhoneCollisionForGuest(phoneToCheck, customersList);
    if (existing) {
      return {
        success: false,
        code: 'PHONE_COLLISION',
        existingCustomer: existing,
        message: 'يوجد عميل مسجل بنفس رقم الهاتف.'
      };
    }
  }

  let finalCustomerId = targetCustomerId;
  let newCustomer: Customer | undefined = undefined;

  if (!finalCustomerId && newCustomerData) {
    finalCustomerId = `CUST-${Date.now()}`;
    newCustomer = {
      id: finalCustomerId,
      name: newCustomerData.name.trim(),
      phone: newCustomerData.phone.trim(),
      type: 'Retail' as any,
      email: newCustomerData.email,
      createdAt: new Date().toISOString(),
      balance: Math.max(0, invoice.totalAmount - invoice.paidAmount)
    };
  }

  if (!finalCustomerId) {
    return { success: false, message: 'تعذر تحديد العميل المسجل المطلوب الربط به' };
  }

  const updatedInvoice: Invoice = {
    ...invoice,
    customerId: finalCustomerId,
    customerType: 'REGISTERED'
  };

  return {
    success: true,
    code: 'SUCCESS',
    updatedInvoice,
    newCustomerCreated: newCustomer,
    message: 'تم تحويل العميل إلى عميل مسجل بنجاح'
  };
}

export function confirmGuestDeliveryAndCollectionEngine(
  invoice: Invoice,
  user: { id: string; name: string; role?: UserRole },
  options: ConfirmDeliveryOptions = {}
): ConfirmDeliveryResult {
  if (invoice.isCancelled) {
    throw new Error('لا يمكن تأكيد تسليم فاتورة ملغاة');
  }

  if (invoice.orderStatus === 'DELIVERED' && invoice.isPaid) {
    return {
      success: true,
      updatedInvoice: invoice,
      paymentCollected: 0,
      message: 'الطلب مسلّم ومحصل بالكامل سابقاً'
    };
  }

  const remaining = roundMoney(Math.max(0, invoice.totalAmount - invoice.paidAmount));
  const isGuest = invoice.customerType === 'GUEST' || !invoice.customerId;

  let finalInvoice = { ...invoice };
  let paymentCollected = 0;
  let convertedToRegistered = false;

  if (remaining > 0 && isGuest) {
    if (!options.actionIfRemainingBalance) {
      throw new Error('لا يمكن إتمام تسليم طلب العميل الزائر مع وجود مبلغ متبقٍ.');
    }

    if (options.actionIfRemainingBalance === 'COLLECT_NOW') {
      paymentCollected = remaining;
      finalInvoice.paidAmount = roundMoney(finalInvoice.paidAmount + remaining);
      finalInvoice.isPaid = true;
    } else if (options.actionIfRemainingBalance === 'CONVERT_TO_REGISTERED') {
      if (!options.targetRegisteredCustomerId) {
        throw new Error('يجب تحديد العميل المسجل لنقل المبلغ المتبقي إلى حسابه');
      }
      finalInvoice.customerId = options.targetRegisteredCustomerId;
      finalInvoice.customerType = 'REGISTERED';
      convertedToRegistered = true;
    }
  } else if (remaining > 0 && !isGuest) {
    // Registered customer can keep debt
  } else if (remaining === 0) {
    finalInvoice.isPaid = true;
  }

  const nowStr = new Date().toISOString();
  finalInvoice.orderStatus = 'DELIVERED';
  finalInvoice.deliveredAt = nowStr;
  finalInvoice.deliveredByUserId = user.id;
  finalInvoice.deliveredByUserName = user.name;

  if (paymentCollected > 0 || finalInvoice.isPaid) {
    finalInvoice.collectedAt = nowStr;
    finalInvoice.collectedByUserId = user.id;
    finalInvoice.collectedByUserName = user.name;
  }

  return {
    success: true,
    updatedInvoice: finalInvoice,
    paymentCollected,
    convertedToRegistered,
    message: 'تم تأكيد تسليم وسداد الطلب بنجاح'
  };
}

export function cancelCodOrderEngine(
  invoice: Invoice,
  user: { id: string; name: string },
  reason: string
): { success: boolean; updatedInvoice: Invoice } {
  if (invoice.isCancelled) {
    return { success: true, updatedInvoice: invoice };
  }

  const nowStr = new Date().toISOString();
  const updated: Invoice = {
    ...invoice,
    isCancelled: true,
    cancelledAt: nowStr,
    cancelledByUserId: user.id,
    cancelledByUserName: user.name,
    cancelReason: reason || 'إلغاء طلب الدفع عند الاستلام',
    orderStatus: 'CANCELLED'
  };

  return { success: true, updatedInvoice: updated };
}
