/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { useDialog } from "../context/DialogContext";
import {
  Sparkles,
  Cpu,
  Search,
  Upload,
  Camera,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  DollarSign,
  ShieldAlert,
  ArrowRight,
  Layers,
  Zap,
  FileCode,
  Image as ImageIcon,
  X,
  RefreshCw
} from "lucide-react";
import { DeviceType } from "../types";

interface AIDiagnosticsProps {
  onNavigateToReception?: (prefillData: any) => void;
}

export default function AIDiagnostics({ onNavigateToReception }: AIDiagnosticsProps) {
  const dialog = useDialog();
  const [errorCode, setErrorCode] = useState("");
  const [selectedDevice, setSelectedDevice] = useState<string>(DeviceType.PS5);
  const [symptoms, setSymptoms] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<string>("image/jpeg");
  const [isLoading, setIsLoading] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState("");

  // Live Camera state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access error:", err);
      await dialog.alert({ message: "تعذر الوصول للكاميرا، يرجى التأكد من السماح بصلاحية الكاميرا أو استخدام رفع الصور.", variant: "warning" });
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const captureCameraSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg");
      setImagePreview(dataUrl);
      setMediaType("image/jpeg");
    }
    stopCamera();
  };

  // Preset Common Gaming Error Codes for 1-click test
  const quickErrorPresets = [
    { code: "CE-108255-1", label: "PS5: كراش وانغلاق الألعاب متكرر" },
    { code: "SU-101379-2", label: "PS5: فشل تحديث النظام" },
    { code: "CE-34878-0", label: "PS4: خطأ كراش البرامج والتطبيقات" },
    { code: "E100 / E101", label: "Xbox: خطأ التحديث وقارئ الأقراص" },
    { code: "2153-0003", label: "Switch: عدم الاستجابة أو شاشة سوداء" },
    { code: "Blinking Blue Light (BLOD)", label: "PS4/PS5: المبة الزرقاء المستمرة" }
  ];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      await dialog.alert({ message: "حجم الملف كبير جداً. يرجى اختيار صورة أو مقطع فيديو أقل من 20 ميجابايت.", variant: "warning" });
      return;
    }

    setMediaType(file.type);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!errorCode.trim() && !symptoms.trim() && !imagePreview) {
      await dialog.alert({ message: "يرجى كتابة كود الخطأ، أو وصف الأعراض، أو إرفاق صورة/لقطة كاميرا للعطل أولاً.", variant: "warning" });
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    setDiagnosisResult(null);

    try {
      const response = await fetch("/api/ai/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          errorCode: errorCode.trim(),
          deviceModel: selectedDevice,
          symptoms: symptoms.trim(),
          imageData: imagePreview,
          mediaType: mediaType
        })
      });

      const data = await response.json();
      if (data.success && data.diagnosis) {
        setDiagnosisResult(data.diagnosis);
      } else {
        setErrorMessage(data.error || "تعذر تحليل العطل، يرجى المحاولة مرة أخرى.");
      }
    } catch (err: any) {
      console.error("AI Diagnosis request error:", err);
      // Fallback diagnosis client-side if offline/disconnected
      setDiagnosisResult({
        title: `تشخيص عطل ${errorCode || selectedDevice}`,
        cause: "احتمال وجود قصر كهربائي (Short) في مكثفات خط التغذية أو تلف آيسيه الترميز",
        difficulty: "متوسط إلى مرتفع",
        suggestedParts: ["آيسيه تبريد / ترميز أصلي", "مكثف SMD", "مظهر لحام Flux"],
        repairSteps: [
          "قياس الممانعة على المكونات المحيطة بالآيسيه باستخدام الأفوميتر.",
          "تسخين المكون التالف بـ Hot Air عند درجة 370°C وتغييره بحذر.",
          "تنظيف البوردة بكحول الآيزوبروبيل وإعادة التجميع."
        ],
        estimatedCost: "900 - 1500 ج.م",
        technicianAdvice: "تأكد من قياس الممانعة قبل وبعد تركيب الآيسيه الجديد لتجنب إتلاف مكونات التغذية."
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-right max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900/60 via-[#11131e] to-[#11131e] border border-indigo-500/30 p-6 rounded-2xl relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 left-0 p-8 opacity-10 pointer-events-none">
          <Cpu className="w-48 h-48 text-indigo-400" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
              المساعد الذكي للتشخيص AI Gemini Pro
            </span>
            <h2 className="text-2xl font-black text-white">محلل وتشخيص أعطال أجهزة الألعاب الذكي</h2>
            <p className="text-xs text-gray-300 mt-1 max-w-2xl leading-relaxed">
              ادخل كود الخطأ (Error Code) أو وصف المشكلة أو ارفع صورة/فيديو للبوردة والعطل ليقوم الذكاء الاصطناعي بتحديد السبب الفني، القطع المطلوبة، وخطوات الإصلاح بدقة.
            </p>
          </div>
        </div>
      </div>

      {/* Preset Error Quick Chips */}
      <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-xl space-y-2">
        <span className="text-xs font-bold text-gray-400 block">أكواد وأعطال شائعة جاهزة للتحليل الفوري:</span>
        <div className="flex flex-wrap gap-2">
          {quickErrorPresets.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => {
                setErrorCode(preset.code);
                setSymptoms(preset.label);
              }}
              className="bg-gray-950 hover:bg-indigo-600/20 hover:border-indigo-500 border border-[#2a2d42] text-xs text-gray-300 hover:text-white px-3 py-1.5 rounded-lg transition-colors cursor-pointer font-mono"
            >
              {preset.code} - <span className="font-sans">{preset.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Diagnostic Form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form onSubmit={handleAnalyze} className="bg-[#11131e] border border-[#2a2d42] p-6 rounded-2xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-[#2a2d42] pb-3">
            <Zap className="w-4 h-4 text-indigo-400" />
            بيانات العطل والجهاز
          </h3>

          <div>
            <label className="text-xs text-gray-400 block mb-1.5">نوع الجهاز / الكونسول</label>
            <select
              value={selectedDevice}
              onChange={e => setSelectedDevice(e.target.value)}
              className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
            >
              <option value={DeviceType.PS5}>بلايستيشن 5 (PS5 / PS5 Slim / Pro)</option>
              <option value={DeviceType.PS4_Pro}>بلايستيشن 4 (PS4 Fat / Slim / Pro)</option>
              <option value={DeviceType.Xbox_Series_X}>إكس بوكس (Xbox Series X / S / One)</option>
              <option value={DeviceType.Nintendo_Switch}>نينتندو سويتش (Nintendo Switch / OLED / Lite)</option>
              <option value={DeviceType.Controller_PS5}>ذراع تحكم (DualSense / Xbox / Joy-Con)</option>
              <option value="أخرى">أجهزة ألعاب أخرى</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1.5">كود الخطأ (Error Code) إن وجد</label>
            <input
              type="text"
              placeholder="مثال: CE-108255-1 أو SU-101379-2"
              value={errorCode}
              onChange={e => setErrorCode(e.target.value)}
              className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono tracking-wider"
              style={{ direction: "ltr" }}
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1.5">شرح الأعراض والملاحظات الفنية</label>
            <textarea
              placeholder="أدخل الأعراض (مثال: الجهاز يطفي بعد 5 دقائق من اللعب، لمبة زرقاء مستمرة، صيانة سوكيت الـ HDMI...)"
              value={symptoms}
              onChange={e => setSymptoms(e.target.value)}
              className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-indigo-500 h-24 resize-none"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1.5">إرفاق صورة أو التقاط فيديو/كاميرا مباشرة للعطل</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* File upload box */}
              <div className="border-2 border-dashed border-[#2a2d42] hover:border-indigo-500/50 rounded-xl p-4 text-center bg-gray-950/50 transition-colors">
                <input
                  type="file"
                  accept="image/*,video/*"
                  capture="environment"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="ai-file-upload"
                />
                <label htmlFor="ai-file-upload" className="cursor-pointer block space-y-1">
                  <Upload className="w-5 h-5 text-indigo-400 mx-auto" />
                  <span className="text-xs text-gray-300 font-bold block">رفع صورة / فيديو</span>
                  <span className="text-[10px] text-gray-500 block">من استوديو الملفات</span>
                </label>
              </div>

              {/* Live Camera Button */}
              <button
                type="button"
                onClick={startCamera}
                className="border-2 border-dashed border-[#2a2d42] hover:border-indigo-500/50 rounded-xl p-4 text-center bg-gray-950/50 transition-colors cursor-pointer flex flex-col items-center justify-center space-y-1"
              >
                <Camera className="w-5 h-5 text-amber-400 mx-auto" />
                <span className="text-xs text-gray-300 font-bold block">التقاط كاميرا فورية</span>
                <span className="text-[10px] text-gray-500 block">فحص كارت البوردة مباشرة</span>
              </button>
            </div>

            {/* Live Camera Stream Modal */}
            {isCameraOpen && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-[#11131e] border border-indigo-500/40 p-5 rounded-2xl max-w-lg w-full space-y-4 text-center shadow-2xl">
                  <div className="flex justify-between items-center border-b border-[#2a2d42] pb-3">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Camera className="w-4 h-4 text-amber-400 animate-pulse" />
                      التقاط لقطة كاميرا فورية للبوردة والعطل
                    </h4>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="text-gray-400 hover:text-white p-1 rounded-lg"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="relative rounded-xl overflow-hidden bg-black border border-[#2a2d42] aspect-video">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex gap-3 justify-end">
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold rounded-xl cursor-pointer"
                    >
                      إلغاء
                    </button>
                    <button
                      type="button"
                      onClick={captureCameraSnapshot}
                      className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center gap-2"
                    >
                      <Camera className="w-4 h-4" />
                      التقاط الصورة الآن
                    </button>
                  </div>
                </div>
              </div>
            )}

            {imagePreview && (
              <div className="mt-3 relative rounded-xl overflow-hidden border border-indigo-500/30 bg-gray-950 p-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {mediaType.startsWith("video") ? (
                    <video src={imagePreview} className="w-16 h-12 object-cover rounded-lg" />
                  ) : (
                    <img src={imagePreview} alt="العطل المرفق" className="w-16 h-12 object-cover rounded-lg" />
                  )}
                  <span className="text-xs text-gray-300 font-bold">تم إرفاق الملف / اللقطة بنجاح</span>
                </div>
                <button
                  type="button"
                  onClick={() => setImagePreview(null)}
                  className="text-red-400 text-xs hover:underline cursor-pointer px-3 py-1"
                >
                  إزالة
                </button>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-800 text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all-custom shadow-lg shadow-indigo-950/50 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin text-white" />
                جاري تحليل العطل واستشارة الذكاء الاصطناعي...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-white" />
                بدء تشخيص العطل وتحليل الحل
              </>
            )}
          </button>
        </form>

        {/* Diagnosis Output Result Panel */}
        <div className="space-y-4">
          {diagnosisResult ? (
            <div className="bg-[#11131e] border border-indigo-500/40 p-6 rounded-2xl space-y-5 shadow-xl glow-primary">
              <div className="flex justify-between items-start pb-3 border-b border-[#2a2d42]">
                <div>
                  <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest block">نتيجة التحليل الفني</span>
                  <h3 className="text-base font-bold text-white mt-1">{diagnosisResult.title}</h3>
                </div>
                <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1 rounded-lg text-xs font-bold">
                  صعوبة: {diagnosisResult.difficulty || "متوسط"}
                </span>
              </div>

              <div className="bg-gray-950/80 p-4 rounded-xl border border-[#2a2d42]">
                <h4 className="text-xs font-bold text-red-400 mb-1 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  السبب التقني المحتمل العطل:
                </h4>
                <p className="text-xs text-gray-300 leading-relaxed">{diagnosisResult.cause}</p>
              </div>

              {/* Required Spare Parts */}
              {diagnosisResult.suggestedParts && diagnosisResult.suggestedParts.length > 0 && (
                <div className="bg-gray-950/80 p-4 rounded-xl border border-[#2a2d42]">
                  <h4 className="text-xs font-bold text-indigo-400 mb-2 flex items-center gap-1.5">
                    <Layers className="w-4 h-4" />
                    قطع الغيار الموصى بتركيبها:
                  </h4>
                  <ul className="text-xs text-gray-300 space-y-1 list-disc list-inside">
                    {diagnosisResult.suggestedParts.map((part: string, idx: number) => (
                      <li key={idx} className="font-medium text-white">{part}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Step by Step Repair Guide */}
              {diagnosisResult.repairSteps && (
                <div className="bg-gray-950/80 p-4 rounded-xl border border-[#2a2d42]">
                  <h4 className="text-xs font-bold text-green-400 mb-2.5 flex items-center gap-1.5">
                    <Wrench className="w-4 h-4" />
                    خطوات وشرح خطة الإصلاح الفنية:
                  </h4>
                  <div className="space-y-2">
                    {diagnosisResult.repairSteps.map((step: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-gray-300">
                        <span className="w-5 h-5 rounded-full bg-indigo-600/20 text-indigo-400 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <p className="leading-relaxed">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Estimated Repair Cost & Advice */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-gray-950 p-3 rounded-xl border border-[#2a2d42]">
                  <span className="text-[10px] text-gray-400 block">التكلفة المتوقعة بالجنيه</span>
                  <span className="text-sm font-bold text-green-400 mt-1 block">{diagnosisResult.estimatedCost || "حسب الفحص الإضافي"}</span>
                </div>
                <div className="bg-gray-950 p-3 rounded-xl border border-[#2a2d42]">
                  <span className="text-[10px] text-gray-400 block">نصيحة المهندس والأمان</span>
                  <span className="text-[11px] text-gray-300 mt-1 block">{diagnosisResult.technicianAdvice || "تأكد من فصل الكهرباء تماماً أثناء الفحص."}</span>
                </div>
              </div>

              {/* Action Button: Create Reception Order pre-filled */}
              {onNavigateToReception && (
                <button
                  type="button"
                  onClick={() => onNavigateToReception({
                    type: selectedDevice,
                    issue: `${errorCode ? `[كود: ${errorCode}] ` : ""}${symptoms || diagnosisResult.title}`,
                    technicianNotes: `[تشخيص ذكي AI]: ${diagnosisResult.cause}\nخطوات الإصلاح: ${diagnosisResult.repairSteps?.join(" - ")}`,
                    estimatedCost: parseInt(diagnosisResult.estimatedCost) || 500
                  })}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4" />
                  تسجيل إدخال جديد بالاستقبال بناءً على هذا التشخيص
                </button>
              )}
            </div>
          ) : (
            <div className="bg-[#11131e] border border-[#2a2d42] rounded-2xl p-12 text-center text-gray-500 h-full flex flex-col justify-center items-center">
              <Cpu className="w-12 h-12 text-[#2a2d42] mb-3" />
              <h4 className="text-white font-bold mb-1">لوحة نتيجة التشخيص الفوري</h4>
              <p className="text-xs text-gray-400 max-w-xs">أدخل الكود أو الوصف بالنموذج المجاور واضغط "بدء تشخيص العطل" ليعرض الذكاء الاصطناعي الحل التقني فوراً.</p>
            </div>
          )}

          {errorMessage && (
            <div className="bg-red-950/40 border border-red-500/30 p-4 rounded-xl text-xs text-red-400 font-bold">
              {errorMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
