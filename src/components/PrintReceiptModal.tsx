/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from "react";
import { Printer, X } from "lucide-react";
import { RepairOrder, Customer, SystemSettings, Invoice, RepairStatus } from "../types";
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
import {
  syncOrderSelectedRepairItemsFromUsages,
  getActiveRepairUsagesForDevice,
  getActiveRepairUsagesForOrder,
  buildRepairPartReceiptLines
} from "../lib/accountingEngineV2";

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
    pu => pu.accountingStatus !== "RETURNED" && pu.accountingStatus !== "REVERSED"
  );

  const syncedOrder = order
    ? syncOrderSelectedRepairItemsFromUsages(
        order,
        activeUsages,
        pu => pu.sellingPrice || 0,
        { usagesLoaded: partUsagesLoaded, allowClear: false }
      )
    : undefined;

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
    const source = printAreaRef.current;
    if (!source) return;

    const printableReceipt = source.cloneNode(true) as HTMLElement;

    const copyComputedStyles = (from: Element, to: Element) => {
      const computed = window.getComputedStyle(from);
      const targetStyle = (to as HTMLElement).style;

      for (const property of Array.from(computed)) {
        targetStyle.setProperty(
          property,
          computed.getPropertyValue(property),
          computed.getPropertyPriority(property)
        );
      }

      Array.from(from.children).forEach((child, index) => {
        const targetChild = to.children[index];
        if (targetChild) copyComputedStyles(child, targetChild);
      });
    };

    copyComputedStyles(source, printableReceipt);

    // The RP326 driver on this printer shifts the browser output toward the
    // physical left edge. Use a narrower fixed receipt and explicit physical
    // margins instead of transforms/auto margins. 10mm left + 64mm receipt +
    // 6mm right = the full 80mm paper width, moving content 2mm to the right.
    printableReceipt.classList.add("rp326-receipt");
    printableReceipt.style.setProperty("box-sizing", "border-box", "important");
    printableReceipt.style.setProperty("width", "64mm", "important");
    printableReceipt.style.setProperty("min-width", "64mm", "important");
    printableReceipt.style.setProperty("max-width", "64mm", "important");
    printableReceipt.style.setProperty("margin", "0", "important");
    printableReceipt.style.setProperty("transform", "none", "important");
    printableReceipt.style.setProperty("padding", "2.5mm", "important");
    printableReceipt.style.setProperty("border-radius", "0", "important");
    printableReceipt.style.setProperty("box-shadow", "none", "important");
    printableReceipt.style.setProperty("overflow", "visible", "important");
    printableReceipt.style.setProperty("background", "#fff", "important");
    printableReceipt.style.setProperty("color", "#000", "important");
    printableReceipt.style.setProperty("font-family", "Tahoma, Arial, sans-serif", "important");
    printableReceipt.style.setProperty("font-weight", "600", "important");
    printableReceipt.style.setProperty("line-height", "1.35", "important");

    const thermalElements = [
      printableReceipt,
      ...Array.from(printableReceipt.querySelectorAll<HTMLElement>("*"))
    ];

    thermalElements.forEach(element => {
      const style = window.getComputedStyle(element);
      const weight = Number.parseInt(style.fontWeight, 10);

      element.style.setProperty("color", "#000", "important");
      element.style.setProperty("opacity", "1", "important");
      element.style.setProperty("text-shadow", "none", "important");
      element.style.setProperty("filter", "none", "important");
      element.style.setProperty("font-family", "Tahoma, Arial, sans-serif", "important");
      element.style.setProperty("line-height", "1.35", "important");
      element.style.setProperty("white-space", "normal", "important");
      element.style.setProperty("overflow-wrap", "anywhere", "important");
      element.style.setProperty("word-break", "normal", "important");
      element.style.setProperty("min-width", "0", "important");

      if (!Number.isNaN(weight)) {
        element.style.setProperty("font-weight", weight >= 600 ? "700" : "600", "important");
      }

      if (element.tagName !== "IMG") {
        element.style.removeProperty("transform");
      }

      const borderTop = style.borderTopStyle !== "none" && style.borderTopWidth !== "0px";
      const borderRight = style.borderRightStyle !== "none" && style.borderRightWidth !== "0px";
      const borderBottom = style.borderBottomStyle !== "none" && style.borderBottomWidth !== "0px";
      const borderLeft = style.borderLeftStyle !== "none" && style.borderLeftWidth !== "0px";
      if (borderTop) element.style.setProperty("border-top-color", "#000", "important");
      if (borderRight) element.style.setProperty("border-right-color", "#000", "important");
      if (borderBottom) element.style.setProperty("border-bottom-color", "#000", "important");
      if (borderLeft) element.style.setProperty("border-left-color", "#000", "important");
    });

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
      <html dir="ltr">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>إيصال ${order?.id || invoice?.id || "receipt"}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 0;
            }

            * {
              box-sizing: border-box !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            html,
            body {
              margin: 0 !important;
              padding: 0 !important;
              width: 80mm !important;
              min-width: 80mm !important;
              max-width: 80mm !important;
              background: #fff !important;
              color: #000 !important;
              overflow: visible !important;
            }

            #rp326-print-root {
              display: block !important;
              width: 80mm !important;
              min-width: 80mm !important;
              max-width: 80mm !important;
              margin: 0 !important;
              padding-top: 0 !important;
              padding-bottom: 0 !important;
              padding-left: 10mm !important;
              padding-right: 6mm !important;
              background: #fff !important;
              overflow: visible !important;
            }

            .rp326-receipt {
              direction: rtl !important;
              width: 64mm !important;
              min-width: 64mm !important;
              max-width: 64mm !important;
              margin: 0 !important;
              transform: none !important;
              padding: 2.5mm !important;
              color: #000 !important;
              background: #fff !important;
              font-family: Tahoma, Arial, sans-serif !important;
              font-weight: 600 !important;
              line-height: 1.35 !important;
              overflow: visible !important;
            }

            .rp326-receipt,
            .rp326-receipt * {
              color: #000 !important;
              opacity: 1 !important;
              text-shadow: none !important;
              font-family: Tahoma, Arial, sans-serif !important;
              white-space: normal !important;
              overflow-wrap: anywhere !important;
              word-break: normal !important;
              min-width: 0 !important;
            }

            /* Every detail row is a real two-column grid in print. This avoids
               flex shrinking/overlap after Chrome converts pixels to printer dots. */
            .rp326-receipt .flex.justify-between {
              display: grid !important;
              grid-template-columns: minmax(0, 42%) minmax(0, 58%) !important;
              column-gap: 2mm !important;
              align-items: start !important;
              justify-content: initial !important;
              width: 100% !important;
            }

            .rp326-receipt .flex.justify-between > * {
              width: auto !important;
              max-width: 100% !important;
              min-width: 0 !important;
              position: static !important;
              transform: none !important;
            }

            .rp326-receipt table {
              width: 100% !important;
              max-width: 100% !important;
              table-layout: fixed !important;
              border-collapse: collapse !important;
            }

            .rp326-receipt th,
            .rp326-receipt td {
              min-width: 0 !important;
              max-width: none !important;
              white-space: normal !important;
              overflow-wrap: anywhere !important;
              vertical-align: top !important;
            }

            .rp326-receipt th:nth-child(1),
            .rp326-receipt td:nth-child(1) {
              width: 56% !important;
            }

            .rp326-receipt th:nth-child(2),
            .rp326-receipt td:nth-child(2) {
              width: 17% !important;
              text-align: center !important;
            }

            .rp326-receipt th:nth-child(3),
            .rp326-receipt td:nth-child(3) {
              width: 27% !important;
              text-align: left !important;
            }

            .rp326-receipt img {
              opacity: 1 !important;
              filter: grayscale(1) contrast(1.25) !important;
              max-width: 26mm !important;
              max-height: 26mm !important;
            }

            @media print {
              html,
              body,
              #rp326-print-root {
                page-break-inside: auto !important;
              }
            }
          </style>
        </head>
        <body>
          <div id="rp326-print-root"></div>
        </body>
      </html>
    `);
    printDocument.close();

    const root = printDocument.getElementById("rp326-print-root");
    if (!root) {
      iframe.remove();
      return;
    }
    root.appendChild(printableReceipt);

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      window.setTimeout(() => iframe.remove(), 300);
    };

    const doPrint = async () => {
      const printWindow = iframe.contentWindow;
      if (!printWindow) {
        cleanup();
        return;
      }

      try {
        if (printDocument.fonts?.ready) await printDocument.fonts.ready;

        const images = Array.from(printDocument.images);
        await Promise.all(
          images.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise<void>(resolve => {
              img.onload = () => resolve();
              img.onerror = () => resolve();
            });
          })
        );

        await new Promise(resolve => window.setTimeout(resolve, 220));
        printWindow.onafterprint = cleanup;
        printWindow.focus();
        printWindow.print();
      } catch {
        cleanup();
      }

      window.setTimeout(cleanup, 10000);
    };

    void doPrint();
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const trackingLink = `${origin}/track?token=${order?.trackingToken || ""}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(trackingLink)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-[#11131e] border border-[#2a2d42] rounded-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col shadow-2xl glow-primary">
        <div className="flex justify-between items-center px-6 py-4 border-b border-[#2a2d42]">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Printer className="w-5 h-5 text-indigo-400" />
            معاينة إيصال الطباعة
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto bg-gray-950 flex-1 flex justify-center">
          <div
            ref={printAreaRef}
            className="bg-white text-black p-4 rounded-md w-full max-w-[80mm] shadow-md text-right flex flex-col leading-tight text-xs"
            style={{ direction: "rtl", fontFamily: "Cairo, sans-serif" }}
          >
            <div className="text-center pb-2 mb-2 border-b-2 border-dashed border-black">
              <h4 className="text-lg font-bold text-black leading-none">{settings.companyName}</h4>
              <p className="text-[10px] text-black font-semibold mt-1">مركز صيانة وبيع أجهزة الكونسول والألعاب</p>
              <p className="text-[10px] text-black mt-0.5">{settings.address}</p>
              <p className="text-[10px] text-black">
                هاتف: <PhoneDisplay phone={settings.phone} className="text-[10px]" />
              </p>
            </div>

            <div className="space-y-1 text-[11px] text-black">
              <div className="flex justify-between">
                <span>نوع المستند:</span>
                <span className="font-bold">
                  {order?.deliveryStatus === "DELIVERED" || order?.status === RepairStatus.Delivered
                    ? "إيصال تسليم جهاز (نهائي)"
                    : invoice
                      ? "فاتورة مبيعات / صيانة"
                      : "إيصال استلام صيانة"}
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

              {(() => {
                const displayName = invoice
                  ? getInvoiceCustomerName(invoice, customer ? [customer] : [])
                  : getCustomerNameHelper(order, customer ? [customer] : []);
                const displayPhone = invoice
                  ? getInvoiceCustomerPhone(invoice, customer ? [customer] : [])
                  : getCustomerPhoneHelper(order, customer ? [customer] : []);
                const isGuest = order
                  ? order.customerType === "GUEST" || !order.customerId
                  : customer?.type === "Guest";
                const badge = invoice
                  ? getInvoiceCustomerBadge(invoice)
                  : { type: isGuest ? "GUEST" : "REGISTERED", label: isGuest ? "عميل زائر" : "عميل مسجل" };

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

            <div className="border-t border-dashed border-black my-2" />

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
                    const deviceUsages = partUsagesLoaded && order
                      ? getActiveRepairUsagesForDevice(order, dev, devIdx, partUsages)
                      : [];

                    const partLines = deviceUsages.length > 0
                      ? deviceUsages.map(
                          pu => `${pu.partName} (x${pu.quantity} بسعر ${pu.sellingPrice ?? (pu as any).salePrice ?? 0} ج.م)`
                        )
                      : dev.selectedRepairItems && dev.selectedRepairItems.length > 0
                        ? dev.selectedRepairItems.map(
                            i => `${i.name} (x${i.quantity} بسعر ${i.repairPrice ?? i.salePrice ?? 0} ج.م)`
                          )
                        : [];

                    return (
                      <tr key={dev.id || devIdx} className="border-b border-black">
                        <td className="py-1">
                          <span className="font-bold">{getDeviceDisplayName(dev)}</span>
                          <div className="text-[9px] text-black leading-snug">العطل: {dev.issue}</div>
                          {partLines.length > 0 && (
                            <div className="text-[9px] text-black mt-0.5">
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
                    <tr key={idx} className="border-b border-black">
                      <td className="py-1">{item.name}</td>
                      <td className="py-1 text-center font-bold">{item.quantity}</td>
                      <td className="py-1 text-left font-bold">{item.price} ج.م</td>
                    </tr>
                  ))}
              </tbody>
            </table>

            <div className="border-t border-dashed border-black my-2" />

            <div className="space-y-1 text-[11px] text-black">
              {discount > 0 && (
                <div className="flex justify-between text-black">
                  <span>خصم خاص:</span>
                  <span>{discount} - ج.م</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm">
                <span>سعر الصيانة المتفق عليه:</span>
                <span>{order?.finalRepairPrice ?? total} ج.م</span>
              </div>
              <div className="flex justify-between text-black font-semibold">
                <span>المدفوع مقدمًا / نقداً:</span>
                <span>{paid} ج.م</span>
              </div>
              <div className="flex justify-between text-black font-bold">
                <span>المتبقي المطلوب:</span>
                <span>{remaining} ج.م</span>
              </div>
              {invoice && (
                <div className="flex justify-between text-black">
                  <span>طريقة الدفع:</span>
                  <span className="font-semibold">
                    {invoice.paymentMethod === "Cash" && "نقدي"}
                    {invoice.paymentMethod === "InstaPay" && "انستا باي"}
                    {invoice.paymentMethod === "Visa" && "فيزا كارد"}
                    {invoice.paymentMethod === "Vodafone Cash" && "فودافون كاش"}
                  </span>
                </div>
              )}
            </div>

            <div className="border-t border-dashed border-black my-2" />

            {order && (
              <div className="flex flex-col items-center justify-center py-2 text-center">
                <p className="text-[9px] text-black font-bold mb-1">امسح الكود لتتبع حالة الصيانة فورياً</p>
                <img
                  src={qrUrl}
                  alt="QR Code Tracking"
                  className="w-24 h-24 border border-black p-1 bg-white"
                  crossOrigin="anonymous"
                />
                <span className="text-[8px] text-black mt-1 font-mono">{order.id}</span>
              </div>
            )}

            <div className="text-center text-[9px] text-black border-t border-dashed border-black pt-2 whitespace-pre-line leading-relaxed">
              {settings.receiptFooter}
            </div>
          </div>
        </div>

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
