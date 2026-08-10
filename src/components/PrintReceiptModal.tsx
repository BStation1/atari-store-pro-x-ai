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
  getActiveRepairUsagesForDevice
} from "../lib/accountingEngineV2";

interface PrintReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  order?: RepairOrder;
  invoice?: Invoice;
  customer?: Customer;
  settings: SystemSettings;
}

type PrintMode = "thermal80" | "standard";

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

  const discount = invoice ? Number(invoice.discount || 0) : 0;
  const total = invoice
    ? Number(invoice.totalAmount || 0)
    : Number(syncedOrder?.totalEstimatedCost || order?.finalRepairPrice || 0);
  const paid = invoice
    ? Number(invoice.paidAmount || 0)
    : Number(syncedOrder?.advancePayment || order?.advancePayment || 0);
  const remaining = Math.max(0, total - paid);

  const buildPrintCss = (mode: PrintMode) => {
    const thermal = mode === "thermal80";
    return `
      @page {
        size: ${thermal ? "80mm auto" : "A4"};
        margin: ${thermal ? "0" : "10mm"};
      }
      * { box-sizing: border-box; }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
        color: #000 !important;
        direction: rtl;
        font-family: Arial, Tahoma, sans-serif;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      body {
        width: ${thermal ? "80mm" : "100%"};
        min-width: 0;
        overflow: visible;
      }
      .thermal-receipt {
        width: ${thermal ? "72mm" : "180mm"} !important;
        max-width: ${thermal ? "72mm" : "180mm"} !important;
        margin: ${thermal ? "0 auto" : "0 auto"} !important;
        padding: ${thermal ? "2mm 1.5mm 4mm" : "6mm"} !important;
        border: 0 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        background: #fff !important;
        color: #000 !important;
        font-size: ${thermal ? "9.5px" : "11px"} !important;
        line-height: ${thermal ? "1.35" : "1.45"} !important;
        overflow: hidden !important;
      }
      .receipt-store { text-align: center; padding-bottom: 2mm; margin-bottom: 2mm; border-bottom: 1px dashed #000; }
      .receipt-store h4 { margin: 0 0 1mm; font-size: ${thermal ? "15px" : "18px"}; line-height: 1.15; }
      .receipt-store p { margin: .4mm 0; font-size: ${thermal ? "8.5px" : "10px"}; line-height: 1.3; }
      .receipt-info { display: block; width: 100%; }
      .receipt-row {
        display: flex !important;
        align-items: flex-start;
        justify-content: space-between !important;
        gap: 2mm;
        width: 100%;
        margin: .7mm 0;
        font-size: ${thermal ? "9px" : "10.5px"};
      }
      .receipt-row > span:first-child { flex: 0 0 auto; }
      .receipt-row > span:last-child { min-width: 0; max-width: 65%; text-align: left; overflow-wrap: anywhere; word-break: break-word; }
      .receipt-divider { border-top: 1px dashed #000; margin: 2mm 0; height: 0; }
      .receipt-table { width: 100% !important; max-width: 100% !important; border-collapse: collapse; table-layout: fixed; margin: 1.5mm 0; }
      .receipt-table th, .receipt-table td {
        padding: ${thermal ? ".8mm .4mm" : "1.5mm 1mm"};
        vertical-align: top;
        overflow-wrap: anywhere;
        word-break: break-word;
        color: #000 !important;
      }
      .receipt-table th { border-bottom: 1px solid #000; font-size: ${thermal ? "8.5px" : "10px"}; }
      .receipt-table td { border-bottom: 1px dotted #bbb; font-size: ${thermal ? "8.5px" : "10px"}; }
      .receipt-table th:nth-child(1), .receipt-table td:nth-child(1) { width: 58%; text-align: right; }
      .receipt-table th:nth-child(2), .receipt-table td:nth-child(2) { width: 14%; text-align: center; }
      .receipt-table th:nth-child(3), .receipt-table td:nth-child(3) { width: 28%; text-align: left; white-space: normal; }
      .receipt-device-name { font-weight: 700; font-size: ${thermal ? "9px" : "10.5px"}; }
      .receipt-device-detail { font-size: ${thermal ? "7.8px" : "9px"}; line-height: 1.35; margin-top: .5mm; }
      .receipt-parts { font-size: ${thermal ? "7.8px" : "9px"}; line-height: 1.35; margin-top: .5mm; }
      .receipt-totals { width: 100%; }
      .receipt-total-main { font-size: ${thermal ? "10px" : "13px"}; font-weight: 700; }
      .receipt-qr { text-align: center; padding: 1.5mm 0; }
      .receipt-qr p { margin: 0 0 1mm; font-size: ${thermal ? "7.5px" : "9px"}; }
      .receipt-qr img { display: block; width: ${thermal ? "22mm" : "28mm"} !important; height: ${thermal ? "22mm" : "28mm"} !important; max-width: 100%; margin: 0 auto; padding: 1mm; border: 1px solid #ddd; }
      .receipt-qr span { display: block; margin-top: .7mm; font-size: ${thermal ? "7px" : "8px"}; overflow-wrap: anywhere; }
      .receipt-footer { text-align: center; border-top: 1px dashed #000; padding-top: 2mm; font-size: ${thermal ? "7.5px" : "9px"}; line-height: 1.4; white-space: pre-line; overflow-wrap: anywhere; }
      img { max-width: 100% !important; }
      table, tr, td, th, .receipt-store, .receipt-info, .receipt-totals, .receipt-qr, .receipt-footer {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      @media print {
        html, body { width: ${thermal ? "80mm" : "auto"} !important; }
        .thermal-receipt { page-break-after: avoid; }
      }
    `;
  };

  const handlePrint = (mode: PrintMode) => {
    const printContent = printAreaRef.current?.innerHTML;
    if (!printContent) return;

    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) return;

    printWindow.document.open();
    printWindow.document.write(`
      <!doctype html>
      <html dir="rtl">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>${mode === "thermal80" ? "إيصال حراري 80mm" : "طباعة الإيصال"} - ${order?.id || invoice?.id || "receipt"}</title>
          <style>${buildPrintCss(mode)}</style>
        </head>
        <body>
          <div class="thermal-receipt">${printContent}</div>
          <script>
            (function () {
              function doPrint() {
                setTimeout(function () {
                  window.focus();
                  window.print();
                }, 120);
              }
              if (document.readyState === 'complete') doPrint();
              else window.addEventListener('load', doPrint);
              window.onafterprint = function () { window.close(); };
            })();
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const trackingLink = `${origin}/track?token=${order?.trackingToken || ""}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(trackingLink)}`;

  const displayName = invoice
    ? getInvoiceCustomerName(invoice, customer ? [customer] : [])
    : getCustomerNameHelper(order, customer ? [customer] : []);
  const displayPhone = invoice
    ? getInvoiceCustomerPhone(invoice, customer ? [customer] : [])
    : getCustomerPhoneHelper(order, customer ? [customer] : []);
  const isGuest = order
    ? order.customerType === "GUEST" || !order.customerId
    : customer?.type === "Guest";
  const customerBadge = invoice
    ? getInvoiceCustomerBadge(invoice)
    : { type: isGuest ? "GUEST" : "REGISTERED", label: isGuest ? "عميل زائر" : "عميل مسجل" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-[#11131e] border border-[#2a2d42] rounded-xl w-full max-w-md max-h-[92vh] overflow-hidden flex flex-col shadow-2xl glow-primary">
        <div className="flex justify-between items-center px-5 py-4 border-b border-[#2a2d42]">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Printer className="w-5 h-5 text-indigo-400" />
              معاينة إيصال الطباعة
            </h3>
            <p className="text-[10px] text-gray-400 mt-1">مقاس حراري مخصص لطابعات 80mm مثل RP326</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto bg-gray-950 flex-1 flex justify-center">
          <div
            ref={printAreaRef}
            className="thermal-receipt bg-white text-black p-3 rounded-md w-full max-w-[72mm] shadow-md text-right flex flex-col leading-tight text-xs"
            style={{ direction: "rtl", fontFamily: "Arial, Tahoma, sans-serif" }}
          >
            <div className="receipt-store text-center pb-2 mb-2 border-b-2 border-dashed border-black">
              <h4 className="text-base font-bold text-black leading-none">{settings.companyName}</h4>
              <p className="text-[9px] text-gray-700 font-medium mt-1">مركز صيانة وبيع أجهزة الكونسول والألعاب</p>
              <p className="text-[9px] text-gray-600 mt-0.5">{settings.address}</p>
              <p className="text-[9px] text-gray-600">هاتف: <PhoneDisplay phone={settings.phone} className="text-[9px]" /></p>
            </div>

            <div className="receipt-info space-y-1 text-[10px] text-black">
              <div className="receipt-row flex justify-between gap-2">
                <span>نوع المستند:</span>
                <span className="font-bold text-left">
                  {order?.deliveryStatus === "DELIVERED" || order?.status === RepairStatus.Delivered
                    ? "إيصال تسليم جهاز (نهائي)"
                    : invoice
                      ? "فاتورة مبيعات / صيانة"
                      : "إيصال استلام صيانة"}
                </span>
              </div>
              <div className="receipt-row flex justify-between gap-2">
                <span>رقم الطلب:</span>
                <span className="font-bold font-mono text-left break-all">{order?.id || invoice?.id}</span>
              </div>
              <div className="receipt-row flex justify-between gap-2">
                <span>التاريخ:</span>
                <span className="text-left">{new Date(order?.deliveredAt || order?.receivedDate || invoice?.date || "").toLocaleString("ar-EG")}</span>
              </div>
              {order?.deliveredByUserName && (
                <div className="receipt-row flex justify-between gap-2">
                  <span>المستلِم والمحصِّل:</span>
                  <span className="font-bold text-left">{order.deliveredByUserName}</span>
                </div>
              )}
              <div className="receipt-row flex justify-between gap-2">
                <span>العميل:</span>
                <span className="font-bold text-left">{displayName}</span>
              </div>
              {displayPhone && (
                <div className="receipt-row flex justify-between gap-2">
                  <span>الهاتف:</span>
                  <span className="text-left"><PhoneDisplay phone={displayPhone} /></span>
                </div>
              )}
              <div className="receipt-row flex justify-between gap-2">
                <span>نوع العميل:</span>
                <span className="font-bold text-left">{customerBadge.label}</span>
              </div>
              {invoice?.paymentMethod && (
                <div className="receipt-row flex justify-between gap-2">
                  <span>طريقة الدفع:</span>
                  <span className="font-bold text-left">{getInvoicePaymentMethodLabel(invoice.paymentMethod)}</span>
                </div>
              )}
            </div>

            <div className="receipt-divider border-t border-dashed border-black my-2" />

            <table className="receipt-table w-full text-right text-[10px] border-collapse my-1">
              <thead>
                <tr className="border-b border-black">
                  <th className="font-bold py-1 text-right">الوصف</th>
                  <th className="font-bold py-1 text-center w-10">كمية</th>
                  <th className="font-bold py-1 text-left w-14">السعر</th>
                </tr>
              </thead>
              <tbody>
                {syncedOrder && syncedOrder.devices.map((dev, devIdx) => {
                  const deviceUsages = partUsagesLoaded && order
                    ? getActiveRepairUsagesForDevice(order, dev, devIdx, partUsages)
                    : [];
                  const partLines = deviceUsages.length > 0
                    ? deviceUsages.map(pu => `${pu.partName} ×${pu.quantity} (${pu.sellingPrice ?? (pu as any).salePrice ?? 0} ج.م)`)
                    : (dev.selectedRepairItems || []).map(i => `${i.name} ×${i.quantity} (${i.repairPrice ?? i.salePrice ?? 0} ج.م)`);

                  return (
                    <tr key={dev.id || devIdx}>
                      <td className="py-1">
                        <div className="receipt-device-name font-bold">{getDeviceDisplayName(dev)}</div>
                        <div className="receipt-device-detail text-[8px] text-gray-700">العطل: {dev.issue}</div>
                        {partLines.length > 0 && (
                          <div className="receipt-parts text-[8px] text-gray-800 mt-0.5">قطع الغيار: {partLines.join("، ")}</div>
                        )}
                      </td>
                      <td className="py-1 text-center font-bold">1</td>
                      <td className="py-1 text-left font-bold">{(dev.finalRepairPrice ?? dev.estimatedCost) || 0} ج.م</td>
                    </tr>
                  );
                })}
                {invoice?.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-1">{item.name}</td>
                    <td className="py-1 text-center font-bold">{item.quantity}</td>
                    <td className="py-1 text-left font-bold">{item.price} ج.م</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="receipt-divider border-t border-dashed border-black my-2" />

            <div className="receipt-totals space-y-1 text-[10px] text-black">
              {discount > 0 && (
                <div className="receipt-row flex justify-between gap-2">
                  <span>الخصم:</span><span>{discount} - ج.م</span>
                </div>
              )}
              <div className="receipt-row receipt-total-main flex justify-between gap-2 font-bold text-[11px]">
                <span>الإجمالي:</span><span>{order?.finalRepairPrice ?? total} ج.م</span>
              </div>
              <div className="receipt-row flex justify-between gap-2 font-medium">
                <span>المدفوع:</span><span>{paid} ج.م</span>
              </div>
              <div className="receipt-row flex justify-between gap-2 font-bold">
                <span>المتبقي:</span><span>{remaining} ج.م</span>
              </div>
            </div>

            {order && (
              <>
                <div className="receipt-divider border-t border-dashed border-black my-2" />
                <div className="receipt-qr flex flex-col items-center justify-center py-1 text-center">
                  <p className="text-[8px] text-gray-700 font-bold mb-1">امسح الكود لتتبع حالة الصيانة</p>
                  <img src={qrUrl} alt="QR Code Tracking" className="w-20 h-20 border border-gray-200 p-1 bg-white" crossOrigin="anonymous" />
                  <span className="text-[7px] text-gray-600 mt-1 font-mono break-all">{order.id}</span>
                </div>
              </>
            )}

            <div className="receipt-footer text-center text-[8px] text-gray-700 border-t border-dashed border-black pt-2 whitespace-pre-line leading-relaxed">
              {settings.receiptFooter}
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-[#2a2d42] bg-[#161927] grid grid-cols-2 gap-2">
          <button
            onClick={() => handlePrint("thermal80")}
            className="col-span-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 transition-all-custom cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            طباعة حراري 80mm - RP326
          </button>
          <button
            onClick={() => handlePrint("standard")}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all-custom cursor-pointer text-xs"
          >
            <Printer className="w-4 h-4" />
            طباعة عادية
          </button>
          <button
            onClick={onClose}
            className="bg-[#2a2d42] hover:bg-[#343854] text-white font-medium py-2 px-3 rounded-lg transition-all-custom cursor-pointer text-xs"
          >
            إغلاق المعاينة
          </button>
        </div>
      </div>
    </div>
  );
}
