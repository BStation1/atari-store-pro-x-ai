import fs from 'node:fs';
import path from 'node:path';

const filePath = path.resolve('src/components/Reception.tsx');
let source = fs.readFileSync(filePath, 'utf8');

if (source.includes('RECEPTION_DRAFT_STORAGE_KEY')) {
  console.log('Reception draft persistence already installed.');
  process.exit(0);
}

source = source.replace(
  'import React, { useState, useMemo } from "react";',
  'import React, { useState, useMemo, useEffect, useRef } from "react";'
);

const propsMarker = `interface ReceptionProps {\n  prefillData?: any;\n  onNavigate?: (view: string, params?: any) => void;\n}\n`;

const draftHelpers = `${propsMarker}\nconst RECEPTION_DRAFT_STORAGE_KEY = "atari_reception_order_draft_v1";\nconst RECEPTION_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;\n\nfunction readReceptionDraft(): any | null {\n  if (typeof window === "undefined") return null;\n  try {\n    const raw = localStorage.getItem(RECEPTION_DRAFT_STORAGE_KEY);\n    if (!raw) return null;\n    const parsed = JSON.parse(raw);\n    const savedAt = Number(parsed?.savedAt || 0);\n    if (!savedAt || Date.now() - savedAt > RECEPTION_DRAFT_MAX_AGE_MS) {\n      localStorage.removeItem(RECEPTION_DRAFT_STORAGE_KEY);\n      return null;\n    }\n    return parsed;\n  } catch {\n    localStorage.removeItem(RECEPTION_DRAFT_STORAGE_KEY);\n    return null;\n  }\n}\n`;

if (!source.includes(propsMarker)) throw new Error('ReceptionProps marker not found');
source = source.replace(propsMarker, draftHelpers);

const stateMarker = `  const [copiedCode, setCopiedCode] = useState(false);\n\n  // Filter customers`;
const persistenceBlock = `  const [copiedCode, setCopiedCode] = useState(false);\n\n  // Keep unfinished reception work safe when the component remounts, the tab is\n  // backgrounded, or the page is refreshed. Supabase remains the source of truth\n  // for completed orders; this local draft is only for unsaved form state.\n  const receptionDraftReadyRef = useRef(false);\n\n  useEffect(() => {\n    const draft = readReceptionDraft();\n    if (draft) {\n      if (draft.receptionCustomerType === "GUEST" || draft.receptionCustomerType === "REGISTERED") {\n        setReceptionCustomerType(draft.receptionCustomerType);\n      }\n      setGuestName(String(draft.guestName || ""));\n      setGuestPhone(String(draft.guestPhone || ""));\n      setGuestAltPhone(String(draft.guestAltPhone || ""));\n      setGuestNote(String(draft.guestNote || ""));\n      setSearchQuery(String(draft.searchQuery || ""));\n      setSelectedCustomer(draft.selectedCustomer || null);\n      setIsAddingNewCustomer(Boolean(draft.isAddingNewCustomer));\n      setNewCustName(String(draft.newCustName || ""));\n      setNewCustPhone(String(draft.newCustPhone || ""));\n      if (draft.newCustType) setNewCustType(draft.newCustType);\n      setNewCustNotes(String(draft.newCustNotes || ""));\n      if (Array.isArray(draft.devices) && draft.devices.length > 0) setDevices(draft.devices);\n      setOrderNotes(String(draft.orderNotes || ""));\n      setAdvancePayment(Number(draft.advancePayment) || 0);\n      setWorkOwnershipType(draft.workOwnershipType || "");\n      setPartnerDeductionRate(Number(draft.partnerDeductionRate) || 0);\n      if (draft.warrantyOption) setWarrantyOption(draft.warrantyOption);\n      setCustomWarrantyDays(Number(draft.customWarrantyDays) || 30);\n    }\n\n    // Delay enabling writes until the restored values have reached React state.\n    const timer = window.setTimeout(() => {\n      receptionDraftReadyRef.current = true;\n    }, 0);\n    return () => window.clearTimeout(timer);\n  }, []);\n\n  useEffect(() => {\n    if (!receptionDraftReadyRef.current || typeof window === "undefined") return;\n\n    const hasDeviceWork = devices.some(d => Boolean(\n      d.type || d.model || d.serialNumber || d.issue || d.accessories ||\n      (d.selectedRepairItems && d.selectedRepairItems.length > 0) || Number(d.estimatedCost) > 0\n    ));\n    const hasMeaningfulDraft = Boolean(\n      guestName || guestPhone || guestAltPhone || guestNote || selectedCustomer ||\n      newCustName || newCustPhone || newCustNotes || orderNotes || advancePayment ||\n      workOwnershipType || partnerDeductionRate || hasDeviceWork\n    );\n\n    if (!hasMeaningfulDraft) {\n      localStorage.removeItem(RECEPTION_DRAFT_STORAGE_KEY);\n      return;\n    }\n\n    localStorage.setItem(RECEPTION_DRAFT_STORAGE_KEY, JSON.stringify({\n      savedAt: Date.now(),\n      receptionCustomerType,\n      guestName,\n      guestPhone,\n      guestAltPhone,\n      guestNote,\n      searchQuery,\n      selectedCustomer,\n      isAddingNewCustomer,\n      newCustName,\n      newCustPhone,\n      newCustType,\n      newCustNotes,\n      devices,\n      orderNotes,\n      advancePayment,\n      workOwnershipType,\n      partnerDeductionRate,\n      warrantyOption,\n      customWarrantyDays\n    }));\n  }, [\n    receptionCustomerType, guestName, guestPhone, guestAltPhone, guestNote, searchQuery,\n    selectedCustomer, isAddingNewCustomer, newCustName, newCustPhone, newCustType, newCustNotes,\n    devices, orderNotes, advancePayment, workOwnershipType, partnerDeductionRate, warrantyOption, customWarrantyDays\n  ]);\n\n  // Filter customers`;

if (!source.includes(stateMarker)) throw new Error('Reception state marker not found');
source = source.replace(stateMarker, persistenceBlock);

const successMarker = `      // Reset Form for next order\n      setGuestName("");`;
const successReplacement = `      // The order is safely stored in Supabase; the unfinished local draft is no longer needed.\n      if (typeof window !== "undefined") {\n        localStorage.removeItem(RECEPTION_DRAFT_STORAGE_KEY);\n      }\n\n      // Reset Form for next order\n      setGuestName("");`;

if (!source.includes(successMarker)) throw new Error('Reception successful-save reset marker not found');
source = source.replace(successMarker, successReplacement);

fs.writeFileSync(filePath, source, 'utf8');
console.log('Reception auto-save draft persistence installed.');
