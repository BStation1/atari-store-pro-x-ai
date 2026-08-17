/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support base64 image & video uploads up to 50MB
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Public repair tracking intentionally does not live in this Express server.
  // The browser calls the narrowly-scoped Supabase RPC directly so Vercel/dev
  // deployments cannot silently fall back to an unsafe repair_orders table scan.

  // API Route: AI Diagnostics
  app.post("/api/ai/diagnose", async (req, res) => {
    try {
      const { errorCode, deviceModel, symptoms, imageData, mediaType } = req.body;

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
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

      const userQuery = `طلب تشخيص صيانة جهاز ألعاب:
- كود الخطأ: ${errorCode || "غير محدد"}
- نوع/موديل الجهاز: ${deviceModel || "غير محدد"}
- الأعراض والملاحظات: ${symptoms || "يرجى تحليل الصورة/الفيديو المرفق"}`;

      let contents: any[];
      if (imageData) {
        const base64Clean = imageData.replace(/^data:(image|video)\/\w+;base64,/, "");
        contents = [
          systemPrompt,
          {
            inlineData: {
              data: base64Clean,
              mimeType: mediaType || "image/jpeg"
            }
          },
          userQuery
        ];
      } else {
        contents = [systemPrompt, userQuery];
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents,
        config: { responseMimeType: "application/json" }
      });

      const parsedDiagnosis = JSON.parse(response.text || "{}");
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

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", app: "Atari Store Pro X" });
  });

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
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
