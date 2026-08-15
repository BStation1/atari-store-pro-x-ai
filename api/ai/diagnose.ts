import { GoogleGenAI } from '@google/genai';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const { errorCode, deviceModel, symptoms, imageData, mediaType } = req.body || {};
    if (!errorCode?.trim() && !symptoms?.trim() && !imageData) {
      return res.status(400).json({ success: false, error: 'يجب إدخال كود الخطأ أو وصف الأعراض أو إرفاق صورة.' });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ success: false, error: 'GEMINI_API_KEY غير مضاف في إعدادات Vercel.' });
    }

    const ai = new GoogleGenAI({ apiKey });
    const systemPrompt = `أنت مهندس متخصص في تشخيص وصيانة أجهزة الألعاب PS5 وPS4 وXbox وNintendo Switch وأذرع التحكم. حلل الحالة المدخلة نفسها ولا تستخدم تشخيصاً عاماً ثابتاً. فرّق بدقة بين أكواد الأخطاء المختلفة. إذا كان كود الخطأ معروفاً اشرح معناه أولاً، ثم اربط الأعراض به. لا تدّعي أن عطل هاردوير مؤكد إذا كان الكود يشير غالباً إلى سوفتوير أو شبكة أو تخزين. اذكر الاحتمالات بالترتيب وخطوات اختبار آمنة قبل استبدال أي قطعة. أجب بالعربية وبصيغة JSON فقط بهذا الشكل: {"title":"","cause":"","difficulty":"","suggestedParts":[],"repairSteps":[],"estimatedCost":"","technicianAdvice":""}`;

    const userQuery = `الجهاز: ${deviceModel || 'غير محدد'}\nكود الخطأ: ${errorCode || 'غير محدد'}\nالأعراض: ${symptoms || 'غير محددة'}\nقدّم تشخيصاً خاصاً بهذه الحالة فقط.`;
    const contents: any[] = [{ text: systemPrompt }, { text: userQuery }];

    if (imageData) {
      const match = String(imageData).match(/^data:([^;]+);base64,(.+)$/s);
      const data = match ? match[2] : String(imageData);
      const mimeType = match?.[1] || mediaType || 'image/jpeg';
      contents.splice(1, 0, { inlineData: { data, mimeType } });
    }

    let response: any;
    const models = ['gemini-2.5-flash', 'gemini-2.0-flash'];
    let lastError: any;
    for (const model of models) {
      try {
        response = await ai.models.generateContent({ model, contents, config: { responseMimeType: 'application/json', temperature: 0.25 } });
        break;
      } catch (err) {
        lastError = err;
      }
    }
    if (!response) throw lastError || new Error('Gemini request failed');

    const text = response.text || '{}';
    let diagnosis: any;
    try { diagnosis = JSON.parse(text); }
    catch { throw new Error('Gemini returned invalid JSON'); }

    return res.status(200).json({ success: true, source: 'gemini_ai', diagnosis });
  } catch (err: any) {
    console.error('Gemini Diagnosis Error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'حدث خطأ أثناء الاتصال بالمساعد الذكي.' });
  }
}
