import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply({ success: false, error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return reply({ success: false, error: "انتهت الجلسة. سجل الدخول مرة أخرى." }, 401);
    }

    const callerClient = createClient(url, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller) {
      return reply({ success: false, error: "انتهت الجلسة. سجل الدخول مرة أخرى." }, 401);
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: callerProfile, error: callerProfileError } = await admin
      .from("profiles")
      .select("role,is_active")
      .eq("id", caller.id)
      .maybeSingle();

    if (callerProfileError || !callerProfile || callerProfile.is_active === false || String(callerProfile.role).toUpperCase() !== "OWNER") {
      return reply({ success: false, error: "إعادة تعيين كلمات المرور متاحة لمالك النظام فقط." }, 403);
    }

    const body = await req.json();
    const targetUserId = String(body?.userId || "").trim();
    const newPassword = String(body?.newPassword || "");

    if (!targetUserId) return reply({ success: false, error: "معرف المستخدم غير صالح." }, 400);
    if (newPassword.length < 6) return reply({ success: false, error: "كلمة المرور المؤقتة يجب ألا تقل عن 6 أحرف." }, 400);
    if (targetUserId === caller.id) {
      return reply({ success: false, error: "غيّر كلمة مرور حساب OWNER الحالي من إعدادات حسابه، وليس من إعادة تعيين الموظفين." }, 400);
    }

    const { data: targetProfile, error: targetError } = await admin
      .from("profiles")
      .select("id,full_name,email,role,is_active")
      .eq("id", targetUserId)
      .maybeSingle();

    if (targetError) return reply({ success: false, error: targetError.message }, 500);
    if (!targetProfile) return reply({ success: false, error: "المستخدم غير موجود." }, 404);
    if (String(targetProfile.role).toUpperCase() === "OWNER") {
      return reply({ success: false, error: "لا يمكن إعادة تعيين كلمة مرور OWNER من شاشة الموظفين." }, 400);
    }

    const { error: authUpdateError } = await admin.auth.admin.updateUserById(targetUserId, {
      password: newPassword
    });
    if (authUpdateError) {
      return reply({ success: false, error: `تعذر تحديث كلمة المرور: ${authUpdateError.message}` }, 500);
    }

    const { error: profileUpdateError } = await admin
      .from("profiles")
      .update({ must_change_password: true, updated_at: new Date().toISOString() })
      .eq("id", targetUserId);

    if (profileUpdateError) {
      return reply({ success: false, error: `تم تغيير كلمة المرور لكن تعذر تفعيل طلب تغييرها عند الدخول: ${profileUpdateError.message}` }, 500);
    }

    return reply({
      success: true,
      user: {
        id: targetUserId,
        name: targetProfile.full_name || targetProfile.email || "المستخدم"
      },
      mustChangePassword: true
    });
  } catch (error) {
    return reply({ success: false, error: error instanceof Error ? error.message : "Password reset failed" }, 500);
  }
});
