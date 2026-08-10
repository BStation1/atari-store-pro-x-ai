/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from "react";
import { Printer, X, Check, Share2 } from "lucide-react";
import { RepairOrder, Customer, SystemSettings, Invoice, RepairStatus } from "../types";
import { formatPhoneDisplay } from "../utils/phone";
import { PhoneDisplay } from "./PhoneDisplay";
import {
  getInvoiceCustomerName,
  getInvoiceCustomerPhone,
  getInvoiceCustomerBadge,
  getInvoicePaymentMethodLabel,
  getCustomerNameHelper,
  getCustomerPhoneHelper,
  getDeviceDisplayName
} from "../lib/customerDisplayHelper";
import { useRepairPartUsages } from "../hooks/useData";
import { syncOrderSelectedRepairItemsFromUsages, getActiveRepairUsagesForDevice, getActiveRepairUsagesForOrder, buildRepairPartReceiptLines } from "../lib/accountingEngineV2";

interface PrintReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  order?: RepairOrder;
  invoice?: Invoice;
  customer?: Customer;
  settings: SystemSettings;
}

export default function PrintReceiptModal({
  isOpen,
  onClose,
  order,
  invoice,
  customer,
  settings
}: PrintReceiptModalProps) {
  const { partUsages, partUsagesLoaded } = useRepairPartUsages();
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const activeUsages = (partUsages || []).filter(
    pu => pu.accountingStatus !== 'RETURNED' && pu.accountingStatus !== 'REVERSED'
  );
  const syncedOrder = order ? syncOrderSelectedRepairItemsFromUsages(order, activeUsages, pu => pu.sellingPrice || 0, { usagesLoaded: partUsagesLoaded, allowClear: false }) : undefined;

  // Calculate totals
  const discount = invoice ? invoice.discount : 0;
  const total = invoice ? invoice.totalAmount : (syncedOrder ? syncedOrder.totalEstimatedCost : 0);
  const paid = invoice ? invoice.paidAmount : (syncedOrder ? syncedOrder.advancePayment : 0);
  const remaining = total - paid;

  const matchedOrderUsages = order ? getActiveRepairUsagesForOrder(order, partUsages) : [];
  const receiptLines = order ? buildRepairPartReceiptLines(order, partUsages) : [];

  console.log("RECEIPT_RUNTIME=", {
    orderId: order?.id,
    partUsagesLoaded,
    matchedOrderUsages: matchedOrderUsages.map(pu => ({
      id: pu.id,
      repairOrderId: pu.repairOrderId || (pu as any).repair_order_id,
      deviceId: (pu as any).deviceId || (pu as any).device_id,
      deviceIndex: (pu as any).deviceIndex ?? (pu as any).device_index,
      inventoryItemId: pu.inventoryItemId,
      partName: pu.partName,
      quantity: pu.quantity,
      sellingPrice: pu.sellingPrice,
      accountingStatus: pu.accountingStatus
    })),
    receiptLines,
    selectedRepairItemsSnapshot: order?.devices?.flatMap(d => d.selectedRepairItems || []) || []
  });

  const handlePrint = () => {
    const printContent = printAreaRef.current?.innerHTML;
    if (!printContent) return;

    // Print from an off-screen iframe instead of opening a blank browser tab.
    // This is more reliable for thermal printers and avoids the white-screen popup issue.
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.visibility = "hidden";
    document.body.appendChild(iframe);

    const printDocument = iframe.contentDocument || iframe.contentWindow?.document;
    if (!printDocument) {
      iframe.remove();
      return;
    }

    printDocument.open();
    printDocument.write(`
      <!doctype html>
      <html dir="rtl">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>إيصال ${order?.id || invoice?.id || "receipt"}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 0;
            }
            * { box-sizing: border-box; }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              width: 80mm !important;
              min-width: 80mm !important;
              background: #fff !important;
              color: #000 !important;
              direction: rtl;
              font-family: Arial, Tahoma, sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .receipt-container {
              width: 72mm !important;
              max-width: 72mm !important;
              margin: 0 auto !important;
              padding: 2mm 1.5mm 4mm !important;
              border: 0 !important;
              box-shadow: none !important;
              overflow: hidden !important;
              background: #fff !important;
              color: #000 !important;
              font-size: 9.5px !important;
              line-height: 1.35 !important;
            }
            .receipt-container * {
              max-width: 100%;
              box-sizing: border-box;
            }
            .receipt-container table {
              width: 100% !important;
              table-layout: fixed !important;
              border-collapse: collapse !important;
            }
            .receipt-container th,
            .receipt-container td {
              padding: 1mm 0.5mm !important;
              overflow-wrap: anywhere !important;
              word-break: break-word !important;
              vertical-align: top !important;
              font-size: 8.5px !important;
            }
            .receipt-container th:nth-child(1),
            .receipt-container td:nth-child(1) { width: 58% !important; }
            .receipt-container th:nth-child(2),
            .receipt-container td:nth-child(2) { width: 14% !important; text-align: center !important; }
            .receipt-container th:nth-child(3),
            .receipt-container td:nth-child(3) { width: 28% !important; }
            .receipt-container img {
              max-width: 22mm !important;
              height: auto !important;
              margin-left: auto !important;
              margin-right: auto !important;
            }
            .receipt-container h4 {
              font-size: 15px !important;
              margin: 0 0 1mm !important;
            }
            .receipt-container p,
            .receipt-container span,
            .receipt-container div {
              overflow-wrap: anywhere !important;
              word-break: break-word !important;
            }
            @media print {
              html, body {
                width: 80mm !important;
                margin: 0 !important;
                padding: 0 !important;
              }
              .receipt-container {
                width: 72mm !important;
                max-width: 72mm !important;
                margin: 0 auto !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="receipt-container">${printContent}</div>
        </body>
      </html>
    `);
    printDocument.close();

    const cleanup = () => {
      window.setTimeout(() => iframe.remove(), 500);
    };

    const doPrint = () => {
      const printWindow = iframe.contentWindow;
      if (!printWindow) {
        cleanup();
        return;
      }

      // Give the receipt and QR image a moment to render before opening the print dialog.
      window.setTimeout(() => {
        try {
          printWindow.focus();
          printWindow.print();
        } finally {
          cleanup();
        }
      }, 350);
    };

    if (iframe.contentWindow?.document.readyState === "complete") {
      doPrint();
    } else {
      iframe.onload = doPrint;
      window.setTimeout(doPrint, 500);
    }
  };

  // Safe QR generation link via public dynamic API
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const trackingLink = `${origin}/track?token=${order?.trackingToken || ""}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(trackingLink)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-[#11131e] border border-[#2a2d42] rounded-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col shadow-2xl glow-primary">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-[#2a2d42]">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Printer className="w-5 h-5 text-indigo-400" />
            معاينة إيصال الطباعة
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Preview Area */}
        <div className="p-6 overflow-y-auto bg-gray-950 flex-1 flex justify-center">
          <div
            ref={printAreaRef}
            className="bg-white text-black p-4 rounded-md w-full max-w-[80mm] shadow-md text-right flex flex-col leading-tight text-xs"
            style={{ direction: "rtl", fontFamily: "Cairo, sans-serif" }}
          >
            {/* Store details */}
            <div className="text-center pb-2 mb-2 border-b-2 border-dashed border-black">
              <h4 className="text-lg font-bold text-black leading-none">{settings.companyName}</h4>
              <p className="text-[10px] text-gray-700 font-medium mt-1">مركز صيانة وبيع أجهزة الكونسول والألعاب</p>
              <p className="text-[10px] text-gray-600 mt-0.5">{settings.address}</p>
              <p className="text-[10px] text-gray-600">هاتف: <PhoneDisplay phone={settings.phone} className="text-[10px]" /></p>
            </div>

            {/* Receipt details */}
            <div className="space-y-1 text-[11px] text-black">
              <div className="flex justify-between">
                <span>نوع المستند:</span>
                <span className="font-bold">
                  {order?.deliveryStatus === "DELIVERED" || order?.status === RepairStatus.Delivered
                    ? "إيصال تسليم جهاز (نهائي)"
                    : (invoice ? "فاتورة مبيعات / صيانة" : "إيصال استلام صيانة")}
                </span>
              </div>
              <div className="flex justify-between">
                <span>رقم الفاتورة/الطلب:</span>
                <span className="font-bold font-mono">{order?.id || invoice?.id}</span>
              </div>
              <div className="flex justify-between">
                <span>التاريخ:</span>
                <span>{new Date(order?.deliveredAt || order?.receivedDate || invoice?.date || "").toLocaleString("ar-EG")}</span>
              </div>
              {order?.deliveredByUserName && (
                <div className="flex justify-between">
                  <span>المستلِم والمحصِّل:</span>
                  <span className="font-bold">{order.deliveredByUserName}</span>
                </div>
              )}
              {/* Customer section */}
              {(() => {
                const displayName = invoice
                  ? getInvoiceCustomerName(invoice, customer ? [customer] : [])
                  : getCustomerNameHelper(order, customer ? [customer] : []);
                const displayPhone = invoice
                  ? getInvoiceCustomerPhone(invoice, customer ? [customer] : [])
                  : getCustomerPhoneHelper(order, customer ? [customer] : []);
                const isGuest = order ? (order.customerType === 'GUEST' || !order.customerId) : (customer?.type === 'Guest');
                const badge = invoice
                  ? getInvoiceCustomerBadge(invoice)
                  : { type: isGuest ? 'GUEST' : 'REGISTERED', label: isGuest ? 'عميل زائر' : 'عميل مسجل' };

                return (
                  <>
                    <div className="flex justify-between">
                      <span>العميل:</span>
                      <span className="font-bold">{displayName}</span>
                    </div>
                    {displayPhone && (
                      <div className="flex justify-between">
                        <span>الهاتف:</span>
                        <PhoneDisplay phone={displayPhone} />
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>نوع العميل:</span>
                      <span className="font-bold">{badge.label}</span>
                    </div>
                    {invoice?.paymentMethod && (
                      <div className="flex justify-between">
                        <span>طريقة الدفع:</span>
                        <span className="font-bold">{getInvoicePaymentMethodLabel(invoice.paymentMethod)}</span>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            <div className="border-t border-dashed border-black my-2"></div>

            {/* Items details */}
            <table className="w-full text-right text-[11px] border-collapse my-2">
              <thead>
                <tr className="border-b border-black">
                  <th className="font-bold py-1 text-right">الوصف</th>
                  <th className="font-bold py-1 text-center w-12">الكمية</th>
                  <th className="font-bold py-1 text-left w-16">السعر</th>
                </tr>
              </thead>
              <tbody>
                {syncedOrder &&
                  syncedOrder.devices.map((dev, devIdx) => {
                    const deviceUsages = (partUsagesLoaded && order)
                      ? getActiveRepairUsagesForDevice(order, dev, devIdx, partUsages)
                      : [];

                    const partLines = deviceUsages.length > 0
                      ? deviceUsages.map(pu => `${pu.partName} (x${pu.quantity} بسعر ${pu.sellingPrice ?? (pu as any).salePrice ?? 0} ج.م)`)
                      : (dev.selectedRepairItems && dev.selectedRepairItems.length > 0)
                        ? dev.selectedRepairItems.map(i => `${i.name} (x${i.quantity} بسعر ${i.repairPrice ?? i.salePrice ?? 0} ج.م)`)
                        : [];

                    return (
                      <tr key={dev.id || devIdx} className="border-b border-gray-100">
                        <td className="py-1">
                          <span className="font-bold">{getDeviceDisplayName(dev)}</span>
                          <div className="text-[9px] text-gray-700 leading-snug">العطل: {dev.issue}</div>
                          {partLines.length > 0 && (
                            <div className="text-[9px] text-indigo-900 mt-0.5">
                              قطع الغيار: {partLines.join("، ")}
                            </div>
                          )}
                        </td>
                        <td className="py-1 text-center font-bold">١</td>
                        <td className="py-1 text-left font-bold">{(dev.finalRepairPrice ?? dev.estimatedCost) || 0} ج.م</td>
                      </tr>
                    );
                  })}
                {invoice &&
                  invoice.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td className="py-1">{item.name}</td>
                      <td className="py-1 text-center font-bold">{item.quantity}</td>
                      <td className="py-1 text-left font-bold">{item.price} ج.م</td>
                    </tr>
                  ))}
              </tbody>
            </table>

            <div className="border-t border-dashed border-black my-2"></div>

            {/* Financial Calculations */}
            <div className="space-y-1 text-[11px] text-black">
              {discount > 0 && (
                <div className="flex justify-between text-gray-700">
                  <span>خصم خاص:</span>
                  <span>{discount} - ج.م</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm">
                <span>سعر الصيانة المتفق عليه:</span>
                <span>{order?.finalRepairPrice ?? total} ج.م</span>
              </div>
              <div className="flex justify-between text-green-700 font-medium">
                <span>المدفوع مقدمًا / نقداً:</span>
                <span>{paid} ج.م</span>
              </div>
              <div className="flex justify-between text-red-700 font-bold">
                <span>المتبقي المطلوب:</span>
                <span>{remaining} ج.م</span>
              </div>
              {invoice && (
                <div className="flex justify-between text-gray-700">
                  <span>طريقة الدفع:</span>
                  <span className="font-medium">
                    {invoice.paymentMethod === "Cash" && "نقدي"}
                    {invoice.paymentMethod === "InstaPay" && "انستا باي"}
                    {invoice.paymentMethod === "Visa" && "فيزا كارد"}
                    {invoice.paymentMethod === "Vodafone Cash" && "فودافون كاش"}
                  </span>
                </div>
              )}
            </div>

            <div className="border-t border-dashed border-black my-2"></div>

            {/* QR Section for Tracking */}
            {order && (
              <div className="flex flex-col items-center justify-center py-2 text-center">
                <p className="text-[9px] text-gray-600 font-bold mb-1">امسح الكود لتتبع حالة الصيانة فورياً</p>
                <img
                  src={qrUrl}
                  alt="QR Code Tracking"
                  className="w-24 h-24 border border-gray-200 p-1 bg-white"
                  crossOrigin="anonymous"
                />
                <span className="text-[8px] text-gray-500 mt-1 font-mono">{order.id}</span>
              </div>
            )}

            {/* Footer comments */}
            <div className="text-center text-[9px] text-gray-700 border-t border-dashed border-black pt-2 whitespace-pre-line leading-relaxed">
              {settings.receiptFooter}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-6 py-4 border-t border-[#2a2d42] bg-[#161927] flex gap-3">
          <button
            onClick={handlePrint}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all-custom cursor-pointer"
          >
            <Printer className="w-5 h-5" />
            طباعة الإيصال 80mm
          </button>
          <button
            onClick={onClose}
            className="bg-[#2a2d42] hover:bg-[#343854] text-white font-medium py-2 px-4 rounded-lg transition-all-custom cursor-pointer"
          >
            إغلاق المعاينة
          </button>
        </div>
      </div>
    </div>
  );
}
