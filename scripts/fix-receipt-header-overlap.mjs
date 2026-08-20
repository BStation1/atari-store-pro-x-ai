import fs from 'node:fs';

const file = 'src/components/PrintReceiptModal.tsx';
let src = fs.readFileSync(file, 'utf8');

const oldHeader = `            <div className="text-center pb-2 mb-2 border-b-2 border-dashed border-black">\n              <h4 className="text-lg font-bold text-black leading-none">{settings.companyName}</h4>\n              <p className="text-[10px] text-black font-semibold mt-1">مركز صيانة وبيع أجهزة الكونسول والألعاب</p>\n              <p className="text-[10px] text-black mt-0.5">{settings.address}</p>\n              <p className="text-[10px] text-black">\n                هاتف: <PhoneDisplay phone={settings.phone} className="text-[10px]" />\n              </p>\n            </div>`;

const newHeader = `            <div className="receipt-store-header text-center pb-2 mb-2 border-b-2 border-dashed border-black">\n              <h4 className="receipt-store-name text-lg font-bold text-black">{settings.companyName}</h4>\n              <div className="receipt-store-subtitle text-[10px] text-black font-semibold">مركز صيانة وبيع أجهزة الكونسول والألعاب</div>\n              <div className="receipt-store-address text-[10px] text-black">{settings.address}</div>\n              <div className="receipt-store-phone text-[10px] text-black" dir="ltr">\n                <span className="receipt-store-phone-label">هاتف:</span>{' '}\n                <PhoneDisplay phone={settings.phone} className="text-[10px]" />\n              </div>\n            </div>`;

if (!src.includes(oldHeader)) {
  console.error('Receipt header template was not found; refusing silent patch.');
  process.exit(1);
}
src = src.replace(oldHeader, newHeader);

const cssAnchor = `            .rp326-receipt table {`;
const css = `            /* Thermal header: keep Arabic address and LTR phone on independent physical lines. */\n            .rp326-receipt .receipt-store-header {\n              display: block !important;\n              width: 100% !important;\n              text-align: center !important;\n              direction: rtl !important;\n              line-height: 1.65 !important;\n              padding-bottom: 2mm !important;\n              margin-bottom: 2mm !important;\n            }\n\n            .rp326-receipt .receipt-store-header > * {\n              display: block !important;\n              width: 100% !important;\n              max-width: 100% !important;\n              clear: both !important;\n              position: static !important;\n              float: none !important;\n              transform: none !important;\n              margin-left: 0 !important;\n              margin-right: 0 !important;\n            }\n\n            .rp326-receipt .receipt-store-name {\n              line-height: 1.35 !important;\n              margin: 0 0 1mm 0 !important;\n            }\n\n            .rp326-receipt .receipt-store-subtitle {\n              line-height: 1.6 !important;\n              margin: 0 0 0.8mm 0 !important;\n            }\n\n            .rp326-receipt .receipt-store-address {\n              line-height: 1.7 !important;\n              margin: 0 0 1.2mm 0 !important;\n              padding: 0 0.5mm !important;\n              direction: rtl !important;\n              unicode-bidi: plaintext !important;\n            }\n\n            .rp326-receipt .receipt-store-phone {\n              display: block !important;\n              direction: ltr !important;\n              unicode-bidi: isolate !important;\n              text-align: center !important;\n              white-space: nowrap !important;\n              line-height: 1.8 !important;\n              min-height: 5mm !important;\n              margin: 0.8mm 0 0 0 !important;\n              padding-top: 0.5mm !important;\n            }\n\n            .rp326-receipt .receipt-store-phone span {\n              display: inline-block !important;\n              width: auto !important;\n              min-width: 0 !important;\n              white-space: nowrap !important;\n              line-height: 1.8 !important;\n              vertical-align: baseline !important;\n            }\n\n`;

if (!src.includes(cssAnchor)) {
  console.error('Receipt print CSS anchor was not found; refusing silent patch.');
  process.exit(1);
}
src = src.replace(cssAnchor, css + cssAnchor);

fs.writeFileSync(file, src);
console.log('Applied thermal receipt header overlap fix.');
