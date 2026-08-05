import { GoogleGenAI } from "@google/genai";

const SYSTEM_PROMPT = `أنت مهندس خبير ومحترف جداً في صيانة وإصلاح أجهزة الألعاب والكونسول (PS5, PS4, Xbox Series X/S, Nintendo Switch, DualSense controllers).
مهمتك تقديم تشخيص دقيق وتقني اعتماداً على بيانات العطل المرسلة فقط. فرّق بوضوح بين الأعطال، ولا تستخدم إجابة عامة تصلح لكل الحالات.
إذا كانت البيانات غير كافية، اذكر بوضوح أن التشخيص مبدئي وحدد القياسات أو الاختبارات المطلوبة للتأكيد.
أجب باللغة العربية بأسلوب تقني منظم ومفيد للفنيين.

أرجع JSON فقط بالهيكل التالي:
{
  "title": "عنوان تشخيص محدد للحالة",
  "cause": "الأسباب المحتملة المرتبة مع ربطها بالأعراض وكود الخطأ",
  "difficulty": "سهل أو متوسط أو معقد وخطر",
  "suggestedParts": ["قطع محتملة، ولا تذكر قطعة غير مرتبطة بالحالة"],
  "repairSteps": ["خطوات فحص وإصلاح مرتبة تبدأ بالقياسات غير المدمرة"],
  "estimatedCost": "نطاق تقديري بالجنيه المصري مع توضيح أنه يتأكد بعد الفحص",
  "technicianAdvice": "تحذيرات ونقاط تأكيد التشخيص"
}`;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate"
    }
  });
}

function cleanBase64(dataUrl: string): string {
  const commaIndex = dataUrl.indexOf(",");
  return commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const errorCode = String(body?.errorCode || "").trim();
    const deviceModel = String(body?.deviceModel || "").trim();
    const symptoms = String(body?.symptoms || "").trim();
    const imageData = typeof body?.imageData === "string" ? body.imageData : "";
    const mediaType = String(body?.mediaType || "image/jpeg");

    if (!errorCode && !symptoms && !imageData) {
      return json(400, { success: false, error: "أدخل كود الخطأ أو وصف الأعراض أو صورة للعطل." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return json(503, {
        success: false,
        code: "AI_NOT_CONFIGURED",
        error: "خدمة التشخيص الذكي غير مفعلة: أضف GEMINI_API_KEY في إعدادات Vercel ثم أعد النشر."
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const userQuery = `حلل هذه الحالة بشكل مستقل ولا تعتمد على إجابات سابقة:\n- الجهاز: ${deviceModel || "غير محدد"}\n- كود الخطأ: ${errorCode || "لا يوجد"}\n- الأعراض: ${symptoms || "راجع الوسائط المرفقة"}\n\nاربط التشخيص بهذه البيانات تحديداً، واذكر اختبارات تأكيد مناسبة قبل تغيير أي قطعة.`;

    const contents: any[] = [{ text: SYSTEM_PROMPT }, { text: userQuery }];
    if (imageData) {
      contents.splice(1, 0, {
        inlineData: {
          data: cleanBase64(imageData),
          mimeType: mediaType
        }
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents,
      config: {
        responseMimeType: "application/json",
        temperature: 0.35
      }
    });

    const responseText = response.text?.trim();
    if (!responseText) {
      return json(502, { success: false, error: "لم يرجع نموذج التشخيص نتيجة." });
    }

    let diagnosis: unknown;
    try {
      diagnosis = JSON.parse(responseText);
    } catch {
      return json(502, { success: false, error: "رجع نموذج التشخيص نتيجة غير صالحة. أعد المحاولة." });
    }

    return json(200, {
      success: true,
      source: "gemini_ai",
      diagnosis
    });
  } catch (error: any) {
    console.error("AI diagnosis function error:", error);
    return json(500, {
      success: false,
      error: error?.message || "حدث خطأ أثناء الاتصال بخدمة التشخيص الذكي."
    });
  }
}
