# 🎮 ATARI STORE PRO X - نظام إدارة المبيعات والصيانة والمحاسبة المتكامل

نظام إداري متكامل وشامل مُصمم خصيصاً لمراكز صيانة ومعارض أجهزة الألعاب والكونسول (PlayStation, Xbox, Nintendo) والإلكترونيات.

---

## 📋 الميزات الأساسية

- **قسم الاستقبال والصيانة (Reception & Repair):** إدارة كروت الصيانة، الفحص الفني، تتبع حالة الأجهزة، طباعة الباركوود، والتشخيص بالذكاء الاصطناعي (Gemini AI).
- **نقطة البيع والمبيعات (POS & Sales):** إنشاء فواتير المبيعات والمرتجعات، دعم القارئ اللاسلكي للباركوود، وطباعة الإيصالات والفواتير الحرارية.
- **إدارة المخزون وقطع الغيار (Inventory & Spare Parts):** تتبع أعداد الأجهزة والقطع، جرد المخزن، وتنبيهات النواقص.
- **الحسابات والمصروفات (Accounting & Financials):** قيود اليومية، حركات الخزينة، أرباح وخسائر، وتصفية الشركاء.
- **إدارة الصلاحيات (Role-Based Access Control):** أدوار المالك (OWNER)، الاستقبال، المهندسين، مع حماية العمليات الخطيرة.
- **النسخ الاحتياطي وإدارة البيانات (Backup & Reset):** تصدير واسترجاع بيانات النظام بالكامل بنقرة واحدة.

---

## 🛠️ متطلبات التشغيل (Prerequisites)

- **Node.js**: الإصدار `18.0.0` أو أحدث.
- **npm**: الإصدار `9.0.0` أو أحدث (أو `bun` / `pnpm`).

---

## 🚀 خطوات التشغيل المحلي (Local Setup)

### 1. تثبيت الحزم (Install Dependencies)
افتح المجلد في الموجه النصي (Terminal) ونفذ الأمر التالية:

```bash
npm install
```

### 2. إعداد متغيرات البيئة (Environment Variables)
قم بإنشاء ملف باسم `.env` في المجلد الرئيسي واستنسخ محتويات `.env.example`:

```bash
cp .env.example .env
```

ثم قم بتعبئة المتغيرات المطلوب تعديلها (انظر قسم متغيرات البيئة أدناه).

### 3. تشغيل بيئة التطوير (Development Server)
لتشغيل المشروع في وضع التطوير المحلي مع خاصية التحديث المباشر:

```bash
npm run dev
```

سيعمل التطبيق افتراضياً على الرابط: `http://localhost:3000`

---

## 📦 بناء وتشغيل الإنتاج (Production Build & Run)

### 1. بناء المشروع (Build)
لبناء ملفات الواجهة الأمامية وخادم Express للإنتاج:

```bash
npm run build
```

### 2. تشغيل سيرفر الإنتاج (Start Production Server)
لتشغيل السيرفر بعد عملية البناء (Build):

```bash
npm start
```

### 3. معايرة البناء المحلي (Preview)
لمعاينة ملفات الـ Static Build عبر Vite:

```bash
npm run preview
```

---

## 🔑 قائمة متغيرات البيئة (Environment Variables)

عند النشر على **Vercel** أو **Render** أو **Railway**، يرجى إضافة المتغيرات التالية في إعدادات البيئة (Environment Variables):

| اسم المتغير | الوصف | إجباري؟ | القيمة الافتراضية / مثال |
| :--- | :--- | :---: | :--- |
| `GEMINI_API_KEY` | مفتاح الذكاء الاصطناعي من Google Gemini للتشخيص الفني المتقدم الأوتوماتيكي بالأعطال والصور. | اختياري | `AIzaSy...` (في حال عدم توفره يعمل بالذكاء المحلي) |
| `APP_URL` | رابط النشر النهائي الخاص بالموقع. | اختياري | `https://your-app-name.vercel.app` |
| `NODE_ENV` | وضع بيئة التشغيل. | نعم | `production` |
| `PORT` | المنفذ الخاص ببدء الخادم (تحدده المنصة أوتوماتيكياً). | نعم | `3000` |

> 💡 **ملاحظة حول Supabase / Firebase / Databases:**
> النظام الحالي يحفظ البيانات محلياً بسلسلة تشفير سريعة في متصفح العميل (Client Storage Engine) مع دعم التصدير والاسترجاع اليدوي وتزامنات السيرفر، لذلك **لا يتطلب** ربط Supabase URL أو Keys عند النشر الأولي.

---

## 🌐 خطوات النشر على GitHub و Vercel

### أولاً: الرفع على GitHub
1. قم بإنشاء مستودع جديد (Repository) على حسابك في GitHub باسم `atari-store-pro-x`.
2. ربط المستودع المحلي بالـ Remote ومرفع الكود:

```bash
git init
git add .
git commit -m "Initial commit - Atari Store Pro X"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/atari-store-pro-x.git
git push -u origin main
```

### ثانياً: النشر على Vercel
1. سجل الدخول إلى موقع [Vercel](https://vercel.com).
2. اضغط على **Add New...** ثم **Project**.
3. اختر مستودع الـ GitHub الخاص بالبرنامج (`atari-store-pro-x`).
4. في شاشة الإعدادات:
   - **Framework Preset**: اختر `Vite` أو `Other`.
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Environment Variables**: أضف `GEMINI_API_KEY` إن وجد.
5. اضغط **Deploy**.

---

## 🧪 التحقق والاختبار (Verification)

للتأكد من عدم وجود أي خطأ في ألياف TypeScript قبل رفع الكود:

```bash
npm run lint
```
