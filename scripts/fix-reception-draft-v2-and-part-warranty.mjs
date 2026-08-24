import fs from 'node:fs';

function replaceOnce(src, from, to, label) {
  if (src.includes(to)) return src;
  if (!src.includes(from)) throw new Error(`Draft/warranty patch failed: ${label}`);
  return src.replace(from, to);
}

// 1) Strengthen reception draft persistence so component/tab switches cannot lose work.
{
  const path = 'src/components/Reception.tsx';
  let src = fs.readFileSync(path, 'utf8');

  if (!src.includes('RECEPTION_DRAFT_V2_HARDENED')) {
    const marker = '  // Filter customers';
    const block = `  // RECEPTION_DRAFT_V2_HARDENED\n  // Keep the freshest render snapshot in a ref and flush it when the browser tab\n  // is hidden, the page is put in the back/forward cache, or this screen unmounts.\n  // This complements the normal state-change autosave and closes the race where a\n  // fast navigation can happen before the persistence effect gets another turn.\n  const receptionDraftSaveCommittedRef = useRef(false);\n  const receptionDraftV2Ref = useRef<any>(null);\n  const receptionDraftV2Meaningful = Boolean(\n    guestName || guestPhone || guestAltPhone || guestNote || selectedCustomer ||\n    newCustName || newCustPhone || newCustNotes || orderNotes || advancePayment ||\n    workOwnershipType || partnerDeductionRate ||\n    devices.some(d => Boolean(\n      d.type || d.model || d.serialNumber || d.issue || d.accessories ||\n      (d.selectedRepairItems && d.selectedRepairItems.length > 0) || Number(d.estimatedCost) > 0\n    ))\n  );\n\n  receptionDraftV2Ref.current = {\n    savedAt: Date.now(),\n    meaningful: receptionDraftV2Meaningful,\n    receptionCustomerType, guestName, guestPhone, guestAltPhone, guestNote, searchQuery,\n    selectedCustomer, isAddingNewCustomer, newCustName, newCustPhone, newCustType, newCustNotes,\n    devices, orderNotes, advancePayment, workOwnershipType, partnerDeductionRate, warrantyOption, customWarrantyDays\n  };\n\n  if (!receptionDraftV2Meaningful) {\n    receptionDraftSaveCommittedRef.current = false;\n  }\n\n  useEffect(() => {\n    const flushReceptionDraft = () => {\n      if (typeof window === \"undefined\" || receptionDraftSaveCommittedRef.current) return;\n      const snapshot = receptionDraftV2Ref.current;\n      if (!snapshot?.meaningful) return;\n      try {\n        const { meaningful: _meaningful, ...persisted } = snapshot;\n        localStorage.setItem(RECEPTION_DRAFT_STORAGE_KEY, JSON.stringify({ ...persisted, savedAt: Date.now() }));\n      } catch (err) {\n        console.warn(\"تعذر حفظ مسودة استقبال الصيانة محلياً:\", err);\n      }\n    };\n\n    const handleVisibilityChange = () => {\n      if (document.visibilityState === \"hidden\") flushReceptionDraft();\n    };\n    const handlePageHide = () => flushReceptionDraft();\n\n    document.addEventListener(\"visibilitychange\", handleVisibilityChange);\n    window.addEventListener(\"pagehide\", handlePageHide);\n    window.addEventListener(\"beforeunload\", handlePageHide);\n\n    return () => {\n      flushReceptionDraft();\n      document.removeEventListener(\"visibilitychange\", handleVisibilityChange);\n      window.removeEventListener(\"pagehide\", handlePageHide);\n      window.removeEventListener(\"beforeunload\", handlePageHide);\n    };\n  }, []);\n\n  ${marker}`;

    if (!src.includes(marker)) throw new Error('Reception filter marker missing');
    src = src.replace(marker, block);

    const successOld = `      // The order is safely stored in Supabase; the unfinished local draft is no longer needed.\n      if (typeof window !== \"undefined\") {\n        localStorage.removeItem(RECEPTION_DRAFT_STORAGE_KEY);\n      }`;
    const successNew = `      // The order is safely stored in Supabase; prevent unmount/pagehide handlers\n      // from resurrecting the just-completed draft, then remove it.\n      receptionDraftSaveCommittedRef.current = true;\n      if (typeof window !== \"undefined\") {\n        localStorage.removeItem(RECEPTION_DRAFT_STORAGE_KEY);\n      }`;
    src = replaceOnce(src, successOld, successNew, 'completed draft cleanup guard');
  }

  fs.writeFileSync(path, src);
}

// 2) Preserve per-part warranty days whenever selected repair items are rebuilt from usages.
{
  const path = 'src/lib/accountingEngineV2.ts';
  let src = fs.readFileSync(path, 'utf8');

  if (!src.includes('preservedWarrantyDays')) {
    const old = `    const rebuiltItems: SelectedRepairItem[] = deviceUsages.map(pu => {\n      const sellP = getSellingPriceFn ? getSellingPriceFn(pu) : (pu.sellingPrice || pu.unitCost || 0);\n      return {\n        id: pu.id,`;
    const replacement = `    const rebuiltItems: SelectedRepairItem[] = deviceUsages.map(pu => {\n      const sellP = getSellingPriceFn ? getSellingPriceFn(pu) : (pu.sellingPrice || pu.unitCost || 0);\n      const existingSnapshot = existingItems.find(item =>\n        item.usageId === pu.id || item.id === pu.id ||\n        Boolean(item.productId && item.productId === pu.inventoryItemId)\n      );\n      const preservedWarrantyDays = Math.max(0, Number((existingSnapshot as any)?.warrantyDays || 0));\n      return {\n        id: pu.id,`;
    src = replaceOnce(src, old, replacement, 'preserve warranty lookup');

    const oldTail = `        salePrice: sellP,\n        deviceId: device.id,`;
    const newTail = `        salePrice: sellP,\n        warrantyDays: preservedWarrantyDays,\n        deviceId: device.id,`;
    src = replaceOnce(src, oldTail, newTail, 'preserve warranty field');
  }

  fs.writeFileSync(path, src);
}

// 3) Add editable warranty-days column per repair part in the workshop.
{
  const path = 'src/components/RepairCenter.tsx';
  let src = fs.readFileSync(path, 'utf8');

  if (!src.includes('handleUpdatePartWarrantyDays')) {
    const marker = `  // Update Work Ownership Type (شغل المحل / أحمد البنا / عبده)\n`;
    const handler = `  // Set an independent warranty period for one consumed repair part.\n  // The value lives on the order/device item snapshot so different parts on the\n  // same device can have different warranty periods without changing stock data.\n  const handleUpdatePartWarrantyDays = async (usageId: string, deviceIdx: number, rawDays: number) => {\n    if (!selectedOrder) return;\n    if (selectedOrder.status === RepairStatus.Delivered || selectedOrder.deliveryStatus === \"DELIVERED\") {\n      dialog.alert({ message: \"لا يمكن تعديل الضمان بعد تسليم وإغلاق أمر الصيانة.\", variant: \"warning\" });\n      return;\n    }\n\n    const currentDevice = selectedOrder.devices[deviceIdx];\n    if (!currentDevice) return;\n    const usage = partUsages.find(pu => pu.id === usageId);\n    const days = Math.max(0, Math.floor(Number(rawDays) || 0));\n\n    const matchesItem = (item: SelectedRepairItem) =>\n      item.usageId === usageId || item.id === usageId ||\n      Boolean(usage && item.productId && item.productId === usage.inventoryItemId);\n\n    const previousItem = (currentDevice.selectedRepairItems || []).find(matchesItem);\n    const oldDays = Math.max(0, Number((previousItem as any)?.warrantyDays || 0));\n    if (oldDays === days) return;\n\n    const applyWarranty = (items?: SelectedRepairItem[]) => (items || []).map(item =>\n      matchesItem(item) ? ({ ...item, warrantyDays: days } as any) : item\n    );\n\n    const updatedDevices = [...selectedOrder.devices];\n    updatedDevices[deviceIdx] = {\n      ...currentDevice,\n      selectedRepairItems: applyWarranty(currentDevice.selectedRepairItems),\n      technicalProcedures: applyWarranty(currentDevice.technicalProcedures)\n    };\n\n    let updatedOrder: RepairOrder = { ...selectedOrder, devices: updatedDevices };\n    updatedOrder = addAuditLogRecordHelper(\n      updatedOrder,\n      \"CHANGE_WARRANTY\" as any,\n      \`ضمان قطعة \${usage?.partName || previousItem?.name || \"قطعة غيار\"}\`,\n      oldDays > 0 ? \`\${oldDays} يوم\` : \"بدون ضمان محدد\",\n      days > 0 ? \`\${days} يوم\` : \"بدون ضمان محدد\",\n      \"تحديد مدة ضمان مستقلة لقطعة الغيار داخل أمر الصيانة\",\n      currentUserForAction,\n      currentDevice.id\n    );\n\n    setSelectedOrder(updatedOrder);\n    setRepairOrderLocal(updatedOrder);\n    await updateRepairOrder(updatedOrder);\n  };\n\n${marker}`;
    src = replaceOnce(src, marker, handler, 'part warranty handler');
  }

  if (!src.includes('<th className="p-3 text-center">الضمان</th>')) {
    src = replaceOnce(
      src,
      `                                  <th className=\"p-3 text-center\">الكمية</th>\n                                  <th className=\"p-3 text-left font-bold text-emerald-400\">الإجمالي</th>`,
      `                                  <th className=\"p-3 text-center\">الكمية</th>\n                                  <th className=\"p-3 text-center\">الضمان</th>\n                                  <th className=\"p-3 text-left font-bold text-emerald-400\">الإجمالي</th>`,
      'warranty table header'
    );

    src = replaceOnce(
      src,
      `<td colSpan={5} className=\"p-6 text-center text-gray-500 text-xs font-bold\">`,
      `<td colSpan={6} className=\"p-6 text-center text-gray-500 text-xs font-bold\">`,
      'warranty empty colspan'
    );

    const rowAnchor = `                                        <td className=\"p-3 text-left font-mono font-extrabold text-emerald-400 text-xs\">\n                                          {lineTotal.toLocaleString('ar-EG')} ج.م\n                                        </td>`;
    const warrantyCell = `                                        <td className=\"p-3 text-center\">\n                                          <div className=\"inline-flex items-center gap-1 bg-[#181b2a] border border-[#2a2d42] rounded-lg px-2 py-1 focus-within:border-amber-500/70\">\n                                            <input\n                                              type=\"number\"\n                                              min=\"0\"\n                                              step=\"1\"\n                                              defaultValue={Number(((currentDevice.selectedRepairItems || []).find(item => item.usageId === pu.id || item.id === pu.id || Boolean(item.productId && item.productId === pu.inventoryItemId)) as any)?.warrantyDays || 0)}\n                                              disabled={isBusy || selectedOrder.status === RepairStatus.Delivered || selectedOrder.deliveryStatus === \"DELIVERED\"}\n                                              onBlur={(e) => handleUpdatePartWarrantyDays(pu.id, devIdx, Number(e.target.value))}\n                                              onKeyDown={(e) => { if (e.key === \"Enter\") (e.currentTarget as HTMLInputElement).blur(); }}\n                                              className=\"w-14 bg-transparent text-center font-mono font-extrabold text-amber-300 text-xs focus:outline-none disabled:opacity-50\"\n                                              title=\"مدة ضمان القطعة بالأيام - صفر يعني بدون مدة محددة\"\n                                            />\n                                            <span className=\"text-[10px] font-bold text-gray-400 whitespace-nowrap\">يوم</span>\n                                          </div>\n                                        </td>\n\n${rowAnchor}`;
    src = replaceOnce(src, rowAnchor, warrantyCell, 'warranty table cell');
  }

  fs.writeFileSync(path, src);
}

console.log('✓ Hardened reception drafts and per-part workshop warranty enabled');
