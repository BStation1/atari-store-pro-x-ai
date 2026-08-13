import fs from 'node:fs';

const file = 'src/components/PrintReceiptModal.tsx';
let source = fs.readFileSync(file, 'utf8');

const replacements = [
  [
    '<span>المدفوع مقدمًا / نقداً:</span>',
    '<span>المدفوع مقدمًا:</span>'
  ],
  [
    '<div className="space-y-1 text-[11px] text-black">\n              {discount > 0 && (',
    '<div className="receipt-summary space-y-1 text-[11px] text-black">\n              {discount > 0 && ('
  ],
  [
    '<div className="flex justify-between font-bold text-sm">\n                <span>سعر الصيانة المتفق عليه:</span>',
    '<div className="receipt-money-row flex justify-between font-bold text-sm">\n                <span>سعر الصيانة المتفق عليه:</span>'
  ],
  [
    '<div className="flex justify-between text-black font-semibold">\n                <span>المدفوع مقدمًا:</span>',
    '<div className="receipt-money-row flex justify-between text-black font-semibold">\n                <span>المدفوع مقدمًا:</span>'
  ],
  [
    '<div className="flex justify-between text-black font-bold">\n                <span>المتبقي المطلوب:</span>',
    '<div className="receipt-money-row flex justify-between text-black font-bold">\n                <span>المتبقي المطلوب:</span>'
  ]
];

for (const [from, to] of replacements) {
  if (source.includes(from)) source = source.replace(from, to);
}

const cssAnchor = `            .rp326-receipt table {`;
const cssPatch = `            /* Keep payment summary labels and values in separate fixed columns on RP326. */\n            .rp326-receipt .receipt-summary .receipt-money-row {\n              display: grid !important;\n              grid-template-columns: minmax(0, 1fr) 19mm !important;\n              column-gap: 2mm !important;\n              align-items: center !important;\n              width: 100% !important;\n              line-height: 1.55 !important;\n              margin-bottom: 0.8mm !important;\n            }\n\n            .rp326-receipt .receipt-summary .receipt-money-row > span:first-child {\n              grid-column: 1 !important;\n              text-align: right !important;\n              white-space: nowrap !important;\n              overflow-wrap: normal !important;\n              word-break: normal !important;\n            }\n\n            .rp326-receipt .receipt-summary .receipt-money-row > span:last-child {\n              grid-column: 2 !important;\n              text-align: left !important;\n              white-space: nowrap !important;\n              overflow-wrap: normal !important;\n              word-break: normal !important;\n            }\n\n`;

if (!source.includes('receipt-summary .receipt-money-row')) {
  if (!source.includes(cssAnchor)) throw new Error('Print CSS anchor not found');
  source = source.replace(cssAnchor, cssPatch + cssAnchor);
}

fs.writeFileSync(file, source);
console.log('Applied RP326 payment summary layout patch');
