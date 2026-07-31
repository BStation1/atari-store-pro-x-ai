import React from "react";
import { RepairStatus } from "../../types";

interface OrderHeaderProps {
  orderNumber?: string | number;
  orderId: string;
  deviceType?: string;
  deviceModel?: string;
  serialNumber?: string;
  customerName: string;
  customerPhone: string;
  status: RepairStatus;
  onUpdateOrderStatus: (status: RepairStatus) => void;
}

export function OrderHeader({
  orderNumber,
  orderId,
  deviceType,
  deviceModel,
  serialNumber,
  customerName,
  customerPhone,
  status,
  onUpdateOrderStatus,
}: OrderHeaderProps) {
  return (
    <div className="bg-[#11131e] border border-[#2a2d42] p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
      <div className="flex flex-wrap items-center gap-4 text-white">
        <div className="flex items-center gap-1.5 bg-[#181b2a] px-3 py-1.5 rounded-lg border border-[#2a2d42]">
          <span className="text-gray-400 font-medium">رقم أمر الصيانة:</span>
          <span className="font-extrabold text-indigo-400 font-mono text-sm">
            #{orderNumber || orderId.slice(0, 8)}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-gray-400 font-medium">الجهاز:</span>
          <span className="font-bold text-white">{deviceType || "غير محدد"}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-gray-400 font-medium">الموديل:</span>
          <span className="font-bold text-white">{deviceModel || "غير محدد"}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-gray-400 font-medium">الرقم التسلسلي:</span>
          <span className="font-mono text-gray-300 bg-gray-900 px-2 py-0.5 rounded border border-gray-800">
            {serialNumber || "غير متوفر"}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-gray-400 font-medium">اسم العميل:</span>
          <span className="font-bold text-white">{customerName}</span>
          <span className="text-cyan-400 font-mono font-bold mr-1">({customerPhone})</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-gray-400 font-medium whitespace-nowrap">الحالة الحالية:</span>
        <select
          value={status}
          onChange={(e) => onUpdateOrderStatus(e.target.value as RepairStatus)}
          className="bg-[#181b2a] border border-indigo-500/40 text-white font-bold text-xs rounded-lg px-3 py-1.5 focus:outline-none cursor-pointer hover:border-indigo-500"
        >
          <option value={RepairStatus.Received}>تم الاستلام</option>
          <option value={RepairStatus.Diagnosing}>قيد التشخيص</option>
          <option value={RepairStatus.Repairing}>قيد الإصلاح</option>
          <option value={RepairStatus.WaitingParts}>بانتظار قطع الغيار</option>
          <option value={RepairStatus.Ready}>جاهز للتسليم</option>
          <option value={RepairStatus.Delivered}>تم التسليم</option>
          <option value={RepairStatus.Cancelled}>ملغى</option>
        </select>
      </div>
    </div>
  );
}

export default OrderHeader;
