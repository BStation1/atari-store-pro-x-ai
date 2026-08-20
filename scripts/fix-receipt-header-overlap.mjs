import fs from 'node:fs';

const file = 'src/components/PrintReceiptModal.tsx';
let src = fs.readFileSync(file, 'utf8');

const oldHeader = `            <div className="text-center pb-2 mb-2 border-b-2 border-dashed border-black">\n              <h4 className="text-lg font-bold text-black leading-none">{settings.companyName}</h4>\n              <p className="text-[10px] text-black font-semibold mt-1">مركز صيانة وبيع أجهزة الكونسول والألعاب</p>\n              <p className="text-[10px] text-black mt-0.5">{settings.address}</p>\n              <p className="text-[10px] text-black">\n                هاتف: <PhoneDisplay phone={settings.phone} className="text-[10px]" />\n              </p>\n            </div>`;

const headerWithPhone = `            <div className="receipt-store-header text-center pb-2 mb-2 border-b-2 border-dashed border-black">\n              <h4 className="receipt-store-name text-lg font-bold text-black">{settings.companyName}</h4>\n              <div className="receipt-store-subtitle text-[10px] text-black font-semibold">مركز صيانة وبيع أجهزة الكونسول والألعاب</div>\n              <div className="receipt-store-address text-[10px] text-black">{settings.address}</div>\n              <div className="receipt-store-phone text-[10px] text-black" dir="ltr">\n                <span className="receipt-store-phone-label">هاتف:</span>{' '}\n                <PhoneDisplay phone={settings.phone} className="text-[10px]" />\n              </div>\n            </div>`;

const headerWithoutPhone = `            <div className="receipt-store-header text-center pb-2 mb-2 border-b-2 border-dashed border-black">\n              <h4 className="receipt-store-name text-lg font-bold text-black">{settings.companyName}</h4>\n              <div className="receipt-store-subtitle text-[10px] text-black font-semibold">مركز صيانة وبيع أجهزة الكونسول والألعاب</div>\n              <div className="receipt-store-address text-[10px] text-black">{settings.address}</div>\n            </div>`;

if (src.includes(oldHeader)) src = src.replace(oldHeader, headerWithoutPhone);
if (src.includes(headerWithPhone)) src = src.replace(headerWithPhone, headerWithoutPhone);

const printAnchor = `    copyComputedStyles(source, printableReceipt);`;
const rebuild = `    copyComputedStyles(source, printableReceipt);\n\n    // Rebuild the thermal header from scratch AFTER computed styles are copied.\n    // The receipt intentionally omits the store phone number.\n    const thermalHeader = printableReceipt.querySelector<HTMLElement>(\".receipt-store-header\");\n    if (thermalHeader) {\n      thermalHeader.replaceChildren();\n      thermalHeader.removeAttribute(\"class\");\n      thermalHeader.className = \"receipt-store-header\";\n      thermalHeader.style.cssText = [\n        \"display:block\", \"width:100%\", \"height:auto\", \"min-height:0\",\n        \"padding:0 0 2.5mm 0\", \"margin:0 0 2mm 0\", \"border-bottom:2px dashed #000\",\n        \"text-align:center\", \"direction:rtl\", \"font-family:Tahoma,Arial,sans-serif\",\n        \"color:#000\", \"overflow:visible\", \"box-sizing:border-box\"\n      ].join(\" !important;\") + \" !important;\";\n\n      const addHeaderLine = (text: string, fontSize: string, fontWeight: string, direction: \"rtl\" | \"ltr\" = \"rtl\", marginBottom = \"1mm\") => {\n        const line = document.createElement(\"div\");\n        line.textContent = text || \"\";\n        line.dir = direction;\n        line.style.cssText = [\n          \"display:block\", \"position:static\", \"float:none\", \"clear:both\",\n          \"width:100%\", \"height:auto\", \"min-height:0\", \"max-width:100%\",\n          \`font-size:\${fontSize}\`, \`font-weight:\${fontWeight}\`, \"line-height:1.75\",\n          \`direction:\${direction}\`, \"unicode-bidi:isolate\", \"text-align:center\",\n          \`margin:0 0 \${marginBottom} 0\`, \"padding:0\", \"white-space:normal\",\n          \"overflow:visible\", \"overflow-wrap:anywhere\", \"box-sizing:border-box\"\n        ].join(\" !important;\") + \" !important;\";\n        thermalHeader.appendChild(line);\n      };\n\n      addHeaderLine(settings.companyName || \"Atari Store\", \"18px\", \"700\", \"ltr\", \"1mm\");\n      addHeaderLine(\"مركز صيانة وبيع أجهزة الكونسول والألعاب\", \"11px\", \"700\", \"rtl\", \"1mm\");\n      if (settings.address) addHeaderLine(settings.address, \"10px\", \"600\", \"rtl\", \"0\");\n    }`;

const oldRebuildStart = '    // Rebuild the thermal header from scratch AFTER computed styles are copied.';
if (src.includes(oldRebuildStart)) {
  const start = src.indexOf(oldRebuildStart);
  const before = src.slice(0, start);
  const afterStart = src.slice(start);
  const endMarker = '\n\n  const origin = typeof window !== "undefined" ? window.location.origin : "";';
  const end = afterStart.indexOf(endMarker);
  if (end !== -1) {
    src = before + rebuild.split('    copyComputedStyles(source, printableReceipt);\\n\\n')[1].replace(/\\n/g, '\n') + afterStart.slice(end);
  }
} else if (src.includes(printAnchor)) {
  src = src.replace(printAnchor, rebuild);
}

const cssAnchor = `            .rp326-receipt table {`;
const css = `            .rp326-receipt .receipt-store-header {\n              display: block !important;\n              width: 100% !important;\n              height: auto !important;\n              min-height: 0 !important;\n              overflow: visible !important;\n              break-inside: avoid !important;\n              page-break-inside: avoid !important;\n            }\n\n`;
if (!src.includes(css) && src.includes(cssAnchor)) src = src.replace(cssAnchor, css + cssAnchor);

fs.writeFileSync(file, src);
console.log('Applied thermal receipt header without phone number.');
