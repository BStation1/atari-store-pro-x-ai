import fs from 'node:fs';
import path from 'node:path';

const inventoryPath = path.resolve('src/components/Inventory.tsx');
let source = fs.readFileSync(inventoryPath, 'utf8');

const replacements = [
  ['{products.length} أصناف', '{filteredProducts.length} أصناف'],
  ['{products.filter(p => p.quantity <= p.minStock && p.quantity > 0).length} صنفاً', '{filteredProducts.filter(p => p.quantity <= p.minStock && p.quantity > 0).length} صنفاً'],
  ['{products.filter(p => p.quantity === 0).length} صنفاً', '{filteredProducts.filter(p => p.quantity === 0).length} صنفاً'],
  ['{products.reduce((acc, p) => acc + (p.purchasePrice * p.quantity), 0).toLocaleString()} ج.م', '{filteredProducts.reduce((acc, p) => acc + (p.purchasePrice * p.quantity), 0).toLocaleString()} ج.م'],
];

let changed = false;
for (const [from, to] of replacements) {
  if (source.includes(from)) {
    source = source.replace(from, to);
    changed = true;
  }
}

if (changed) {
  fs.writeFileSync(inventoryPath, source, 'utf8');
  console.log('Inventory statistics now follow the exact filtered product list.');
} else {
  console.log('Inventory statistics patch already applied.');
}

const receiptPath = path.resolve('src/components/PrintReceiptModal.tsx');
let receipt = fs.readFileSync(receiptPath, 'utf8');

// Keep the on-screen preview monochrome too.
const previewReplacements = [
  ['text-[10px] text-gray-700 font-medium mt-1', 'text-[10px] text-black font-semibold mt-1'],
  ['text-[10px] text-gray-600 mt-0.5', 'text-[10px] text-black mt-0.5'],
  ['text-[10px] text-gray-600">\n                هاتف:', 'text-[10px] text-black">\n                هاتف:'],
  ['border-b border-gray-100', 'border-b border-black'],
  ['text-[9px] text-gray-700 leading-snug', 'text-[9px] text-black leading-snug'],
  ['text-[9px] text-indigo-900 mt-0.5', 'text-[9px] text-black mt-0.5'],
  ['flex justify-between text-gray-700', 'flex justify-between text-black'],
  ['flex justify-between text-green-700 font-medium', 'flex justify-between text-black font-semibold'],
  ['flex justify-between text-red-700 font-bold', 'flex justify-between text-black font-bold'],
  ['text-[9px] text-gray-600 font-bold mb-1', 'text-[9px] text-black font-bold mb-1'],
  ['text-[8px] text-gray-500 mt-1 font-mono', 'text-[8px] text-black mt-1 font-mono'],
  ['text-center text-[9px] text-gray-700 border-t', 'text-center text-[9px] text-black border-t'],
];

for (const [from, to] of previewReplacements) {
  if (receipt.includes(from)) receipt = receipt.split(from).join(to);
}

const handleStart = receipt.indexOf('  const handlePrint = () => {');
const handleEnd = receipt.indexOf('  const origin = ', handleStart);

if (handleStart === -1 || handleEnd === -1) {
  throw new Error('PrintReceiptModal handlePrint block not found');
}

const newHandlePrint = String.raw`  const handlePrint = () => {
    const source = printAreaRef.current;
    if (!source) return;

    // IMPORTANT: do not copy computed styles from the preview. Chrome turns
    // those pixel heights/widths into fixed printer-dot sizes, which caused
    // Arabic lines to overlap and the left side to be clipped on the RP326.
    const printableReceipt = source.cloneNode(true) as HTMLElement;
    printableReceipt.className = "rp326-receipt";
    printableReceipt.removeAttribute("style");
    printableReceipt.querySelectorAll<HTMLElement>("*").forEach(element => {
      element.removeAttribute("style");
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
    printDocument.write(\`
      <!doctype html>
      <html dir="ltr">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>إيصال \${order?.id || invoice?.id || "receipt"}</title>
          <style>
            /* Let the selected RONGTA/RP326 driver supply the actual 80mm page.
               Forcing "80mm auto" here made Chrome calculate the wrong canvas. */
            @page { margin: 0 !important; }

            html, body {
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
              min-width: 0 !important;
              background: #fff !important;
              color: #000 !important;
              overflow: visible !important;
            }

            body { direction: ltr !important; }

            #rp326-print-root {
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #fff !important;
            }

            .rp326-receipt {
              direction: rtl !important;
              box-sizing: border-box !important;
              width: auto !important;
              min-width: 0 !important;
              max-width: none !important;
              /* Extra physical safety on the left because this specific driver
                 shifts output toward the cutter's left edge. */
              margin-left: 11mm !important;
              margin-right: 3mm !important;
              padding: 2mm 1.5mm !important;
              background: #fff !important;
              color: #000 !important;
              font-family: Tahoma, Arial, sans-serif !important;
              font-size: 10.5px !important;
              font-weight: 600 !important;
              line-height: 1.5 !important;
              text-align: right !important;
              overflow: visible !important;
            }

            .rp326-receipt,
            .rp326-receipt * {
              box-sizing: border-box !important;
              color: #000 !important;
              opacity: 1 !important;
              text-shadow: none !important;
              filter: none !important;
              font-family: Tahoma, Arial, sans-serif !important;
              line-height: 1.5 !important;
              white-space: normal !important;
              overflow-wrap: break-word !important;
              word-break: normal !important;
              min-width: 0 !important;
              max-width: 100% !important;
            }

            .rp326-receipt .font-bold,
            .rp326-receipt .font-semibold { font-weight: 700 !important; }
            .rp326-receipt .font-medium { font-weight: 600 !important; }
            .rp326-receipt .text-center { text-align: center !important; }
            .rp326-receipt .text-right { text-align: right !important; }
            .rp326-receipt .text-left { text-align: left !important; }
            .rp326-receipt .font-mono {
              font-family: Tahoma, Arial, sans-serif !important;
              direction: ltr !important;
              unicode-bidi: isolate !important;
            }

            .rp326-receipt > div:first-child {
              text-align: center !important;
              border-bottom: 1.2px dashed #000 !important;
              padding-bottom: 2mm !important;
              margin-bottom: 2mm !important;
            }
            .rp326-receipt > div:first-child h4 {
              margin: 0 0 1mm 0 !important;
              font-size: 18px !important;
              line-height: 1.2 !important;
              font-weight: 700 !important;
            }
            .rp326-receipt > div:first-child p {
              margin: .5mm 0 0 0 !important;
              font-size: 10px !important;
              line-height: 1.4 !important;
              font-weight: 600 !important;
            }

            /* Data/financial rows use grid only at print time. No fixed heights. */
            .rp326-receipt .flex.justify-between {
              display: grid !important;
              grid-template-columns: minmax(0, 40%) minmax(0, 60%) !important;
              column-gap: 2mm !important;
              row-gap: 0 !important;
              align-items: start !important;
              width: 100% !important;
              height: auto !important;
              min-height: 0 !important;
              margin: 0 0 .8mm 0 !important;
            }
            .rp326-receipt .flex.justify-between > * {
              width: auto !important;
              height: auto !important;
              min-height: 0 !important;
              position: static !important;
              transform: none !important;
            }
            .rp326-receipt .flex.justify-between > :first-child {
              grid-column: 1 !important;
              text-align: right !important;
            }
            .rp326-receipt .flex.justify-between > :last-child {
              grid-column: 2 !important;
              text-align: left !important;
            }

            .rp326-receipt [class~="border-t"] {
              border-top: 1px dashed #000 !important;
              height: 0 !important;
              margin: 2mm 0 !important;
            }

            .rp326-receipt table {
              direction: rtl !important;
              width: 100% !important;
              table-layout: fixed !important;
              border-collapse: collapse !important;
              margin: 1mm 0 !important;
              font-size: 10px !important;
            }
            .rp326-receipt th,
            .rp326-receipt td {
              height: auto !important;
              padding: 1mm .6mm !important;
              color: #000 !important;
              vertical-align: top !important;
              white-space: normal !important;
              overflow-wrap: break-word !important;
              border-bottom: 1px solid #000 !important;
            }
            .rp326-receipt th { font-weight: 700 !important; }
            .rp326-receipt th:nth-child(1),
            .rp326-receipt td:nth-child(1) { width: 58% !important; text-align: right !important; }
            .rp326-receipt th:nth-child(2),
            .rp326-receipt td:nth-child(2) { width: 16% !important; text-align: center !important; }
            .rp326-receipt th:nth-child(3),
            .rp326-receipt td:nth-child(3) { width: 26% !important; text-align: left !important; }

            .rp326-receipt .text-sm { font-size: 12px !important; }
            .rp326-receipt .text-\\[11px\\] { font-size: 10.5px !important; }
            .rp326-receipt .text-\\[10px\\] { font-size: 10px !important; }
            .rp326-receipt .text-\\[9px\\] { font-size: 9.5px !important; }
            .rp326-receipt .text-\\[8px\\] { font-size: 9px !important; }

            .rp326-receipt .flex.flex-col.items-center {
              display: block !important;
              text-align: center !important;
              padding: 2mm 0 !important;
            }
            .rp326-receipt img {
              display: block !important;
              width: 22mm !important;
              height: 22mm !important;
              max-width: 22mm !important;
              max-height: 22mm !important;
              margin: 1mm auto !important;
              padding: .8mm !important;
              border: 1px solid #000 !important;
              background: #fff !important;
              opacity: 1 !important;
              filter: grayscale(1) contrast(1.35) !important;
            }

            .rp326-receipt > div:last-child {
              border-top: 1px dashed #000 !important;
              padding-top: 2mm !important;
              margin-top: 1mm !important;
              text-align: center !important;
              font-size: 9.5px !important;
            }
          </style>
        </head>
        <body><div id="rp326-print-root"></div></body>
      </html>
    \`);
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
        const images = Array.from(printDocument.images);
        await Promise.all(images.map(img => img.complete ? Promise.resolve() : new Promise<void>(resolve => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })));
        await new Promise(resolve => window.setTimeout(resolve, 180));
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

`;

receipt = receipt.slice(0, handleStart) + newHandlePrint + receipt.slice(handleEnd);
fs.writeFileSync(receiptPath, receipt, 'utf8');
console.log('RP326 print layout rebuilt: no copied fixed pixel sizes, black-only, safe left margin.');
