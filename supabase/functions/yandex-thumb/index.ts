// Прокси превью из Яндекс.Диска.
// Браузер не видит токен Диска: он передаёт только свой Supabase-токен,
// функция проверяет доступ и отдаёт картинку сама.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const DISK_API = "https://cloud-api.yandex.net/v1/disk";
const OAUTH_TOKEN = "https://oauth.yandex.ru/token";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  const path = url.searchParams.get("p") || "";
  const jwt = url.searchParams.get("t") || "";
  if (!path || !jwt) return new Response("bad request", { status: 400, headers: CORS });
  if (!path.startsWith("disk:/ПБ24/")) return new Response("forbidden", { status: 403, headers: CORS });

  const supaUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const clientId = Deno.env.get("YANDEX_CLIENT_ID") || "";
  const clientSecret = Deno.env.get("YANDEX_CLIENT_SECRET") || "";
  if (!supaUrl || !anonKey || !serviceKey) return new Response("not configured", { status: 500, headers: CORS });

  const userClient = createClient(supaUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await userClient.auth.getUser(jwt);
  if (userError || !userData.user) return new Response("unauthorized", { status: 401, headers: CORS });

  const admin = createClient(supaUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile } = await admin.from("profiles").select("role, access_status").eq("id", userData.user.id).single();
  if (!profile || profile.access_status !== "active" || !["owner", "member", "viewer"].includes(profile.role)) {
    return new Response("forbidden", { status: 403, headers: CORS });
  }

  const { data: rows } = await admin.from("yandex_tokens").select("*").order("updated_at", { ascending: false }).limit(1);
  const row = rows && rows[0];
  if (!row) return new Response("disk not connected", { status: 404, headers: CORS });

  let access = row.access_token as string;
  const expired = row.expires_at ? new Date(row.expires_at).getTime() <= Date.now() : false;
  if (expired && row.refresh_token) {
    try {
      const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: row.refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
      });
      const rr = await fetch(OAUTH_TOKEN, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      if (rr.ok) {
        const data = await rr.json();
        access = data.access_token;
        const expires = data.expires_in ? new Date(Date.now() + (data.expires_in - 60) * 1000).toISOString() : null;
        await admin.from("yandex_tokens").upsert({
          user_id: row.user_id,
          access_token: data.access_token,
          refresh_token: data.refresh_token || row.refresh_token,
          expires_at: expires,
          scope: data.scope || row.scope || "",
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
      }
    } catch (e) { /* ниже отдадим ошибку */ }
  }

  const metaRes = await fetch(
    DISK_API + "/resources/download?path=" + encodeURIComponent(path),
    { headers: { Authorization: "OAuth " + access } },
  );
  if (!metaRes.ok) return new Response("download link failed", { status: 502, headers: CORS });
  const meta = await metaRes.json();
  const src = meta.href;
  if (!src) return new Response("no file", { status: 404, headers: CORS });

  const imgRes = await fetch(src);
  if (!imgRes.ok) return new Response("image failed", { status: 502, headers: CORS });
  const headers = new Headers(CORS);
  headers.set("Content-Type", imgRes.headers.get("content-type") || "image/jpeg");
  headers.set("Cache-Control", "public, max-age=3600");
  return new Response(imgRes.body, { status: 200, headers });
});
