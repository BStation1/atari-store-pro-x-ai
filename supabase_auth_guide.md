# دليل تهيئة المصادقة وسياسات الأمان (Supabase Auth & RLS Guide)

يقدم هذا الدليل شرحاً كاملاً ومفصلاً لتهيئة نظام المصادقة في **Supabase** وحماية بيانات جدول البروفايل `profiles` باستخدام **Row Level Security (RLS)** لضمان وصول كل مستخدم لبياناته الشخصية فقط بناءً على معرفه الحقيقي `auth.uid()`.

---

## 1. بنية جدول `profiles` والربط مع `auth.users`

عند استخدام Supabase Auth، يتم حفظ بيانات الحساب الأساسية (البريد الإلكتروني، كلمة المرور المشفّرة، المعرف الفريد UUID) في المخطط المغلق `auth.users`. 
لربط بيانات المستخدم في التطبيق (الاسم، الدور، الفرع، إلخ)، يتم إنشاء جدول `public.profiles` حيث يكون مفتاحه الرئيسي `id` مطابقاً تماماً لـ `auth.uid()`.

### هيكل جدول `profiles` المقترح في SQL:
```sql
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'TECHNICIAN',
  branch TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 2. تفعيل وسياسات RLS لجدول `profiles`

تضمن سياسات **RLS (Row Level Security)** ألا يستطيع أي مستخدم قراءة أو تعديل أو حذف بيانات ملف شخصي آخر سوى الملف الخاص به المتطابق مع `auth.uid()`.

### step 1: تفعيل الـ RLS على الجدول
```sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
```

### step 2: سياسة القراءة (SELECT) - المستخدم يرى ملفه فقط
```sql
CREATE POLICY "المستخدم يرى ملفه الشخصي فقط"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);
```

### step 3: سياسة التعديل (UPDATE) - المستخدم يعدل ملفه فقط
```sql
CREATE POLICY "المستخدم يعدل ملفه الشخصي فقط"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
```

### step 4: سياسة الإدراج (INSERT) - إنشاء ملف يطابق الـ UUID
```sql
CREATE POLICY "المستخدم ينشئ ملفه الشخصي فقط"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);
```

---

## 3. إنشاء Trigger تلقائي عند تسجيل أي مستخدم جديد (مستحسن)

لضمان مزامنة مستخدمي `auth.users` تلقائياً إلى جدول `public.profiles` فور تسجيلهم من خلال Supabase Auth، أضف السكربت التالي:

```sql
-- دالة إنشاء البروفايل التلقائي
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'TECHNICIAN')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- المشغل Trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## 4. التحقق اللحظي من الجلسات عبر `supabase.auth.onAuthStateChange`

في جانب العميل (Client Application)، تم تعديل ملف `src/lib/authStore.ts` ليستمع لحظياً لأحداث المصادقة القادمة من Supabase.

### كيفية العمل في `src/lib/authStore.ts`:
```typescript
if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || session?.user) {
      if (session?.user) {
        const authUser = session.user;
        
        // 1. التزامن مع بيانات المستخدم المحلية
        let localUser = authStore.getUsers().find(u => u.id === authUser.id || u.email === authUser.email);
        
        // 2. تحديث معرف الجلسة بـ auth.uid() الحقيقي
        if (localUser) {
          localUser.id = authUser.id;
        }

        // 3. إنشاء وتنشيط الجلسة الحالية
        authStore.createSession(authUser.id);

        // 4. رفع وتحديث بيانات البروفايل في جدول profiles
        await authStore.syncProfileToSupabase(localUser || authUser, authUser.id);
      }
    } else if (event === "SIGNED_OUT" || !session) {
      // 5. إنهاء الجلسة فور تسجيل الخروج
      localStorage.removeItem("atari_current_session_v2");
      window.dispatchEvent(new Event("atari_auth_changed"));
    }
  });
}
```

---

## 5. خطوات التطبيق في لوحة تحكم Supabase

1. افتح **Supabase Dashboard** للمشروع الخاص بك.
2. توجه إلى **SQL Editor** من القائمة الجانبية.
3. انسخ وشغّل الاستعلامات الموضحة في النقطتين (2) و (3) لتنشيط RLS وإضافة الـ Trigger.
4. توجه إلى **Authentication -> Users** لتأكيد تسجيل كافة المستخدمين بشكل صحيح وسليم.

---

## 6. حل مشكلة الأمان `new row violates row-level security policy for table "customers"`

تظهر هذه المشكلة عندما يكون خيار **Row Level Security (RLS)** مفعّلاً على جدول العملاء `customers` أو جداول النظام في Supabase دون وجود سياسات سماح بالإدراج (INSERT) أو التعديل (UPDATE).

### الحل الأول: إضافة سياسات أمان شاملة لجداول النظام (المستحسن)
قم بتشغيل السكربت التالي في **SQL Editor** بـ Supabase لإعطاء صلاحيات القراءة والإضافة والتحديث للعملاء وكافة الجداول:

```sql
-- 1. جداول العملاء (customers)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "سماح جميع العمليات للعملاء" ON public.customers;
CREATE POLICY "سماح جميع العمليات للعملاء"
ON public.customers
FOR ALL
TO public, authenticated, anon
USING (true)
WITH CHECK (true);

-- 2. جداول الموردين (suppliers)
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "سماح جميع العمليات للموردين" ON public.suppliers;
CREATE POLICY "سماح جميع العمليات للموردين"
ON public.suppliers
FOR ALL
TO public, authenticated, anon
USING (true)
WITH CHECK (true);

-- 3. جداول المنتجات والمخزون (products)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "سماح جميع العمليات للمنتجات" ON public.products;
CREATE POLICY "سماح جميع العمليات للمنتجات"
ON public.products
FOR ALL
TO public, authenticated, anon
USING (true)
WITH CHECK (true);

-- 4. جداول أذونات الصيانة (repair_orders)
ALTER TABLE public.repair_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "سماح جميع العمليات لأوامر الصيانة" ON public.repair_orders;
CREATE POLICY "سماح جميع العمليات لأوامر الصيانة"
ON public.repair_orders
FOR ALL
TO public, authenticated, anon
USING (true)
WITH CHECK (true);

-- 5. جداول الفواتير (invoices)
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "سماح جميع العمليات للفواتير" ON public.invoices;
CREATE POLICY "سماح جميع العمليات للفواتير"
ON public.invoices
FOR ALL
TO public, authenticated, anon
USING (true)
WITH CHECK (true);
```

### الحل الثاني: إيقاف RLS عن الجداول العامة (في حال لم تكن بحاجة لتقييد الجداول العامة)
إذا كنت تريد إيقاف الحظر تماماً عن جداول النظام الجانبية:
```sql
ALTER TABLE public.customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices DISABLE ROW LEVEL SECURITY;
```

---
تم إعداد هذا المستند لضمان أقصى درجات الأمان والالتزام بالوصول المصرح به عبر `auth.uid()`.
