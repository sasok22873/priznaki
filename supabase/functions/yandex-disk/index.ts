// Банк на Яндекс.Диске.
// Токены Диска живут только здесь (таблица yandex_tokens, service_role).
// Браузер получает лишь временные ссылки на загрузку/скачивание — без токена.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DISK_API = "https://cloud-api.yandex.net/v1/disk";
const OAUTH_TOKEN = "https://oauth.yandex.ru/token";
const ROOT = "disk:/ПБ24";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type TokenRow = {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string | null;
  scope: string;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "POST required" });

  const supaUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const clientId = Deno.env.get("YANDEX_CLIENT_ID") || "";
  const clientSecret = Deno.env.get("YANDEX_CLIENT_SECRET") || "";
  if (!supaUrl || !anonKey || !serviceKey) return json(500, { error: "Edge Function secrets are not configured" });

  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json(401, { error: "Sign in required" });

  const userClient = createClient(supaUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(jwt);
  if (userError || !userData.user) return json(401, { error: "Invalid session" });
  const userId = userData.user.id;

  const admin = createClient(supaUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, access_status, full_name")
    .eq("id", userId)
    .single();
  if (!profile || profile.access_status !== "active" || !["owner", "member", "viewer"].includes(profile.role)) {
    return json(403, { error: "Нет активного доступа к штабу" });
  }
  const isOwner = profile.role === "owner";
  const canWrite = profile.role === "owner" || profile.role === "member";

  let payload: Record<string, unknown> = {};
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }
  const action = String(payload.action || "");

  // --- токены (одно подключение на команду, владелец Диска) ---
  async function loadToken(): Promise<TokenRow | null> {
    const { data } = await admin.from("yandex_tokens").select("*").order("updated_at", { ascending: false }).limit(1);
    return (data && data[0]) ? (data[0] as TokenRow) : null;
  }

  async function storeToken(t: { access_token: string; refresh_token?: string; expires_in?: number; scope?: string }) {
    const expires = t.expires_in ? new Date(Date.now() + (t.expires_in - 60) * 1000).toISOString() : null;
    const row = {
      user_id: userId,
      access_token: t.access_token,
      refresh_token: t.refresh_token || "",
      expires_at: expires,
      scope: t.scope || "",
      updated_at: new Date().toISOString(),
    };
    await admin.from("yandex_tokens").upsert(row, { onConflict: "user_id" });
  }

  async function refresh(row: TokenRow): Promise<string> {
    if (!row.refresh_token) throw new Error("Токен истёк, подключите Диск заново");
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: row.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
    });
    const res = await fetch(OAUTH_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) throw new Error("Яндекс не подтвердил продление токена");
    const data = await res.json();
    await storeToken({ ...data, refresh_token: data.refresh_token || row.refresh_token });
    return data.access_token;
  }

  async function getAccess(): Promise<string> {
    const row = await loadToken();
    if (!row) throw new Error("Яндекс.Диск не подключён");
    const expired = row.expires_at ? new Date(row.expires_at).getTime() <= Date.now() : false;
    if (expired && row.refresh_token) return await refresh(row);
    return row.access_token;
  }

  async function diskFetch(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
    const token = await getAccess();
    const res = await fetch(DISK_API + path, {
      ...init,
      headers: { ...(init.headers || {}), Authorization: `OAuth ${token}`, Accept: "application/json" },
    });
    if (res.status === 401 && retry) {
      const row = await loadToken();
      if (row) { await refresh(row); return await diskFetch(path, init, false); }
    }
    return res;
  }

  function mapItem(it: Record<string, unknown>) {
    return {
      name: String(it.name || ""),
      path: String(it.path || ""),
      type: String(it.type || ""),
      mime: String(it.mime_type || it.media_type || ""),
      size: Number(it.size || 0),
      created: it.created || null,
      preview: String(it.preview || ""),
      file: String(it.file || ""),
    };
  }

  try {
    switch (action) {
      case "status": {
        const row = await loadToken();
        return json(200, { connected: !!row, connected_by: row ? row.user_id : null, can_write: canWrite, is_owner: isOwner });
      }

      case "auth-url": {
        if (!isOwner) return json(403, { error: "Подключить Диск может только владелец" });
        if (!clientId) return json(500, { error: "Не задан YANDEX_CLIENT_ID" });
        const authUrl = "https://oauth.yandex.ru/authorize?response_type=code&client_id=" + encodeURIComponent(clientId);
        return json(200, { url: authUrl });
      }

      case "connect": {
        if (!isOwner) return json(403, { error: "Подключить Диск может только владелец" });
        const code = String(payload.code || "").trim();
        if (!code) return json(400, { error: "Нет кода авторизации" });
        if (!clientId || !clientSecret) return json(500, { error: "Не заданы YANDEX_CLIENT_ID / YANDEX_CLIENT_SECRET" });
        const body = new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: clientId,
          client_secret: clientSecret,
        });
        const res = await fetch(OAUTH_TOKEN, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString(),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.access_token) {
          return json(400, { error: data.error_description || data.error || "Яндекс не выдал токен" });
        }
        await storeToken(data);
        // создаём корневую папку банка, если её нет
        const put = await diskFetch(`/resources?path=${encodeURIComponent(ROOT)}`, { method: "PUT" });
        return json(200, { ok: true, root_created: put.status === 201, expires_in: data.expires_in || null });
      }

      case "disconnect": {
        if (!isOwner) return json(403, { error: "Отключить Диск может только владелец" });
        await admin.from("yandex_tokens").delete().neq("user_id", "00000000-0000-0000-0000-000000000000");
        return json(200, { ok: true });
      }

      case "folders": {
        const res = await diskFetch(`/resources?path=${encodeURIComponent(ROOT)}&limit=200&sort=name`);
        if (!res.ok) return json(res.status, { error: "Яндекс.Диск вернул ошибку" });
        const data = await res.json();
        const items = (data._embedded?.items || []).filter((x: Record<string, unknown>) => x.type === "dir");
        return json(200, { folders: items.map(mapItem) });
      }

      case "list": {
        const path = String(payload.path || ROOT);
        const res = await diskFetch(`/resources?path=${encodeURIComponent(path)}&limit=200&sort=name&preview_size=M&fields=${encodeURIComponent("_embedded.items.name,_embedded.items.path,_embedded.items.type,_embedded.items.size,_embedded.items.mime_type,_embedded.items.preview,_embedded.items.created,_embedded.items.file")}`);
        if (res.status === 404) return json(200, { items: [], missing: true });
        if (!res.ok) return json(res.status, { error: "Яндекс.Диск вернул ошибку" });
        const data = await res.json();
        const items = (data._embedded?.items || []).map(mapItem);
        return json(200, { items, path });
      }

      case "browse": {
        // Один запрос вместо многих: сразу списки нескольких папок (для альбомов и «Все файлы»)
        const paths = Array.isArray(payload.paths) ? (payload.paths as unknown[]).slice(0, 40) : [];
        const out: Record<string, unknown> = {};
        const valid = paths.map((p) => String(p || "")).filter((p) => /^disk:\/ПБ24(\/|$)/.test(p));
        // Параллельно, но с ограничением — Яндекс не любит шквал запросов
        const LIMIT = 8;
        let cursor = 0;
        async function worker() {
          while (cursor < valid.length) {
            const p = valid[cursor++];
            const res = await diskFetch(`/resources?path=${encodeURIComponent(p)}&limit=200&sort=name&preview_size=M`);
            if (res.status === 404) { out[p] = { files: [], dirs: [], missing: true }; continue; }
            if (!res.ok) { out[p] = { error: true }; continue; }
            const data = await res.json();
            const items = (data._embedded?.items || []).map(mapItem);
            out[p] = {
              files: items.filter((i: { type: string }) => i.type === "file"),
              dirs: items.filter((i: { type: string }) => i.type === "dir"),
            };
          }
        }
        await Promise.all(Array.from({ length: Math.min(LIMIT, valid.length) }, () => worker()));
        return json(200, { lists: out });
      }

      case "upload-link": {
        if (!canWrite) return json(403, { error: "Загружать файлы может владелец или участник" });
        const path = String(payload.path || "");
        if (!/^disk:\/ПБ24\//.test(path)) return json(400, { error: "Недопустимый путь" });
        const res = await diskFetch(`/resources/upload?path=${encodeURIComponent(path)}&overwrite=true`);
        if (!res.ok) return json(res.status, { error: "Не удалось получить ссылку на загрузку" });
        const data = await res.json();
        return json(200, { href: data.href, method: data.method || "PUT" });
      }

      case "download-link": {
        const path = String(payload.path || "");
        const res = await diskFetch(`/resources/download?path=${encodeURIComponent(path)}`);
        if (!res.ok) return json(res.status, { error: "Не удалось получить ссылку на скачивание" });
        const data = await res.json();
        return json(200, { href: data.href });
      }

      case "stat": {
        const path = String(payload.path || "");
        const res = await diskFetch(`/resources?path=${encodeURIComponent(path)}&preview_size=M`);
        if (!res.ok) return json(res.status, { error: "Файл не найден" });
        const data = await res.json();
        return json(200, { item: mapItem(data) });
      }

      case "mkdir": {
        if (!canWrite) return json(403, { error: "Создавать папки может владелец или участник" });
        const relRaw = String(payload.path || payload.name || "").trim();
        const segments = relRaw
          .split(/[\\/]+/)
          .map((s) => s.trim().replace(/[<>:"|?*]+/g, " ").slice(0, 60))
          .filter(Boolean);
        if (!segments.length) return json(400, { error: "Введите название папки" });
        const path = "disk:/ПБ24/" + segments.join("/");
        const res = await diskFetch(`/resources?path=${encodeURIComponent(path)}`, { method: "PUT" });
        if (res.status === 201) return json(200, { ok: true, path });
        if (res.status === 409) return json(409, { error: "Папка уже есть" });
        return json(res.status, { error: "Не удалось создать папку" });
      }

      case "move": {
        if (!canWrite) return json(403, { error: "Переименовывать может владелец или участник" });
        const from = String(payload.from || "");
        const to = String(payload.to || "");
        if (!/^disk:\/ПБ24\//.test(from) || !/^disk:\/ПБ24\//.test(to)) return json(400, { error: "Недопустимый путь" });
        const { data: row } = await admin.from("bank_files").select("uploaded_by").eq("yandex_path", from).maybeSingle();
        const allowed = isOwner || (row && row.uploaded_by === userId);
        if (!allowed) return json(403, { error: "Переименовать может автор или владелец" });
        const res = await diskFetch(
          `/resources/move?from=${encodeURIComponent(from)}&path=${encodeURIComponent(to)}&overwrite=false`,
          { method: "POST" },
        );
        if (!res.ok) return json(res.status, { error: "Яндекс не смог переименовать файл" });
        await admin.from("bank_files").update({ yandex_path: to, name: to.split("/").pop() }).eq("yandex_path", from);
        return json(200, { ok: true, path: to });
      }

      case "delete": {
        const path = String(payload.path || "");
        const { data: row } = await admin.from("bank_files").select("uploaded_by").eq("yandex_path", path).maybeSingle();
        const mayDelete = isOwner || (row && row.uploaded_by === userId);
        if (!canWrite) return json(403, { error: "Удалять файлы может владелец или участник" });
        if (!mayDelete) return json(403, { error: "Удалить может автор или владелец" });
        const res = await diskFetch(`/resources?path=${encodeURIComponent(path)}&permanently=true`, { method: "DELETE" });
        if (res.status !== 204 && res.status !== 200) {
          return json(res.status, { error: "Яндекс.Диск не удалил файл" });
        }
        await admin.from("bank_files").delete().eq("yandex_path", path);
        return json(200, { ok: true });
      }

      default:
        return json(400, { error: "Неизвестное действие" });
    }
  } catch (e) {
    return json(400, { error: (e as Error).message || String(e) });
  }
});
