/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from "react";
import { Printer, X, Check, Share2 } from "lucide-react";
import { RepairOrder, Customer, SystemSettings, Invoice, RepairStatus } from "../types";
import { formatPhoneDisplay } from "../utils/phone";
import {
  getInvoiceCustomerName,
  getInvoiceCustomerPhone,
  getInvoiceCustomerBadge,
  getInvoicePaymentMethodLabel,
  getCustomerNameHelper,
  getCustomerPhoneHelper
} from "../lib/customerDisplayHelper";

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
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  // Calculate totals
  const discount = invoice ? invoice.discount : 0;
  const total = invoice ? invoice.totalAmount : (order ? order.totalEstimatedCost : 0);
  const paid = invoice ? invoice.paidAmount : (order ? order.advancePayment : 0);
  const remaining = total - paid;

  const handlePrint = () => {
    const printContent = printAreaRef.current?.innerHTML;
    const originalContent = document.body.innerHTML;

    // Use a basic iframe print approach or direct window print
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>طباعة الفاتورة - ${order?.id || invoice?.id || "receipt"}</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');
              body {
                font-family: 'Cairo', 'Courier New', sans-serif;
                direction: rtl;
                text-align: right;
                padding: 20px;
                background-color: #fff;
                color: #000;
              }
              .receipt-container {
                max-width: 80mm;
                margin: 0 auto;
                border: 1px dashed #ccc;
                padding: 10px;
              }
              .header {
                text-align: center;
                margin-bottom: 15px;
                border-bottom: 2px dashed #000;
                padding-bottom: 10px;
              }
              .title {
                font-size: 18px;
                font-weight: bold;
                margin: 5px 0;
              }
              .subtitle {
                font-size: 11px;
                color: #555;
              }
              .info-row {
                display: flex;
                justify-content: space-between;
                font-size: 12px;
                margin: 4px 0;
              }
              .divider {
                border-top: 1px dashed #000;
                margin: 8px 0;
              }
              .item-table {
                width: 100%;
                font-size: 11px;
                border-collapse: collapse;
                margin: 8px 0;
              }
              .item-table th {
                border-bottom: 1px solid #000;
                text-align: right;
                padding: 4px 0;
              }
              .item-table td {
                padding: 4px 0;
              }
              .total-section {
                font-size: 12px;
                margin-top: 10px;
                border-top: 1px solid #000;
                padding-top: 5px;
              }
              .qr-code {
                text-align: center;
                margin: 15px 0;
              }
              .qr-code img {
                width: 100px;
                height: 100px;
              }
              .footer {
                text-align: center;
                font-size: 10px;
                margin-top: 15px;
                border-top: 1px dashed #000;
                padding-top: 10px;
                white-space: pre-line;
              }
              @media print {
                body {
                  padding: 0;
                }
                .receipt-container {
                  border: none;
                  max-width: 100%;
                }
              }
            </style>
          </head>
          <body>
            <div class="receipt-container">
              ${printContent}
            </div>
            <script>
              window.onload = function() {
                window.print();
                window.onafterprint = function() {
                  window.close();
                };
              }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  // Safe QR generation link via public dynamic API
  const trackingLink = `https://atari-store-pro-x.web.app/track?orderId=${order?.id || ""}`;
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
              <p className="text-[10px] text-gray-600">هاتف: {formatPhoneDisplay(settings.phone)}</p>
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
                        <span>{formatPhoneDisplay(displayPhone)}</span>
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
                {order &&
                  order.devices.map(dev => (
                    <tr key={dev.id} className="border-b border-gray-100">
                      <td className="py-1">
                        <span className="font-bold">{dev.type}</span> - {dev.model}
                        <div className="text-[9px] text-gray-700 leading-snug">العطل: {dev.issue}</div>
                      </td>
                      <td className="py-1 text-center font-bold">١</td>
                      <td className="py-1 text-left font-bold">{(dev.finalRepairPrice ?? dev.estimatedCost) || 0} ج.م</td>
                    </tr>
                  ))}
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
            طباعة الإيصال
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
