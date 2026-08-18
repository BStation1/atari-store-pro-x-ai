import React, { useEffect, useMemo, useRef, useState } from "react";
import { Gamepad2, Info, Bug, Gauge, RotateCcw, Zap, Usb, ChevronDown, Copy, CheckCircle2, AlertTriangle } from "lucide-react";

type PadSnapshot = {
  index: number;
  id: string;
  mapping: string;
  buttons: { pressed: boolean; value: number }[];
  axes: number[];
  timestamp: number;
};

const clonePad = (g: Gamepad): PadSnapshot => ({
  index: g.index,
  id: g.id,
  mapping: g.mapping,
  buttons: Array.from(g.buttons).map(b => ({ pressed: b.pressed, value: b.value })),
  axes: Array.from(g.axes),
  timestamp: g.timestamp,
});

const clamp = (v: number) => Math.max(-1, Math.min(1, v));
const radius = (x: number, y: number) => Math.sqrt(x * x + y * y);

function StickPlot({ x, y }: { x: number; y: number }) {
  const px = clamp(x) * 44;
  const py = clamp(y) * 44;
  return (
    <div className="relative w-[116px] h-[116px] rounded-full border border-slate-500 bg-white">
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-300" />
      <div className="absolute top-1/2 left-0 right-0 h-px bg-slate-300" />
      <div className="absolute w-2 h-2 rounded-full bg-blue-700 -ml-1 -mt-1" style={{ left: "50%", top: "50%", transform: `translate(${px}px, ${py}px)` }} />
      <div className="absolute left-1/2 top-1/2 w-px bg-slate-500 origin-left" style={{ height: Math.min(52, radius(x,y) * 52), transform: `rotate(${Math.atan2(y, x) * 180 / Math.PI - 90}deg)` }} />
    </div>
  );
}

function DualSenseOutline({ pad, lx, ly, rx, ry }: { pad: PadSnapshot; lx: number; ly: number; rx: number; ry: number }) {
  const active = (i: number) => Boolean(pad.buttons[i]?.pressed || pad.buttons[i]?.value > 0.15);
  const fill = (i: number) => active(i) ? "#1976d2" : "white";
  const stroke = "#20a4e6";
  const ldx = clamp(lx) * 8, ldy = clamp(ly) * 8;
  const rdx = clamp(rx) * 8, rdy = clamp(ry) * 8;
  return (
    <svg viewBox="0 0 620 390" className="w-full max-w-[620px] mx-auto">
      <g fill="white" stroke={stroke} strokeWidth="4" strokeLinejoin="round">
        <path d="M170 92 C120 86 76 112 55 167 C35 219 34 289 54 334 C67 362 91 366 110 343 L166 269 C187 278 213 284 310 284 C407 284 433 278 454 269 L510 343 C529 366 553 362 566 334 C586 289 585 219 565 167 C544 112 500 86 450 92 C409 99 376 111 310 111 C244 111 211 99 170 92 Z" />
        <path d="M229 103 L391 103 C408 103 418 114 415 129 L402 191 C399 207 390 215 374 215 L246 215 C230 215 221 207 218 191 L205 129 C202 114 212 103 229 103 Z" />
        <rect x="286" y="222" width="48" height="18" rx="9" />
        <circle cx="220" cy="235" r="33" />
        <circle cx="400" cy="235" r="33" />
      </g>
      <g fill="none" stroke={stroke} strokeWidth="4">
        <circle cx={220+ldx} cy={235+ldy} r="25" />
        <circle cx={400+rdx} cy={235+rdy} r="25" />
      </g>
      <g stroke={stroke} strokeWidth="3">
        <rect x="112" y="164" width="30" height="30" rx="7" fill={fill(14)} />
        <rect x="112" y="224" width="30" height="30" rx="7" fill={fill(15)} />
        <rect x="82" y="194" width="30" height="30" rx="7" fill={fill(14)} />
        <rect x="142" y="194" width="30" height="30" rx="7" fill={fill(15)} />
        <circle cx="492" cy="170" r="16" fill={fill(3)} />
        <circle cx="522" cy="200" r="16" fill={fill(1)} />
        <circle cx="492" cy="230" r="16" fill={fill(0)} />
        <circle cx="462" cy="200" r="16" fill={fill(2)} />
        <rect x="176" y="58" width="78" height="28" rx="10" fill={fill(4)} />
        <rect x="366" y="58" width="78" height="28" rx="10" fill={fill(5)} />
      </g>
      <g fill={stroke} fontSize="12" fontWeight="700" textAnchor="middle">
        <text x="492" y="174">△</text><text x="522" y="204">○</text><text x="492" y="234">×</text><text x="462" y="204">□</text>
      </g>
    </svg>
  );
}

export default function GamepadTester() {
  const [pads, setPads] = useState<PadSnapshot[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [center, setCenter] = useState<[number, number, number, number]>([0,0,0,0]);
  const [maxRange, setMaxRange] = useState<[number, number]>([0,0]);
  const [notice, setNotice] = useState("");
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const current = Array.from(navigator.getGamepads?.() || []).filter((x): x is Gamepad => Boolean(x)).map(clonePad);
      setPads(current);
      if (current.length && (selected === null || !current.some(p => p.index === selected))) setSelected(current[0].index);
      raf.current = requestAnimationFrame(tick);
    };
    const connected = (e: GamepadEvent) => setSelected(e.gamepad.index);
    window.addEventListener("gamepadconnected", connected);
    tick();
    return () => { window.removeEventListener("gamepadconnected", connected); if (raf.current !== null) cancelAnimationFrame(raf.current); };
  }, [selected]);

  const pad = pads.find(p => p.index === selected) || pads[0];
  const raw = pad?.axes || [];
  const lx = (raw[0] || 0) - center[0];
  const ly = (raw[1] || 0) - center[1];
  const rx = (raw[2] || 0) - center[2];
  const ry = (raw[3] || 0) - center[3];
  const lRadius = radius(lx, ly), rRadius = radius(rx, ry);

  useEffect(() => {
    if (!pad) return;
    setMaxRange(([l,r]) => [Math.max(l,lRadius), Math.max(r,rRadius)]);
  }, [pad?.timestamp, lRadius, rRadius]);

  const pressed = useMemo(() => pad?.buttons.filter(b => b.pressed || b.value > .5).length || 0, [pad]);
  const serialGuess = pad?.id.match(/[A-F0-9]{10,}/i)?.[0] || "غير متاح عبر المتصفح";

  const calibrateCenter = () => {
    setCenter([raw[0]||0, raw[1]||0, raw[2]||0, raw[3]||0]);
    setNotice("تم ضبط مركز الأنالوج محليًا لهذه الجلسة.");
  };
  const calibrateRange = () => { setMaxRange([0,0]); setNotice("حرّك الأنالوجين دورة كاملة حتى أقصى الحواف لقياس المدى."); };
  const restore = () => { setCenter([0,0,0,0]); setMaxRange([0,0]); setNotice("تم استعادة قياسات الجلسة الافتراضية."); };
  const vibrate = async () => {
    if (!pad) return;
    const live: any = navigator.getGamepads?.()[pad.index];
    if (!live?.vibrationActuator?.playEffect) { setNotice("الاهتزاز غير مدعوم لهذا الدراع/المتصفح."); return; }
    await live.vibrationActuator.playEffect("dual-rumble", { duration: 600, strongMagnitude: .9, weakMagnitude: .7 });
  };

  if (!pad) return (
    <div className="bg-slate-100 min-h-[70vh] rounded-2xl p-8 flex items-center justify-center" dir="ltr">
      <div className="text-center text-slate-700"><Usb className="w-14 h-14 mx-auto mb-4 text-blue-500"/><h2 className="text-xl font-bold">Connect a controller</h2><p className="mt-2 text-sm">وصل الدراع USB أو Bluetooth واضغط أي زر عليه.</p></div>
    </div>
  );

  return (
    <div className="bg-[#f7f7f7] text-slate-800 rounded-2xl overflow-hidden border border-slate-300" dir="ltr">
      <div className="px-5 pt-4 bg-white border-b border-slate-300">
        <div className="flex items-end gap-2 text-sm">
          <button className="px-4 py-2 border border-slate-300 border-b-white rounded-t-lg bg-white font-semibold flex items-center gap-2"><Gamepad2 className="w-4 h-4"/>Calibration</button>
          <button className="px-4 py-2 text-blue-600 flex items-center gap-2"><Info className="w-4 h-4"/>Info</button>
          <button className="px-4 py-2 text-blue-600 flex items-center gap-2"><Bug className="w-4 h-4"/>Debug</button>
        </div>
      </div>

      <div className="p-5 grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="space-y-5">
          <section className="border border-slate-300 rounded-lg bg-white overflow-hidden">
            <div className="px-4 py-2 bg-slate-100 border-b border-slate-300 font-semibold text-sm flex items-center gap-2"><Gamepad2 className="w-4 h-4"/>Controller Info</div>
            <div className="p-4 text-sm space-y-3">
              <div className="flex justify-between gap-4"><span className="text-slate-500">Controller</span><span className="font-mono text-right truncate max-w-[65%]">{pad.id}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Serial Number</span><span className="font-mono flex items-center gap-1">{serialGuess}<Copy className="w-3 h-3"/></span></div>
              <div className="flex justify-between"><span className="text-slate-500">Mapping</span><span className="font-mono">{pad.mapping || "generic"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Buttons / Axes</span><span className="font-mono">{pad.buttons.length} / {pad.axes.length}</span></div>
              <button className="w-full border border-slate-400 rounded-md py-2 mt-2 text-slate-600 flex items-center justify-center gap-2"><ChevronDown className="w-4 h-4"/>Show all</button>
            </div>
          </section>

          <div className="flex justify-end"><button className="border border-blue-500 text-blue-600 rounded-md px-4 py-2 text-sm font-semibold flex items-center gap-2"><Zap className="w-4 h-4"/>Quick Test</button></div>

          <div className="bg-white rounded-lg py-2">
            <DualSenseOutline pad={pad} lx={lx} ly={ly} rx={rx} ry={ry}/>
            <div className="text-center text-xs text-slate-500">اضغط الأزرار وحرّك الأنالوج — الرسم يتفاعل لحظيًا</div>
          </div>
        </div>

        <div className="space-y-4">
          <button onClick={calibrateCenter} className="w-full bg-[#0d6efd] hover:bg-blue-700 text-white rounded-md py-2.5 text-sm font-medium flex items-center justify-center gap-2">Calibrate stick center <ChevronDown className="w-4 h-4"/></button>
          <button onClick={calibrateRange} className="w-full bg-[#0d6efd] hover:bg-blue-700 text-white rounded-md py-2.5 text-sm font-medium flex items-center justify-center gap-2">Calibrate stick range <ChevronDown className="w-4 h-4"/></button>
          <button onClick={() => setNotice("Finetune: استخدم قياسات LX/LY/RX/RY بالأسفل لضبط الدراع بدقة.")} className="w-full bg-[#0d6efd] hover:bg-blue-700 text-white rounded-md py-2.5 text-sm font-medium">Finetune stick calibration</button>
          <div className="border-t border-slate-300 my-5" />
          <button disabled className="w-full border border-slate-400 text-slate-400 rounded-md py-2.5 text-sm">Save changes permanently</button>
          <button onClick={restore} className="w-full bg-slate-500 text-white rounded-md py-2.5 text-sm">Restore calibration</button>
          <button onClick={vibrate} className="w-full bg-red-500 hover:bg-red-600 text-white rounded-md py-2.5 text-sm">Test vibration</button>

          <section className="border border-slate-300 rounded-lg bg-white overflow-hidden mt-2">
            <div className="px-4 py-2 bg-slate-100 border-b border-slate-300 font-semibold text-sm flex items-center gap-2"><Gauge className="w-4 h-4"/>Joystick Info</div>
            <div className="p-5">
              <div className="flex justify-center gap-8 flex-wrap"><StickPlot x={lx} y={ly}/><StickPlot x={rx} y={ry}/></div>
              <div className="grid grid-cols-4 gap-3 mt-5 font-mono text-sm text-center">
                <div>LX:<br/><b>{lx.toFixed(2)}</b></div><div>LY:<br/><b>{ly.toFixed(2)}</b></div><div>RX:<br/><b>{rx.toFixed(2)}</b></div><div>RY:<br/><b>{ry.toFixed(2)}</b></div>
              </div>
              <div className="flex justify-center gap-1 mt-5 text-xs"><button className="bg-slate-500 text-white px-3 py-1.5 rounded">Normal</button><button className="border border-slate-400 px-3 py-1.5 rounded">10x zoom</button><button className="border border-slate-400 px-3 py-1.5 rounded">Check circularity</button></div>
            </div>
          </section>

          <section className="border border-slate-300 rounded-lg bg-white p-4 text-sm">
            <div className="flex justify-between"><span>Left drift</span><span className={lRadius > .12 ? "text-red-600 font-bold" : "text-emerald-600 font-bold"}>{(lRadius*100).toFixed(2)}%</span></div>
            <div className="flex justify-between mt-2"><span>Right drift</span><span className={rRadius > .12 ? "text-red-600 font-bold" : "text-emerald-600 font-bold"}>{(rRadius*100).toFixed(2)}%</span></div>
            <div className="flex justify-between mt-2"><span>Max range</span><span className="font-mono">L {(maxRange[0]*100).toFixed(0)}% / R {(maxRange[1]*100).toFixed(0)}%</span></div>
            <div className="flex justify-between mt-2"><span>Pressed now</span><span className="font-mono">{pressed}</span></div>
          </section>

          {notice && <div className="rounded-md border border-blue-200 bg-blue-50 text-blue-800 px-4 py-3 text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/>{notice}</div>}
          <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3 text-xs flex items-start gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0"/>الحفظ الدائم لمعايرة Firmware غير متاح عبر Gamepad API العادي؛ المعايرة هنا آمنة ومحلية داخل جلسة الفحص.</div>
        </div>
      </div>
    </div>
  );
}
