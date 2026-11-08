import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response(405, { error: "POST required" });

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return response(500, { error: "Edge Function secrets are not configured" });

  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return response(401, { error: "Sign in required" });

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(jwt);
  if (userError || !userData.user) return response(401, { error: "Invalid session" });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: caller, error: callerError } = await admin.from("profiles")
    .select("id, role, access_status").eq("id", userData.user.id).single();
  if (callerError || !caller || caller.role !== "owner" || caller.access_status !== "active") {
    return response(403, { error: "Only an active owner may invite team members" });
  }

  let payload: { email?: string; full_name?: string; role?: string };
  try { payload = await req.json(); }
  catch { return response(400, { error: "Invalid JSON" }); }

  const email = String(payload.email || "").trim().toLowerCase();
  const fullName = String(payload.full_name || "").trim();
  const role = String(payload.role || "member");
  if (!/^\S+@\S+\.\S+$/.test(email)) return response(400, { error: "Enter a valid email address" });
  if (!fullName || fullName.length > 120) return response(400, { error: "Enter a name up to 120 characters" });
  if (!(role === "member" || role === "viewer")) return response(400, { error: "Allowed roles: member, viewer" });

  const redirectTo = Deno.env.get("APP_REDIRECT_URL");
  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    ...(redirectTo ? { redirectTo } : {}),
  });
  if (inviteError || !inviteData.user) return response(400, { error: inviteError?.message || "Could not send invitation" });

  const { error: profileError } = await admin.from("profiles").upsert({
    id: inviteData.user.id,
    email,
    full_name: fullName,
    role,
    bio: "",
    avatar_url: "",
    access_status: "invited",
  }, { onConflict: "id" });
  if (profileError) return response(500, { error: `Invitation sent, but profile setup failed: ${profileError.message}`, user_id: inviteData.user.id });

  return response(200, {
    ok: true,
    user_id: inviteData.user.id,
    email,
    role,
    access_status: "invited",
    message: "Invitation email sent. The account remains blocked until the owner approves it.",
  });
});
