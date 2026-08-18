import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Bug, CheckCircle2, Gamepad2, Info, RotateCcw, Save, ShieldAlert, Usb, X, Zap } from "lucide-react";

type Tab = "calibration" | "info" | "debug";
type StickState = { lx: number; ly: number; rx: number; ry: number; l2: number; r2: number };
type ControllerInfo = { label: string; value: string };

const SONY_VENDOR_ID = 0x054c;
const SUPPORTED = [
  { vendorId: SONY_VENDOR_ID, productId: 0x05c4 },
  { vendorId: SONY_VENDOR_ID, productId: 0x09cc },
  { vendorId: SONY_VENDOR_ID, productId: 0x0ce6 },
  { vendorId: SONY_VENDOR_ID, productId: 0x0df2 },
  { vendorId: SONY_VENDOR_ID, productId: 0x0e45 },
  { vendorId: SONY_VENDOR_ID, productId: 0x0e46 },
];

const MODEL_NAMES: Record<number, string> = {
  0x05c4: "Sony DualShock 4 V1",
  0x09cc: "Sony DualShock 4 V2",
  0x0ce6: "Sony DualSense",
  0x0df2: "Sony DualSense Edge",
  0x0e45: "PlayStation VR2 Sense Left",
  0x0e46: "PlayStation VR2 Sense Right",
};

const initialStick: StickState = { lx: 0, ly: 0, rx: 0, ry: 0, l2: 0, r2: 0 };

function signedAxis(v: number) {
  return Math.max(-1, Math.min(1, (v - 127.5) / 127.5));
}

function hex(v: number, width = 4) {
  return `0x${v.toString(16).toUpperCase().padStart(width, "0")}`;
}

function decodeAscii(buffer: ArrayBuffer, start: number, len: number) {
  return new TextDecoder().decode(buffer.slice(start, start + len)).replace(/\0/g, "").trim();
}

function StickDial({ x, y, zoom = 1 }: { x: number; y: number; zoom?: number }) {
  const px = Math.max(-1, Math.min(1, x * zoom)) * 42;
  const py = Math.max(-1, Math.min(1, y * zoom)) * 42;
  return (
    <div className="relative w-28 h-28 rounded-full border border-[#3d4663] bg-[#070a13] overflow-hidden">
      <div className="absolute left-1/2 top-0 h-full w-px bg-[#2d354c]" />
      <div className="absolute top-1/2 left-0 w-full h-px bg-[#2d354c]" />
      <div className="absolute inset-[12%] rounded-full border border-dashed border-[#29324a]" />
      <div className="absolute left-1/2 top-1/2 w-3 h-3 rounded-full bg-indigo-400 border border-white shadow-[0_0_10px_rgba(129,140,248,.9)] -ml-1.5 -mt-1.5" style={{ transform: `translate(${px}px, ${py}px)` }} />
    </div>
  );
}

function ControllerDrawing({ stick, buttons }: { stick: StickState; buttons: Set<string> }) {
  const on = (name: string) => buttons.has(name);
  const face = (name: string, cx: number, cy: number, text: string) => (
    <g>
      <circle cx={cx} cy={cy} r="15" fill={on(name) ? "#5b5cf6" : "#111827"} stroke={on(name) ? "#a5b4fc" : "#65708d"} strokeWidth="2" />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize="11" fill={on(name) ? "white" : "#d1d5db"}>{text}</text>
    </g>
  );
  const dpadFill = (name: string) => on(name) ? "#5b5cf6" : "#111827";
  const leftStickX = 245 + stick.lx * 8, leftStickY = 250 + stick.ly * 8;
  const rightStickX = 355 + stick.rx * 8, rightStickY = 250 + stick.ry * 8;
  return (
    <svg viewBox="0 0 600 370" className="w-full max-w-[540px] mx-auto select-none" aria-label="DualSense controller test">
      <path d="M137 88 C175 60 227 55 300 55 C373 55 425 60 463 88 C487 106 492 139 485 174 L465 292 C458 332 420 347 397 317 L354 263 C337 270 319 274 300 274 C281 274 263 270 246 263 L203 317 C180 347 142 332 135 292 L115 174 C108 139 113 106 137 88 Z" fill="#0f1422" stroke="#68738f" strokeWidth="3" />
      <rect x="225" y="83" width="150" height="68" rx="14" fill="#080b13" stroke="#59637d" strokeWidth="2" />
      <path d="M177 55 C178 37 188 30 207 31 L240 34 L240 57" fill="#111827" stroke="#68738f" strokeWidth="2" />
      <path d="M423 55 C422 37 412 30 393 31 L360 34 L360 57" fill="#111827" stroke="#68738f" strokeWidth="2" />
      <rect x="180" y="41" width="66" height="10" rx="5" fill={on("l2") ? "#5b5cf6" : "#111827"} stroke="#65708d" />
      <rect x="354" y="41" width="66" height="10" rx="5" fill={on("r2") ? "#5b5cf6" : "#111827"} stroke="#65708d" />
      <text x="213" y="28" textAnchor="middle" fontSize="10" fill="#94a3b8">L2 {Math.round(stick.l2 * 100)}%</text>
      <text x="387" y="28" textAnchor="middle" fontSize="10" fill="#94a3b8">R2 {Math.round(stick.r2 * 100)}%</text>
      <circle cx="189" cy="158" r="15" fill={dpadFill("up")} stroke="#65708d" /><text x="189" y="162" textAnchor="middle" fill="#fff">▲</text>
      <circle cx="189" cy="216" r="15" fill={dpadFill("down")} stroke="#65708d" /><text x="189" y="221" textAnchor="middle" fill="#fff">▼</text>
      <circle cx="160" cy="187" r="15" fill={dpadFill("left")} stroke="#65708d" /><text x="160" y="191" textAnchor="middle" fill="#fff">◀</text>
      <circle cx="218" cy="187" r="15" fill={dpadFill("right")} stroke="#65708d" /><text x="218" y="191" textAnchor="middle" fill="#fff">▶</text>
      {face("triangle", 411, 158, "△")}{face("cross", 411, 216, "×")}{face("square", 382, 187, "□")}{face("circle", 440, 187, "○")}
      <circle cx={leftStickX} cy={leftStickY} r="25" fill="#0a0d16" stroke={on("l3") ? "#818cf8" : "#59637d"} strokeWidth="4" />
      <circle cx={rightStickX} cy={rightStickY} r="25" fill="#0a0d16" stroke={on("r3") ? "#818cf8" : "#59637d"} strokeWidth="4" />
      <rect x="251" y="162" width="38" height="18" rx="9" fill={on("create") ? "#5b5cf6" : "#111827"} stroke="#65708d" /><text x="270" y="175" textAnchor="middle" fontSize="8" fill="#d1d5db">CREATE</text>
      <rect x="311" y="162" width="38" height="18" rx="9" fill={on("options") ? "#5b5cf6" : "#111827"} stroke="#65708d" /><text x="330" y="175" textAnchor="middle" fontSize="8" fill="#d1d5db">OPTIONS</text>
      <circle cx="300" cy="207" r="14" fill={on("ps") ? "#5b5cf6" : "#111827"} stroke="#65708d" /><text x="300" y="211" textAnchor="middle" fontSize="8" fill="#d1d5db">PS</text>
      <rect x="282" y="232" width="36" height="15" rx="7" fill={on("mute") ? "#5b5cf6" : "#111827"} stroke="#65708d" /><text x="300" y="243" textAnchor="middle" fontSize="8" fill="#d1d5db">MUTE</text>
    </svg>
  );
}

export default function GamepadTester() {
  const [tab, setTab] = useState<Tab>("calibration");
  const [device, setDevice] = useState<any>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [stick, setStick] = useState<StickState>(initialStick);
  const [buttons, setButtons] = useState<Set<string>>(new Set());
  const [controllerInfo, setControllerInfo] = useState<ControllerInfo[]>([]);
  const [showAllInfo, setShowAllInfo] = useState(false);
  const [quickTest, setQuickTest] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [circularity, setCircularity] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [nvsStatus, setNvsStatus] = useState<string>("Unknown");
  const [rangeCapturing, setRangeCapturing] = useState(false);
  const inputRef = useRef<(ev: any) => void>();

  const hidSupported = typeof navigator !== "undefined" && "hid" in navigator;
  const modelName = device ? (MODEL_NAMES[device.productId] || device.productName || "PlayStation Controller") : "";
  const isDs5 = device?.productId === 0x0ce6 || device?.productId === 0x0df2;
  const driftL = Math.sqrt(stick.lx * stick.lx + stick.ly * stick.ly) * 100;
  const driftR = Math.sqrt(stick.rx * stick.rx + stick.ry * stick.ry) * 100;

  const parseDs5Input = (view: DataView) => {
    if (view.byteLength < 10) return;
    const next: StickState = {
      lx: signedAxis(view.getUint8(0)), ly: signedAxis(view.getUint8(1)),
      rx: signedAxis(view.getUint8(2)), ry: signedAxis(view.getUint8(3)),
      l2: view.getUint8(4) / 255, r2: view.getUint8(5) / 255,
    };
    const b = new Set<string>();
    const dpad = view.getUint8(7) & 0x0f;
    if ([7,0,1].includes(dpad)) b.add("up"); if ([1,2,3].includes(dpad)) b.add("right");
    if ([3,4,5].includes(dpad)) b.add("down"); if ([5,6,7].includes(dpad)) b.add("left");
    const b7 = view.getUint8(7), b8 = view.getUint8(8), b9 = view.getUint8(9);
    if (b7 & 0x10) b.add("square"); if (b7 & 0x20) b.add("cross"); if (b7 & 0x40) b.add("circle"); if (b7 & 0x80) b.add("triangle");
    if (b8 & 0x01) b.add("l1"); if (b8 & 0x02) b.add("r1"); if (next.l2 > .03) b.add("l2"); if (next.r2 > .03) b.add("r2");
    if (b8 & 0x10) b.add("create"); if (b8 & 0x20) b.add("options"); if (b8 & 0x40) b.add("l3"); if (b8 & 0x80) b.add("r3");
    if (b9 & 0x01) b.add("ps"); if (b9 & 0x02) b.add("touchpad"); if (b9 & 0x04) b.add("mute");
    setStick(next); setButtons(b);
  };

  const loadDs5Info = async (d: any) => {
    const items: ControllerInfo[] = [
      { label: "Controller", value: MODEL_NAMES[d.productId] || d.productName || "PlayStation Controller" },
      { label: "Vendor ID", value: hex(d.vendorId) }, { label: "Product ID", value: hex(d.productId) },
    ];
    if (d.productId === 0x0ce6 || d.productId === 0x0df2) {
      try {
        const report = await d.receiveFeatureReport(0x20); const v = report as DataView;
        const buildDate = decodeAscii(v.buffer, 1, 11), buildTime = decodeAscii(v.buffer, 12, 8);
        const hw = v.byteLength >= 32 ? v.getUint32(24, true) : 0;
        const fw = v.byteLength >= 32 ? v.getUint32(28, true) : 0;
        items.push({ label: "FW Build Date", value: `${buildDate} ${buildTime}`.trim() });
        items.push({ label: "Hardware Version", value: hex(hw, 8) });
        items.push({ label: "Firmware Version", value: hex(fw, 8) });
        const board = (hw >> 8) & 0xff;
        const boardMap: Record<number,string> = {3:"BDM-010",4:"BDM-020",5:"BDM-030",6:"BDM-040",7:"BDM-050",8:"BDM-050",17:"BDM-060M",19:"BDM-060X"};
        items.push({ label: "Board Model", value: boardMap[board] || "Unknown" });
      } catch (e) { console.warn("Could not read DS5 feature info", e); }
    }
    setControllerInfo(items);
  };

  const connect = async () => {
    setError(""); setStatus("");
    if (!hidSupported) { setError("المتصفح لا يدعم WebHID. استخدم Google Chrome أو Microsoft Edge على الكمبيوتر."); return; }
    try {
      setConnecting(true);
      const hid: any = (navigator as any).hid;
      let devices = await hid.getDevices();
      devices = devices.filter((d:any) => d.vendorId === SONY_VENDOR_ID && SUPPORTED.some(s => s.productId === d.productId));
      if (!devices.length) devices = await hid.requestDevice({ filters: SUPPORTED });
      if (!devices.length) return;
      const d = devices[0]; if (!d.opened) await d.open();
      const handler = (ev:any) => {
        const data = ev.data as DataView;
        if ((d.productId === 0x0ce6 || d.productId === 0x0df2) && data.byteLength >= 10) parseDs5Input(data);
      };
      inputRef.current = handler; d.addEventListener("inputreport", handler);
      setDevice(d); setConnected(true); await loadDs5Info(d);
      setStatus(`تم الاتصال بـ ${MODEL_NAMES[d.productId] || d.productName}`);
    } catch (e:any) { setError(e?.message || "تعذر الاتصال بالدراع"); }
    finally { setConnecting(false); }
  };

  const disconnect = async () => {
    try { if (device && inputRef.current) device.removeEventListener("inputreport", inputRef.current); if (device?.opened) await device.close(); } catch {}
    setDevice(null); setConnected(false); setStick(initialStick); setButtons(new Set()); setControllerInfo([]); setStatus("");
  };

  useEffect(() => () => { if (device?.opened) void device.close(); }, [device]);

  const assertDs5 = () => { if (!device || !isDs5) throw new Error("المعايرة المباشرة متاحة حاليًا لـ DualSense وDualSense Edge فقط."); };
  const send82 = async (payload: number[], expected: number) => {
    assertDs5(); await device.sendFeatureReport(0x82, new Uint8Array(payload));
    const res = await device.receiveFeatureReport(0x83); const got = (res as DataView).getUint32(0, false);
    if (got !== expected) throw new Error(`Unexpected calibration response ${hex(got,8)}`);
  };

  const calibrateCenter = async () => {
    try { setError(""); setStatus("جاري معايرة مركز الأنالوج... اترك العصاتين بدون لمس."); await send82([1,1,1],0x83010101); await new Promise(r=>setTimeout(r,700)); await send82([3,1,1],0x83010101); await send82([2,1,1],0x83010102); setStatus("تمت معايرة مركز الأنالوج مؤقتًا بنجاح."); }
    catch(e:any){ setError(e?.message || "فشلت معايرة المركز"); }
  };
  const toggleRange = async () => {
    try { setError(""); if (!rangeCapturing) { await send82([1,1,2],0x83010201); setRangeCapturing(true); setStatus("حرّك العصاتين في دوائر كاملة حتى أقصى مدى ثم اضغط إنهاء معايرة المدى."); } else { await send82([2,1,2],0x83010202); setRangeCapturing(false); setStatus("تمت معايرة مدى الأنالوج مؤقتًا بنجاح."); } }
    catch(e:any){ setError(e?.message || "فشلت معايرة المدى"); setRangeCapturing(false); }
  };
  const queryNvs = async () => {
    try { assertDs5(); await device.sendFeatureReport(0x80,new Uint8Array([3,3])); const r = await device.receiveFeatureReport(0x81); const v=(r as DataView).getUint32(1,false); setNvsStatus(v===0x03030201?"Locked / Temporary":v===0x03030200?"Unlocked / Permanent":v===0x15010100?"Pending reboot":`Unknown ${hex(v,8)}`); }
    catch(e:any){ setError(e?.message || "تعذر قراءة NVS"); }
  };

  const visibleInfo = showAllInfo ? controllerInfo : controllerInfo.slice(0, 5);
  const tabs = [{id:"calibration" as Tab,label:"Calibration",icon:Gamepad2},{id:"info" as Tab,label:"Info",icon:Info},{id:"debug" as Tab,label:"Debug",icon:Bug}];

  if (!connected) return (
    <div className="dir-rtl max-w-6xl mx-auto pb-10">
      <div className="bg-[#0d101a] border border-[#262b3e] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#262b3e] flex items-center gap-2 text-white font-black"><Gamepad2 className="w-5 h-5 text-indigo-400"/> أدوات فحص ومعايرة الدراعات</div>
        <div className="p-8 text-center min-h-[430px] flex flex-col items-center justify-center">
          <Usb className="w-14 h-14 text-indigo-400 mb-4"/><h2 className="text-xl font-black text-white">وصل دراع PlayStation واضغط اتصال</h2>
          <p className="text-sm text-gray-400 mt-2 max-w-xl leading-7">يدعم DualShock 4 وDualSense وDualSense Edge وPS VR2 Sense عبر WebHID. يفضّل توصيل USB أثناء المعايرة.</p>
          {!hidSupported && <div className="mt-5 text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs">استخدم Chrome أو Edge على الكمبيوتر لأن WebHID غير متاح في هذا المتصفح.</div>}
          {error && <div className="mt-5 text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs">{error}</div>}
          <button onClick={connect} disabled={!hidSupported||connecting} className="mt-6 px-10 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-xl text-white font-black text-sm">{connecting?"جاري الاتصال...":"Connect / اتصال"}</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="dir-rtl max-w-7xl mx-auto pb-10 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div><h2 className="text-xl font-black text-white flex items-center gap-2"><Gamepad2 className="w-6 h-6 text-indigo-400"/> أدوات فحص ومعايرة الدراعات</h2><div className="text-xs text-gray-400 mt-1">Connected to: <span className="text-white font-bold">{modelName}</span> · VID {hex(device.vendorId)} · PID {hex(device.productId)}</div></div>
        <button onClick={disconnect} className="px-4 py-2 rounded-lg border border-[#32394f] bg-[#111522] text-gray-200 text-xs font-bold">Disconnect</button>
      </div>

      {(status||error) && <div className={`rounded-xl border p-3 text-xs font-bold ${error?"border-red-500/30 bg-red-500/10 text-red-300":"border-emerald-500/30 bg-emerald-500/10 text-emerald-300"}`}>{error||status}</div>}

      <div className="border-b border-[#2a3042] flex gap-1" dir="ltr">
        {tabs.map(t=><button key={t.id} onClick={()=>setTab(t.id)} className={`px-4 py-2.5 rounded-t-lg text-sm font-bold flex items-center gap-2 border border-b-0 ${tab===t.id?"bg-[#141827] border-[#39415a] text-white":"border-transparent text-gray-500 hover:text-gray-300"}`}><t.icon className="w-4 h-4"/>{t.label}</button>)}
      </div>

      {tab==="calibration" && <div className="grid grid-cols-1 lg:grid-cols-2 gap-5" dir="ltr">
        <div className="space-y-4">
          <div className="bg-[#111522] border border-[#2c3245] rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-[#171b29] border-b border-[#2c3245] text-sm font-bold text-white flex items-center gap-2"><Gamepad2 className="w-4 h-4"/> Controller Info</div>
            <div className="p-4 space-y-2 text-sm">{visibleInfo.map((i,idx)=><div key={idx} className="flex justify-between gap-4"><span className="text-gray-400">{i.label}</span><span className="text-gray-100 font-mono text-right">{i.value}</span></div>)}</div>
            {controllerInfo.length>5 && <div className="px-4 pb-4"><button onClick={()=>setShowAllInfo(v=>!v)} className="w-full py-2 rounded-lg border border-[#39415a] text-gray-300 text-xs">{showAllInfo?"Show less":"＋ Show all"}</button></div>}
          </div>
          <div className="flex justify-end"><button onClick={()=>setQuickTest(true)} className="px-4 py-2 rounded-lg border border-indigo-500/50 text-indigo-300 text-xs font-bold flex items-center gap-2"><Zap className="w-4 h-4"/> Quick Test</button></div>
          <div className="bg-[#0b0e17] border border-[#242a3c] rounded-xl p-3"><ControllerDrawing stick={stick} buttons={buttons}/></div>
        </div>

        <div className="space-y-3">
          <button onClick={calibrateCenter} disabled={!isDs5} className="w-full py-2.5 rounded-lg bg-indigo-600 disabled:bg-[#252a39] disabled:text-gray-500 text-white text-sm font-bold">Calibrate stick center</button>
          <button onClick={toggleRange} disabled={!isDs5} className={`w-full py-2.5 rounded-lg ${rangeCapturing?"bg-amber-600":"bg-indigo-600"} disabled:bg-[#252a39] disabled:text-gray-500 text-white text-sm font-bold`}>{rangeCapturing?"Finish stick range calibration":"Calibrate stick range"}</button>
          <button disabled className="w-full py-2.5 rounded-lg bg-indigo-600/45 text-indigo-200/60 text-sm font-bold cursor-not-allowed">Finetune stick calibration</button>
          <hr className="border-[#30364a] my-4"/>
          <button disabled className="w-full py-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-emerald-300/40 text-sm font-bold cursor-not-allowed flex items-center justify-center gap-2"><Save className="w-4 h-4"/> Save changes permanently</button>
          <button disabled className="w-full py-2.5 rounded-lg bg-[#68707e]/30 text-gray-500 text-sm font-bold cursor-not-allowed flex items-center justify-center gap-2"><RotateCcw className="w-4 h-4"/> Restore calibration</button>
          <button onClick={disconnect} className="w-full py-2.5 rounded-lg bg-red-600 text-white text-sm font-bold">Reboot / Disconnect controller</button>

          <div className="bg-[#111522] border border-[#2c3245] rounded-xl overflow-hidden mt-4">
            <div className="px-4 py-2.5 bg-[#171b29] border-b border-[#2c3245] text-sm font-bold text-white">◉ Joystick Info</div>
            <div className="p-4">
              <div className="flex justify-center gap-6"><StickDial x={stick.lx} y={stick.ly} zoom={zoom?10:1}/><StickDial x={stick.rx} y={stick.ry} zoom={zoom?10:1}/></div>
              <div className="grid grid-cols-4 gap-2 mt-4 text-center font-mono text-xs"><div><span className="text-gray-500">LX:</span><div className="text-white">{stick.lx.toFixed(2)}</div></div><div><span className="text-gray-500">LY:</span><div className="text-white">{stick.ly.toFixed(2)}</div></div><div><span className="text-gray-500">RX:</span><div className="text-white">{stick.rx.toFixed(2)}</div></div><div><span className="text-gray-500">RY:</span><div className="text-white">{stick.ry.toFixed(2)}</div></div></div>
              <div className="flex justify-center mt-4 text-xs" dir="ltr"><button onClick={()=>setZoom(false)} className={`px-3 py-1.5 border border-[#3a4258] rounded-l ${!zoom?"bg-[#626b7b] text-white":"text-gray-400"}`}>Normal</button><button onClick={()=>setZoom(true)} className={`px-3 py-1.5 border-y border-[#3a4258] ${zoom?"bg-[#626b7b] text-white":"text-gray-400"}`}>10x zoom</button><button onClick={()=>setCircularity(v=>!v)} className={`px-3 py-1.5 border border-[#3a4258] rounded-r ${circularity?"bg-indigo-600 text-white":"text-gray-400"}`}>Check circularity</button></div>
              {circularity && <div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div className="p-2 rounded bg-[#0b0e17] text-center text-gray-300">Left radial: {Math.sqrt(stick.lx**2+stick.ly**2).toFixed(3)}</div><div className="p-2 rounded bg-[#0b0e17] text-center text-gray-300">Right radial: {Math.sqrt(stick.rx**2+stick.ry**2).toFixed(3)}</div></div>}
            </div>
          </div>
        </div>
      </div>}

      {tab==="info" && <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="bg-[#111522] border border-[#2c3245] rounded-xl p-4"><h3 className="text-white font-black mb-4">Controller Information</h3>{controllerInfo.map((i,idx)=><div key={idx} className="flex justify-between py-2 border-b border-[#242a3a] last:border-0 text-sm"><span className="text-gray-400">{i.label}</span><span className="text-white font-mono">{i.value}</span></div>)}</div><div className="bg-[#111522] border border-[#2c3245] rounded-xl p-4"><h3 className="text-white font-black mb-4">Live input</h3><div className="grid grid-cols-2 gap-2 text-xs font-mono text-gray-300"><div>LX {stick.lx.toFixed(4)}</div><div>LY {stick.ly.toFixed(4)}</div><div>RX {stick.rx.toFixed(4)}</div><div>RY {stick.ry.toFixed(4)}</div><div>L2 {stick.l2.toFixed(4)}</div><div>R2 {stick.r2.toFixed(4)}</div></div><div className="mt-4 text-xs text-gray-400">Center drift: L {driftL.toFixed(2)}% · R {driftR.toFixed(2)}%</div></div></div>}

      {tab==="debug" && <div className="space-y-4"><div className="bg-[#111522] border border-[#2c3245] rounded-xl overflow-hidden"><div className="px-4 py-2.5 bg-[#171b29] border-b border-[#2c3245] text-sm font-bold text-white">Debug Info</div><div className="p-4 text-sm flex justify-between"><span className="text-gray-400">NVS Status</span><span className="text-white font-mono">{nvsStatus}</span></div></div><div className="bg-[#111522] border border-[#2c3245] rounded-xl p-4"><h3 className="text-white font-bold mb-3">Debug buttons</h3><button onClick={queryNvs} disabled={!isDs5} className="px-4 py-2 bg-indigo-600 disabled:bg-gray-800 text-white rounded-lg text-xs font-bold">Query NVS status</button></div><div className="border border-amber-500/30 bg-amber-500/10 rounded-xl p-4 text-xs text-amber-200 leading-6 flex gap-3"><ShieldAlert className="w-5 h-5 shrink-0"/><div>المعايرة لا تصلح تلف الـstick الميكانيكي. لو فيه Drift بسبب تآكل القطعة، لازم تتغير القطعة أولًا ثم تستخدم المعايرة لضبط المركز والمدى.</div></div></div>}

      {quickTest && <div className="fixed inset-0 z-[80] bg-black/75 flex items-center justify-center p-4" dir="ltr"><div className="bg-[#101420] border border-[#343b52] rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-auto"><div className="p-4 border-b border-[#2b3144] flex items-center justify-between"><h3 className="text-white font-black">Quick Test</h3><button onClick={()=>setQuickTest(false)} className="text-gray-400 hover:text-white"><X/></button></div><div className="p-5"><ControllerDrawing stick={stick} buttons={buttons}/><div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">{["up","down","left","right","square","cross","circle","triangle","l1","l2","r1","r2","create","options","l3","r3","ps","touchpad","mute"].map(n=><div key={n} className={`p-2 rounded-lg border text-xs font-mono ${buttons.has(n)?"border-emerald-500 bg-emerald-500/15 text-emerald-300":"border-[#2b3144] text-gray-500"}`}>{n}</div>)}</div></div></div></div>}
    </div>
  );
}
