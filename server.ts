/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

import { createClient } from "@supabase/supabase-js";

// Rate limiting map for public tracking requests
const trackingAttempts = new Map<string, { count: number; resetTime: number }>();

function normalizePhoneForServer(phone?: string | null): string {
  if (!phone) return "";
  let digits = String(phone).replace(/\D/g, "");
  if (digits.startsWith("20") && digits.length === 12) {
    digits = digits.slice(2);
  }
  if (digits.startsWith("01") && digits.length === 11) {
    digits = digits.slice(1);
  }
  return digits;
}

function isPhoneMatchServer(phoneA?: string | null, phoneB?: string | null): boolean {
  if (!phoneA || !phoneB) return false;
  const nA = normalizePhoneForServer(phoneA);
  const nB = normalizePhoneForServer(phoneB);
  if (!nA || !nB) return false;
  if (nA === nB) return true;
  if (nA.length >= 8 && nB.length >= 8) {
    return nA.includes(nB) || nB.includes(nA);
  }
  return false;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support base64 image & video uploads up to 50MB
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // API Route: Public Tracking (No login required, rate-limited)
  app.post("/api/public/track", async (req, res) => {
    try {
      const ip = (req.headers["x-forwarded-for"] as string) || req.ip || "unknown";
      const now = Date.now();
      const userRate = trackingAttempts.get(ip) || { count: 0, resetTime: now + 60000 };

      if (now > userRate.resetTime) {
        userRate.count = 0;
        userRate.resetTime = now + 60000;
      }

      userRate.count += 1;
      trackingAttempts.set(ip, userRate);

      if (userRate.count > 20) {
        return res.status(429).json({
          success: false,
          error: "تم تجاوز عدد المحاولات المسموح بها. يرجى الانتظار دقيقة وإعادة المحاولة."
        });
      }

      const { token, phone } = req.body || {};
      const cleanToken = String(token || "").trim().toLowerCase();
      const cleanPhone = String(phone || "").trim();

      if (!cleanToken || !cleanPhone) {
        return res.status(400).json({
          success: false,
          error: "رقم الهاتف أو بيانات التتبع غير صحيحة."
        });
      }

      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "https://snwizwgmgwxiotrfmkzm.supabase.co";
      const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_XltOYCOplUoZI3RiHlWB9w_H9YF-S5q";

      const supabaseServer = createClient(supabaseUrl, supabaseKey);

      // 1. Try Supabase RPC get_public_tracking_order
      const { data: rpcData, error: rpcError } = await supabaseServer.rpc("get_public_tracking_order", {
        p_token: cleanToken,
        p_phone: cleanPhone
      });

      if (!rpcError && rpcData) {
        return res.json({
          success: true,
          order: rpcData
        });
      }

      // 2. Fallback: Query store_settings or local table if RPC is not present
      const { data: orders, error: fetchErr } = await supabaseServer
        .from("repair_orders")
        .select("id, order_number, tracking_token, status, created_at, estimated_cost, final_cost, reported_issue, device_type, device_model, serial_number, notes, customer_id");

      if (!fetchErr && orders && orders.length > 0) {
        const matched = orders.find(o => {
          const isTokenMatch =
            (o.tracking_token && o.tracking_token.toLowerCase() === cleanToken) ||
            (o.order_number && o.order_number.toLowerCase() === cleanToken) ||
            String(o.id).toLowerCase() === cleanToken;

          if (!isTokenMatch) return false;

          // Check phone match in notes or meta
          let notesObj: any = {};
          try {
            if (o.notes && o.notes.startsWith("{")) {
              notesObj = JSON.parse(o.notes);
            }
          } catch {}

          const snapPhone = notesObj.customerPhoneSnapshot || notesObj.guestCustomerPhone || "";
          return isPhoneMatchServer(cleanPhone, snapPhone);
        });

        if (matched) {
          let notesObj: any = {};
          try {
            if (matched.notes && matched.notes.startsWith("{")) notesObj = JSON.parse(matched.notes);
          } catch {}

          const customerSafeOrder = {
            id: matched.order_number || matched.id,
            trackingToken: matched.tracking_token,
            status: matched.status,
            receivedDate: matched.created_at,
            completionDate: notesObj.completionDate || null,
            totalEstimatedCost: matched.estimated_cost || 0,
            finalRepairPrice: matched.final_cost || matched.estimated_cost || 0,
            advancePayment: notesObj.advancePayment || 0,
            isPaid: notesObj.isPaid || matched.status === "DELIVERED",
            warrantyDays: notesObj.warrantyDays || null,
            warrantyEndDate: notesObj.warrantyEndDate || null,
            customerName: notesObj.customerNameSnapshot || notesObj.guestCustomerName || "عميلنا العزيز",
            devices: notesObj.devices || [
              {
                id: matched.id,
                type: matched.device_type || "أجهزة ألعاب",
                model: matched.device_model || "موديل قياسي",
                serialNumber: matched.serial_number || "",
                issue: matched.reported_issue || "فحص ومعايرة الكشف العام",
                status: matched.status,
                estimatedCost: matched.estimated_cost || 0,
                finalRepairPrice: matched.final_cost || 0
              }
            ],
            timelineEvents: notesObj.timelineEvents || []
          };

          return res.json({
            success: true,
            order: customerSafeOrder
          });
        }
      }

      return res.status(400).json({
        success: false,
        error: "رقم الهاتف أو بيانات التتبع غير صحيحة."
      });

    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: "رقم الهاتف أو بيانات التتبع غير صحيحة."
      });
    }
  });

  // API Route: AI Diagnostics
  app.post("/api/ai/diagnose", async (req, res) => {
    try {
      const { errorCode, deviceModel, symptoms, imageData, mediaType } = req.body;

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        // Fallback response with technical expertise if key is missing in dev
        return res.json({
          success: true,
          source: "knowledge_base",
          diagnosis: {
            title: `تشخيص خطأ ${errorCode || deviceModel || "العطل المكتشف"}`,
            cause: "تلف خادع في مكونات الدائرة أو انقطاع مسار الإشارة الرئيسية للماذربورد",
            difficulty: "متوسط إلى مرتفع (يحتاج محطة هوائي ساخن Hot Air Solder)",
            suggestedParts: ["أيسيه ترميز أو مقاومة بديلة", "مكثف سيراميك SMD", "سوكيت أصلي"],
            repairSteps: [
              "فحص المكونات تحت المجهر الرقمي للتحقق من عدم وجود آثار حروق أو رطوبة.",
              "قياس الممانعات بالأفوميتر (Diode Mode) على خطوط التغذية الرئيسية 12V و 3.3V.",
              "استبدال القطعة المتضررة واستخدام مساعد اللحام Flux بجودة عالية عند درجة حرارة 360-380 مئوية.",
              "تنظيف البوردة بكحول الآيزوبروبيل وإعادة معايرة الجهاز بعد الاختبار."
            ],
            estimatedCost: "800 - 1800 ج.م",
            technicianAdvice: "تأكد من فصل مصدر الطاقة تماماً وتفريغ الشحنات الكهربائية قبل القصر وتجربة القياس."
          }
        });
      }

      const ai = new GoogleGenAI({ apiKey });

      const systemPrompt = `أنت مهندس خبير ومحترف جداً في صيانة وإصلاح أجهزة الألعاب والكونسول (PS5, PS4, Xbox Series X/S, Nintendo Switch, DualSense controllers).
مهمتك تقديم تشخيص دقيق وتقني لأي كود أخطاء (Error Code) أو صورة/فيديو عطل أو وصف أعطال.
أجب باللغة العربية بأسلوب تقني منظم ومبسط بالفنيين.

قم بإرجاع إجابتك بصيغة JSON حصرية بالهيكل التالي:
{
  "title": "عنوان التشخيص والعطل الأساسي",
  "cause": "السبب التقني والمكونات المتسببة بالخلل",
  "difficulty": "مستوى الصعوبة (سهل / متوسط / معقد وخاطر)",
  "suggestedParts": ["قائمة قطع الغيار المطلوبة"],
  "repairSteps": [
    "خطوة الإصلاح 1 مع إرشادات الحرارة واللحام إن وجدت",
    "خطوة الإصلاح 2",
    "خطوة الإصلاح 3"
  ],
  "estimatedCost": "التكلفة التقديرية المقترحة للجزء والعمالة بالجنيه المصري",
  "technicianAdvice": "نصائح وتحذيرات أمان للمهندس أثناء العمل"
}`;

      let contents: any[] = [];
      let userQuery = `طلب تشخيص صيانة جهاز ألعاب:
- كود الخطأ: ${errorCode || "غير محدد"}
- نوع/موديل الجهاز: ${deviceModel || "غير محدد"}
- الأعراض والملاحظات: ${symptoms || "يرجى تحليل الصورة/الفيديو المرفق"}`;

      if (imageData) {
        // Handle inline image / video base64
        const base64Clean = imageData.replace(/^data:(image|video)\/\w+;base64,/, "");
        const mimeType = mediaType || "image/jpeg";
        contents = [
          systemPrompt,
          {
            inlineData: {
              data: base64Clean,
              mimeType: mimeType
            }
          },
          userQuery
        ];
      } else {
        contents = [systemPrompt, userQuery];
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: contents,
        config: {
          responseMimeType: "application/json"
        }
      });

      const responseText = response.text || "{}";
      const parsedDiagnosis = JSON.parse(responseText);

      return res.json({
        success: true,
        source: "gemini_ai",
        diagnosis: parsedDiagnosis
      });

    } catch (err: any) {
      console.error("Gemini Diagnosis Error:", err);
      return res.status(500).json({
        success: false,
        error: err.message || "حدث خطأ أثناء الاتصال بالمساعد الذكي للتشخيص"
      });
    }
  });

  // Health check API
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", app: "Atari Store Pro X" });
  });

  // Vite development middleware vs Static Production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);

    app.use("*", async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
