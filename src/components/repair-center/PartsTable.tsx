import React from "react";
import { Trash2 } from "lucide-react";
import { RepairPartUsage, Product } from "../../types";

interface PartsTableProps {
  deviceLinkedUsages: RepairPartUsage[];
  products: Product[];
  busyProductIds: Set<string>;
  onRemovePartUsage: (usageId: string, removeQty: number) => void;
  onAddPartToDevice: (productId: string, quantity: number) => void;
  getUsageSellingUnitPrice: (pu: RepairPartUsage, productsList: Product[]) => number;
}

export function PartsTable({
  deviceLinkedUsages,
  products,
  busyProductIds,
  onRemovePartUsage,
  onAddPartToDevice,
  getUsageSellingUnitPrice,
}: PartsTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#2a2d42] bg-[#141624]">
      <table id="repair-center-workshop-parts-table" className="w-full text-xs text-right text-gray-200 border-collapse">
        <thead className="bg-[#181b2a] text-gray-400 font-bold border-b border-[#2a2d42]">
          <tr>
            <th className="p-3">القطعة</th>
            <th className="p-3 text-center">السعر</th>
            <th className="p-3 text-center">الكمية</th>
            <th className="p-3 text-left font-bold text-emerald-400">الإجمالي</th>
            <th className="p-3 text-center">حذف</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#2a2d42]">
          {deviceLinkedUsages.length === 0 ? (
            <tr>
              <td colSpan={5} className="p-6 text-center text-gray-500 text-xs font-bold">
                لم يتم إضافة قطع غيار لهذا الجهاز بعد. اضغط على أي قطعة من القائمة أعلاه لإضافتها فوراً.
              </td>
            </tr>
          ) : (
            deviceLinkedUsages.map((pu) => {
              const unitSellPrice = getUsageSellingUnitPrice(pu, products);
              const lineTotal = pu.quantity * unitSellPrice;
              const matchedProd = products.find(p => p.id === pu.inventoryItemId);
              const stockAvail = matchedProd ? matchedProd.quantity : 0;
              const isBusy = busyProductIds.has(pu.inventoryItemId);

              return (
                <tr key={pu.id} className="hover:bg-[#181b2a] transition-colors">
                  <td className="p-3 font-bold text-white">
                    <div className="flex items-center gap-2">
                      <span>{pu.partName}</span>
                      {isBusy && (
                        <span className="text-[10px] text-amber-400 bg-amber-950/60 border border-amber-500/30 px-1.5 py-0.5 rounded font-bold animate-pulse">
                          جاري التحديث...
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="p-3 text-center font-mono font-bold text-gray-300">
                    {unitSellPrice.toLocaleString('ar-EG')} ج.م
                  </td>

                  <td className="p-3 text-center">
                    <div className="inline-flex items-center gap-2 bg-[#181b2a] px-2 py-1 rounded-lg border border-[#2a2d42]">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onRemovePartUsage(pu.id, 1)}
                        className="w-7 h-7 flex items-center justify-center bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-md font-bold text-base transition cursor-pointer"
                        title="خصم قطعة (-)"
                      >
                        -
                      </button>

                      <span className="font-mono text-white text-sm font-extrabold px-1.5 min-w-[20px]">
                        {pu.quantity}
                      </span>

                      <button
                        type="button"
                        disabled={stockAvail <= 0 || isBusy}
                        onClick={() => onAddPartToDevice(pu.inventoryItemId, 1)}
                        className="w-7 h-7 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 text-white rounded-md font-bold text-base transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        title={stockAvail <= 0 ? "المخزون نفذ" : "إضافة قطعة (+)"}
                      >
                        +
                      </button>
                    </div>
                  </td>

                  <td className="p-3 text-left font-mono font-extrabold text-emerald-400 text-xs">
                    {lineTotal.toLocaleString('ar-EG')} ج.م
                  </td>

                  <td className="p-3 text-center">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => onRemovePartUsage(pu.id, -1)}
                      className="p-1.5 bg-rose-500/10 hover:bg-rose-600 disabled:opacity-30 disabled:cursor-not-allowed text-rose-400 hover:text-white rounded-lg transition cursor-pointer"
                      title="حذف القطعة"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export default PartsTable;
