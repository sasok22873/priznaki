// Статистика соцсетей: сервер забирает цифры по API и кладёт в promo_snapshots.
// Ключи живут только в секретах Supabase, в браузер не попадают.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const YT_KEY = Deno.env.get("YOUTUBE_API_KEY") || "";
const VK_TOKEN = Deno.env.get("VK_COMMUNITY_TOKEN") || "";
const TG_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Krasnoyarsk", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
async function getJSON(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": "PB24-Stats/1.0" } });
  const text = await res.text();
  let data: unknown = null;
  try { data = JSON.parse(text); } catch (_e) { data = { raw: text.slice(0, 300) }; }
  return { ok: res.ok, status: res.status, data };
}

type Fetched = { platform: string; followers?: number; views?: number; plays?: number; likes?: number; detail?: string; error?: string };

async function fetchYouTube(handle: string): Promise<Fetched> {
  if (!YT_KEY) return { platform: "youtube", error: "YOUTUBE_API_KEY не задан" };
  const clean = handle.replace(/^@/, "");
  const r = await getJSON(
    `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&forHandle=${encodeURIComponent(clean)}&key=${YT_KEY}`,
  );
  const item = (r.data as any)?.items?.[0];
  if (!item) return { platform: "youtube", error: (r.data as any)?.error?.message || "канал не найден" };
  const st = item.statistics || {};
  return {
    platform: "youtube",
    followers: Number(st.subscriberCount || 0),
    views: Number(st.viewCount || 0),
    plays: 0,
    likes: 0,
    detail: `${item.snippet?.title || ""} · видео: ${st.videoCount || 0}`,
  };
}

async function fetchVK(screenName: string): Promise<Fetched> {
  if (!VK_TOKEN) return { platform: "vk", error: "VK_COMMUNITY_TOKEN не задан" };
  const group = await getJSON(
    `https://api.vk.com/method/groups.getById?group_id=${encodeURIComponent(screenName)}&fields=members_count,name&access_token=${VK_TOKEN}&v=5.199`,
  );
  const err = (group.data as any)?.error;
  if (err) return { platform: "vk", error: err.error_msg || "ошибка VK" };
  const resp = (group.data as any)?.response;
  const g = Array.isArray(resp) ? resp[0] : (resp?.groups?.[0] || resp);
  if (!g) return { platform: "vk", error: "сообщество не найдено" };
  let views = 0;
  try {
    const wall = await getJSON(
      `https://api.vk.com/method/wall.get?owner_id=-${g.id}&count=20&access_token=${VK_TOKEN}&v=5.199`,
    );
    const items = (wall.data as any)?.response?.items || [];
    views = items.reduce((sum: number, it: any) => sum + Number(it?.views?.count || 0), 0);
  } catch (_e) { /* просмотры не критичны */ }
  return { platform: "vk", followers: Number(g.members_count || 0), views, plays: 0, likes: 0, detail: g.name || "" };
}

async function fetchTelegram(chat: string): Promise<Fetched> {
  if (!TG_TOKEN) return { platform: "telegram", error: "TELEGRAM_BOT_TOKEN не задан" };
  const id = chat.startsWith("@") ? chat : "@" + chat;
  const info = await getJSON(`https://api.telegram.org/bot${TG_TOKEN}/getChat?chat_id=${encodeURIComponent(id)}`);
  if (!(info.data as any)?.ok) {
    return { platform: "telegram", error: (info.data as any)?.description || "бот не видит канал (добавьте его админом)" };
  }
  const count = await getJSON(`https://api.telegram.org/bot${TG_TOKEN}/getChatMemberCount?chat_id=${encodeURIComponent(id)}`);
  const n = (count.data as any)?.result;
  if (typeof n !== "number") return { platform: "telegram", error: (count.data as any)?.description || "не удалось получить подписчиков" };
  return { platform: "telegram", followers: n, views: 0, plays: 0, likes: 0, detail: (info.data as any)?.result?.title || "" };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "POST required" });

  const supaUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supaUrl || !anonKey || !serviceKey) return json(500, { error: "Edge Function secrets are not configured" });

  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json(401, { error: "Sign in required" });
  const userClient = createClient(supaUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(jwt);
  if (userError || !userData.user) return json(401, { error: "Invalid session" });

  const admin = createClient(supaUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile } = await admin.from("profiles").select("role, access_status, full_name").eq("id", userData.user.id).single();
  if (!profile || profile.access_status !== "active" || !["owner", "member", "viewer"].includes(profile.role)) {
    return json(403, { error: "Нет активного доступа к штабу" });
  }

  let payload: Record<string, unknown> = {};
  try { payload = await req.json(); } catch { /* пустое тело — ок */ }
  const action = String(payload.action || "status");

  const { data: channels } = await admin.from("promo_channels").select("*").order("sort");
  const list = channels || [];

  if (action === "status") {
    return json(200, {
      configured: { youtube: !!YT_KEY, vk: !!VK_TOKEN, telegram: !!TG_TOKEN },
      channels: list.map((c: any) => ({ id: c.id, name: c.name, platform: c.platform, url: c.url })),
    });
  }

  // Забираем цифры по API и сохраняем снимок за сегодня
  if (action === "sync") {
    const results: Fetched[] = [];
    for (const c of list) {
      try {
        if (c.platform === "youtube") results.push(await fetchYouTube(c.handle || c.name));
        else if (c.platform === "vk") results.push(await fetchVK(c.handle || c.name));
        else if (c.platform === "telegram") results.push(await fetchTelegram(c.handle || c.name));
      } catch (e) {
        results.push({ platform: c.platform, error: (e as Error).message });
      }
    }
    const day = todayISO();
    const saved: any[] = [];
    const errors: any[] = [];
    for (const c of list) {
      const res = results.find((r) => r.platform === c.platform);
      if (!res) continue;
      if (res.error) { errors.push({ platform: c.platform, error: res.error }); continue; }
      const row = {
        channel_id: c.id,
        taken_on: day,
        followers: Math.round(res.followers || 0),
        views: Math.round(res.views || 0),
        plays: Math.round(res.plays || 0),
        likes: Math.round(res.likes || 0),
        comments: 0,
        notes: ("auto: " + (res.detail || "")).slice(0, 200),
        created_by: null,
      };
      const { error } = await admin.from("promo_snapshots").upsert(row, { onConflict: "channel_id,taken_on" });
      if (error) errors.push({ platform: c.platform, error: error.message });
      else saved.push({ platform: c.platform, ...row });
    }
    return json(200, { ok: true, day, saved, errors });
  }

  // История для графика
  if (action === "history") {
    const days = Math.max(7, Math.min(365, Number(payload.days || 90)));
    const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const { data } = await admin
      .from("promo_snapshots")
      .select("channel_id, taken_on, followers, views, plays, likes, notes")
      .gte("taken_on", from)
      .order("taken_on", { ascending: true });
    return json(200, { rows: data || [] });
  }

  return json(400, { error: "Неизвестное действие" });
});
