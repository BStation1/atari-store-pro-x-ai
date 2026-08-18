import React, { useEffect, useMemo, useRef, useState } from "react";
import { Gamepad2, RotateCcw, Vibrate, Activity, CircleDot, Gauge, Usb, CheckCircle2, AlertTriangle } from "lucide-react";

const BUTTON_NAMES = [
  "A / Cross", "B / Circle", "X / Square", "Y / Triangle",
  "L1 / LB", "R1 / RB", "L2 / LT", "R2 / RT",
  "Select / Share", "Start / Options", "L3", "R3",
  "D-Pad Up", "D-Pad Down", "D-Pad Left", "D-Pad Right",
  "Home / PS", "Touchpad"
];

interface GamepadSnapshot {
  index: number;
  id: string;
  mapping: string;
  connected: boolean;
  buttons: { pressed: boolean; touched: boolean; value: number }[];
  axes: number[];
  timestamp: number;
}

function cloneGamepad(gamepad: Gamepad): GamepadSnapshot {
  return {
    index: gamepad.index,
    id: gamepad.id,
    mapping: gamepad.mapping,
    connected: gamepad.connected,
    buttons: Array.from(gamepad.buttons).map(b => ({ pressed: b.pressed, touched: b.touched, value: b.value })),
    axes: Array.from(gamepad.axes),
    timestamp: gamepad.timestamp
  };
}

function pct(v: number): string {
  return `${Math.round(Math.min(1, Math.max(0, Math.abs(v))) * 100)}%`;
}

function driftLevel(radius: number): { label: string; className: string } {
  if (radius <= 0.08) return { label: "ممتاز", className: "text-emerald-400" };
  if (radius <= 0.15) return { label: "مقبول", className: "text-amber-400" };
  return { label: "Drift مرتفع", className: "text-red-400" };
}

function StickVisualizer({ x, y, label }: { x: number; y: number; label: string }) {
  const radius = Math.sqrt(x * x + y * y);
  const drift = driftLevel(radius);
  const px = Math.max(-1, Math.min(1, x)) * 41;
  const py = Math.max(-1, Math.min(1, y)) * 41;

  return (
    <div className="bg-[#0b0e18] border border-[#24283b] rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm text-white">{label}</h3>
        <span className={`text-xs font-bold ${drift.className}`}>{drift.label}</span>
      </div>
      <div className="flex flex-col sm:flex-row items-center gap-5">
        <div className="relative w-32 h-32 rounded-full border-2 border-[#343950] bg-[#070913] shadow-inner">
          <div className="absolute inset-[10%] rounded-full border border-dashed border-[#343950]" />
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[#252a3c]" />
          <div className="absolute top-1/2 left-0 right-0 h-px bg-[#252a3c]" />
          <div
            className="absolute w-7 h-7 -ml-3.5 -mt-3.5 rounded-full bg-indigo-500 border-2 border-white/70 shadow-lg transition-transform duration-75"
            style={{ left: "50%", top: "50%", transform: `translate(${px}px, ${py}px)` }}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs min-w-[155px]">
          <div className="bg-[#111522] rounded-xl p-2"><span className="text-gray-500">X</span><div className="font-mono text-white font-bold">{x.toFixed(4)}</div></div>
          <div className="bg-[#111522] rounded-xl p-2"><span className="text-gray-500">Y</span><div className="font-mono text-white font-bold">{y.toFixed(4)}</div></div>
          <div className="bg-[#111522] rounded-xl p-2 col-span-2"><span className="text-gray-500">Center drift</span><div className={`font-mono font-bold ${drift.className}`}>{(radius * 100).toFixed(2)}%</div></div>
        </div>
      </div>
    </div>
  );
}

export default function GamepadTester() {
  const [pads, setPads] = useState<GamepadSnapshot[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [deadzone, setDeadzone] = useState(0.08);
  const [maxLeftRadius, setMaxLeftRadius] = useState(0);
  const [maxRightRadius, setMaxRightRadius] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const update = () => {
      const live = Array.from(navigator.getGamepads?.() || [])
        .filter((g): g is Gamepad => Boolean(g))
        .map(cloneGamepad);
      setPads(live);
      if (live.length && (selectedIndex === null || !live.some(p => p.index === selectedIndex))) {
        setSelectedIndex(live[0].index);
      }
      rafRef.current = requestAnimationFrame(update);
    };

    const onConnected = (e: GamepadEvent) => setSelectedIndex(e.gamepad.index);
    window.addEventListener("gamepadconnected", onConnected);
    update();
    return () => {
      window.removeEventListener("gamepadconnected", onConnected);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [selectedIndex]);

  const pad = pads.find(p => p.index === selectedIndex) || pads[0];
  const axes = pad?.axes || [];
  const leftX = axes[0] || 0;
  const leftY = axes[1] || 0;
  const rightX = axes[2] || 0;
  const rightY = axes[3] || 0;
  const leftRadius = Math.sqrt(leftX * leftX + leftY * leftY);
  const rightRadius = Math.sqrt(rightX * rightX + rightY * rightY);

  useEffect(() => {
    if (!pad) return;
    setMaxLeftRadius(v => Math.max(v, leftRadius));
    setMaxRightRadius(v => Math.max(v, rightRadius));
  }, [pad?.timestamp, leftRadius, rightRadius]);

  const pressedCount = useMemo(() => pad?.buttons.filter(b => b.pressed || b.value > 0.5).length || 0, [pad]);
  const vibrationSupported = Boolean((navigator.getGamepads?.()[pad?.index ?? -1] as any)?.vibrationActuator);

  const vibrate = async () => {
    if (!pad) return;
    const live = navigator.getGamepads?.()[pad.index] as any;
    const actuator = live?.vibrationActuator;
    if (!actuator?.playEffect) return;
    try {
      await actuator.playEffect("dual-rumble", {
        startDelay: 0,
        duration: 700,
        weakMagnitude: 0.7,
        strongMagnitude: 0.9
      });
    } catch (err) {
      console.warn("Gamepad vibration test failed:", err);
    }
  };

  const resetCalibration = () => {
    setMaxLeftRadius(0);
    setMaxRightRadius(0);
  };

  const centerHealthy = leftRadius <= deadzone && rightRadius <= deadzone;

  return (
    <div className="space-y-5 dir-rtl pb-8">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2"><Gamepad2 className="w-6 h-6 text-indigo-400" /> فحص الدراعات</h2>
          <p className="text-xs text-gray-400 mt-1">اختبار مباشر للأزرار، الأنالوج، التريجرز، الـStick Drift والاهتزاز بدون أي موقع خارجي.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={resetCalibration} className="px-3 py-2 rounded-xl bg-[#121626] border border-[#2b3045] text-gray-200 text-xs font-bold flex items-center gap-2"><RotateCcw className="w-4 h-4" /> تصفير القياسات</button>
          <button onClick={vibrate} disabled={!vibrationSupported} className="px-3 py-2 rounded-xl bg-indigo-600 disabled:bg-gray-800 disabled:text-gray-500 text-white text-xs font-bold flex items-center gap-2"><Vibrate className="w-4 h-4" /> اختبار الاهتزاز</button>
        </div>
      </div>

      {!pad ? (
        <div className="min-h-[420px] flex items-center justify-center bg-[#0c0f19] border border-dashed border-[#30354b] rounded-3xl">
          <div className="text-center max-w-md px-6">
            <Usb className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
            <h3 className="text-white font-black text-lg">وصل الدراع وابدأ الاختبار</h3>
            <p className="text-sm text-gray-400 mt-2 leading-7">وصل الدراع USB أو Bluetooth، وبعدها اضغط أي زر عليه. Chrome هيكتشفه تلقائيًا من خلال Gamepad API.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-3">
            <div className="xl:col-span-2 bg-[#0d101b] border border-[#24283b] rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-500/10"><Gamepad2 className="w-5 h-5 text-indigo-400" /></div>
                <div className="min-w-0">
                  <div className="text-sm text-white font-bold truncate">{pad.id}</div>
                  <div className="text-[11px] text-gray-500">Gamepad #{pad.index + 1} • {pad.mapping || "generic mapping"} • {pad.buttons.length} زر • {pad.axes.length} محور</div>
                </div>
              </div>
            </div>
            <div className="bg-[#0d101b] border border-[#24283b] rounded-2xl p-4 flex items-center gap-3">
              <Activity className="w-5 h-5 text-cyan-400" />
              <div><div className="text-[11px] text-gray-500">أزرار مضغوطة الآن</div><div className="text-xl font-black text-white">{pressedCount}</div></div>
            </div>
            <div className="bg-[#0d101b] border border-[#24283b] rounded-2xl p-4 flex items-center gap-3">
              {centerHealthy ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertTriangle className="w-5 h-5 text-amber-400" />}
              <div><div className="text-[11px] text-gray-500">حالة مركز الأنالوج</div><div className={`text-sm font-black ${centerHealthy ? "text-emerald-400" : "text-amber-400"}`}>{centerHealthy ? "داخل Deadzone" : "يوجد انحراف"}</div></div>
            </div>
          </div>

          {pads.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {pads.map(p => <button key={p.index} onClick={() => setSelectedIndex(p.index)} className={`px-3 py-2 rounded-xl border text-xs font-bold ${p.index === pad.index ? "bg-indigo-600 border-indigo-500 text-white" : "bg-[#0d101b] border-[#2b3045] text-gray-300"}`}>دراع #{p.index + 1}</button>)}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <StickVisualizer x={leftX} y={leftY} label="Left Stick / الأنالوج الشمال" />
            <StickVisualizer x={rightX} y={rightY} label="Right Stick / الأنالوج اليمين" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 bg-[#0d101b] border border-[#24283b] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-white text-sm flex items-center gap-2"><CircleDot className="w-4 h-4 text-indigo-400" /> اختبار الأزرار</h3>
                <span className="text-[11px] text-gray-500">القيمة من 0.00 إلى 1.00</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                {pad.buttons.map((b, i) => {
                  const active = b.pressed || b.value > 0.02;
                  return <div key={i} className={`rounded-xl border p-3 transition ${active ? "bg-indigo-500/15 border-indigo-500/60" : "bg-[#090c15] border-[#22263a]"}`}>
                    <div className="flex items-center justify-between gap-2"><span className={`text-xs font-bold truncate ${active ? "text-white" : "text-gray-400"}`}>{BUTTON_NAMES[i] || `Button ${i}`}</span><span className={`w-2.5 h-2.5 rounded-full ${active ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.75)]" : "bg-gray-700"}`} /></div>
                    <div className="mt-2 h-1.5 bg-gray-800 rounded-full overflow-hidden"><div className="h-full bg-indigo-500" style={{ width: `${Math.round(b.value * 100)}%` }} /></div>
                    <div className="font-mono text-[10px] text-gray-500 mt-1">{b.value.toFixed(3)}</div>
                  </div>;
                })}
              </div>
            </div>

            <div className="bg-[#0d101b] border border-[#24283b] rounded-2xl p-4 space-y-4">
              <h3 className="font-black text-white text-sm flex items-center gap-2"><Gauge className="w-4 h-4 text-indigo-400" /> Drift & Calibration</h3>
              <label className="block">
                <div className="flex justify-between text-xs mb-2"><span className="text-gray-400">Deadzone المرجعية</span><span className="font-mono text-white">{Math.round(deadzone * 100)}%</span></div>
                <input type="range" min="0.02" max="0.25" step="0.01" value={deadzone} onChange={e => setDeadzone(Number(e.target.value))} className="w-full accent-indigo-500" />
              </label>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between bg-[#090c15] rounded-xl p-3"><span className="text-gray-400">Left center drift</span><span className={`font-mono font-bold ${driftLevel(leftRadius).className}`}>{(leftRadius * 100).toFixed(2)}%</span></div>
                <div className="flex justify-between bg-[#090c15] rounded-xl p-3"><span className="text-gray-400">Right center drift</span><span className={`font-mono font-bold ${driftLevel(rightRadius).className}`}>{(rightRadius * 100).toFixed(2)}%</span></div>
                <div className="flex justify-between bg-[#090c15] rounded-xl p-3"><span className="text-gray-400">أقصى Left Stick وصل له</span><span className="font-mono text-cyan-400 font-bold">{pct(maxLeftRadius)}</span></div>
                <div className="flex justify-between bg-[#090c15] rounded-xl p-3"><span className="text-gray-400">أقصى Right Stick وصل له</span><span className="font-mono text-cyan-400 font-bold">{pct(maxRightRadius)}</span></div>
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] leading-6 text-amber-100/80">لأفضل قياس Drift: سيب الأنالوج بدون لمس لمدة ثانيتين. لو النسبة أعلى من الـDeadzone المختارة بشكل ثابت، فده مؤشر واضح على الانحراف.</div>
            </div>
          </div>

          {pad.axes.length > 4 && (
            <div className="bg-[#0d101b] border border-[#24283b] rounded-2xl p-4">
              <h3 className="font-black text-white text-sm mb-3">كل الـAxes الخام</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">{pad.axes.map((a, i) => <div key={i} className="bg-[#090c15] rounded-xl p-2 text-center"><div className="text-[10px] text-gray-500">Axis {i}</div><div className="font-mono text-xs text-white">{a.toFixed(4)}</div></div>)}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
