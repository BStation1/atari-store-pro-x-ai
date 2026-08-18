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
    const { data: callerProfile } = await admin
      .from("profiles")
      .select("role,is_active")
      .eq("id", caller.id)
      .maybeSingle();

    if (!callerProfile || callerProfile.is_active === false || String(callerProfile.role).toUpperCase() !== "OWNER") {
      return reply({ success: false, error: "حذف المستخدمين متاح لمالك النظام فقط." }, 403);
    }

    const body = await req.json();
    const targetUserId = String(body?.userId || "").trim();
    if (!targetUserId) return reply({ success: false, error: "معرف المستخدم غير صالح." }, 400);
    if (targetUserId === caller.id) return reply({ success: false, error: "لا يمكنك حذف حسابك الحالي." }, 400);

    const { data: targetProfile, error: targetError } = await admin
      .from("profiles")
      .select("id,full_name,email,role")
      .eq("id", targetUserId)
      .maybeSingle();

    if (targetError) return reply({ success: false, error: targetError.message }, 500);
    if (!targetProfile) return reply({ success: false, error: "المستخدم غير موجود." }, 404);
    if (String(targetProfile.role).toUpperCase() === "OWNER") {
      return reply({ success: false, error: "لا يمكن حذف حساب OWNER من شاشة المستخدمين." }, 400);
    }

    // Delete the Auth user first. Supabase admin delete invalidates future sign-ins.
    const { error: authDeleteError } = await admin.auth.admin.deleteUser(targetUserId);
    if (authDeleteError) {
      return reply({ success: false, error: `تعذر حذف حساب الدخول: ${authDeleteError.message}` }, 500);
    }

    // The project currently has no FK cascade from auth.users to profiles, so remove it explicitly.
    const { error: profileDeleteError } = await admin.from("profiles").delete().eq("id", targetUserId);
    if (profileDeleteError) {
      return reply({
        success: false,
        error: `تم حذف حساب الدخول ولكن تعذر حذف ملف المستخدم: ${profileDeleteError.message}`
      }, 500);
    }

    return reply({
      success: true,
      deletedUser: {
        id: targetUserId,
        name: targetProfile.full_name || targetProfile.email || "المستخدم"
      }
    });
  } catch (error) {
    return reply({ success: false, error: error instanceof Error ? error.message : "Delete failed" }, 500);
  }
});
