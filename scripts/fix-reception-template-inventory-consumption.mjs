import fs from 'node:fs';

const path = 'src/components/Reception.tsx';
let src = fs.readFileSync(path, 'utf8');

function replaceOnce(from, to, label) {
  if (src.includes(to)) return;
  if (!src.includes(from)) throw new Error(`Reception inventory patch failed: ${label}`);
  src = src.replace(from, to);
}

replaceOnce(
`  useRepairTemplates\n} from "../hooks/useData";`,
`  useRepairTemplates,\n  useProducts\n} from "../hooks/useData";`,
'useProducts hook import'
);

replaceOnce(
`import { sendRepairNotificationWorkflow } from "../lib/whatsapp";`,
`import { sendRepairNotificationWorkflow } from "../lib/whatsapp";\nimport { executeAddPartUsageTransaction } from "../lib/repairPartAddService";\nimport { db } from "../lib/db";`,
'inventory consumption imports'
);

replaceOnce(
`  const { repairTemplates } = useRepairTemplates();`,
`  const { repairTemplates } = useRepairTemplates();\n  const { products } = useProducts();`,
'products hook'
);

replaceOnce(
`    // Work Ownership Validation (Required)\n    if (!workOwnershipType) {\n      setValidationError("يرجى تحديد ملكية العمل (شغل المحل / شغل أحمد / شغل عبده) قبل حفظ الطلب.");\n      return;\n    }\n\n    setIsSubmitting(true);`,
`    // Work Ownership Validation (Required)\n    if (!workOwnershipType) {\n      setValidationError("يرجى تحديد ملكية العمل (شغل المحل / شغل أحمد / شغل عبده) قبل حفظ الطلب.");\n      return;\n    }\n\n    // Validate every template item that is linked to real inventory before creating the order.\n    // Items without productId are service-only and do not affect stock.\n    const requestedByProduct = new Map<string, { product: any; qty: number; label: string }>();\n    for (const dev of devices) {\n      for (const item of (dev.selectedRepairItems || [])) {\n        if (!item.productId) continue;\n        const product = products.find((p: any) =>\n          String(p.id) === String(item.productId) ||\n          String(p.uuid || "") === String(item.productId) ||\n          String(p.sku || "") === String(item.productId) ||\n          String(p.barcode || "") === String(item.productId)\n        );\n        if (!product) {\n          setValidationError(\`بند الصيانة "\${item.name}" مربوط بمنتج غير موجود في المخزون. راجع ربط قالب الصيانة بالمخزون.\`);\n          return;\n        }\n        const key = String(product.uuid || product.id);\n        const current = requestedByProduct.get(key);\n        requestedByProduct.set(key, {\n          product,\n          qty: (current?.qty || 0) + Math.max(1, Number(item.quantity) || 1),\n          label: item.name || product.nameAr || product.name\n        });\n      }\n    }\n\n    for (const { product, qty, label } of requestedByProduct.values()) {\n      const available = Number(product.quantity || 0);\n      if (available < qty) {\n        setValidationError(\`المخزون غير كافٍ لبند "\${label}". المطلوب: \${qty} - المتاح: \${available}.\`);\n        return;\n      }\n    }\n\n    setIsSubmitting(true);`,
'inventory preflight'
);

replaceOnce(
`      const createdOrder = await addRepairOrder({`,
`      let createdOrder = await addRepairOrder({`,
'mutable created order'
);

replaceOnce(
`      console.log("=== Reception: After Supabase insert ===");\n      console.log("=== Reception: Returned order ===", createdOrder);`,
`      // Convert linked template items into real workshop part usages and stock movements.\n      // The existing transaction service safely creates repair_part_usages, records\n      // REPAIR_USAGE, deducts stock, and writes usageId back to the proper device.\n      let workingProducts = products;\n      let workingPartUsages = db.getRepairPartUsages();\n      const inventoryConsumptionErrors: string[] = [];\n\n      for (let deviceIdx = 0; deviceIdx < createdOrder.devices.length; deviceIdx++) {\n        const device = createdOrder.devices[deviceIdx];\n        const linkedItems = (device.selectedRepairItems || device.technicalProcedures || [])\n          .filter((item: any) => Boolean(item.productId) && !item.usageId);\n\n        for (const item of linkedItems) {\n          const product = workingProducts.find((p: any) =>\n            String(p.id) === String(item.productId) ||\n            String(p.uuid || "") === String(item.productId) ||\n            String(p.sku || "") === String(item.productId) ||\n            String(p.barcode || "") === String(item.productId)\n          );\n\n          if (!product) {\n            inventoryConsumptionErrors.push(\`\${item.name}: المنتج المرتبط غير موجود\`);\n            continue;\n          }\n\n          const productForUsage = {\n            ...product,\n            // Preserve the reception template's customer price while using the\n            // actual inventory product identity and purchase cost.\n            sellPrice: Number(item.repairPrice || item.salePrice || product.sellPrice || 0)\n          };\n\n          const result = await executeAddPartUsageTransaction({\n            product: productForUsage,\n            deviceIdx,\n            qty: Math.max(1, Number(item.quantity) || 1),\n            selectedOrder: createdOrder,\n            products: workingProducts,\n            partUsages: workingPartUsages\n          });\n\n          if (!result.success || !result.updatedOrder) {\n            inventoryConsumptionErrors.push(\`\${item.name}: \${result.error || "تعذر صرف القطعة"}\`);\n            continue;\n          }\n\n          createdOrder = result.updatedOrder;\n          workingProducts = result.updatedProducts || workingProducts;\n          workingPartUsages = result.updatedPartUsages || workingPartUsages;\n        }\n      }\n\n      if (inventoryConsumptionErrors.length > 0) {\n        console.error("Reception inventory consumption errors:", inventoryConsumptionErrors);\n        await dialog.alert({\n          title: "تم إنشاء الأوردر مع وجود مشكلة في صرف بعض القطع",\n          message: inventoryConsumptionErrors.join("\\n"),\n          variant: "warning"\n        });\n      }\n\n      console.log("=== Reception: After Supabase insert + inventory consumption ===");\n      console.log("=== Reception: Returned order ===", createdOrder);`,
'consume linked template inventory after save'
);

fs.writeFileSync(path, src);
console.log('✓ Reception template inventory consumption patch applied');
