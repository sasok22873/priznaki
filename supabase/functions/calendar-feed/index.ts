// Подписка на календарь (ICS).
//
// Одна Edge Function, два режима (verify_jwt = false на шлюзе!):
//   A. POST с Authorization: Bearer <supabase access token> — управление ссылкой:
//        { "action": "status" }  — есть ли уже ссылка (нужно интерфейсу);
//        { "action": "link" }    — создать ссылку (если нет) и вернуть URL;
//        { "action": "rotate" }  — заменить токен новым (старая ссылка умирает);
//        { "action": "revoke" }  — удалить токен.
//   B. GET ?token=... — отдать .ics для Яндекс.Календаря / Google Calendar / Apple.
//      Календарные клиенты не присылают JWT, поэтому проверка идёт по токену.
//
// JWT не проверяется шлюзом (verify_jwt=false), поэтому POST-режим проверяет
// пользователя сам через auth.getUser(jwt) и profiles (access_status = active,
// роль owner/member/viewer).
//
// service_role не покидает Edge Function. В браузере — только URL ссылки.

import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCalendar } from "./ics.ts";
import type { CalendarEvent, CalendarTask } from "./ics.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const FEED_PATH = "/functions/v1/calendar-feed";
const ALLOWED_ROLES = ["owner", "member", "viewer"];

type AdminClient = ReturnType<typeof createClient>;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function text(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** 32 hex-символа: 128 бит случайности, без дефисов — удобно в URL. */
function newToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

function feedUrl(supaUrl: string, token: string): string {
  return supaUrl.replace(/\/+$/, "") + FEED_PATH + "?token=" + encodeURIComponent(token);
}

// ---------------------------------------------------------------- GET: .ics

async function serveFeed(admin: AdminClient, url: URL, supaUrl: string): Promise<Response> {
  const token = (url.searchParams.get("token") || "").trim();
  if (!token) return text(400, "Нет токена подписки");

  const { data: tokenRow, error: tokenError } = await admin
    .from("calendar_tokens")
    .select("user_id, token")
    .eq("token", token)
    .maybeSingle();
  if (tokenError) {
    console.error("[calendar-feed] token lookup failed:", tokenError.message);
    return text(500, "Не удалось проверить ссылку");
  }
  if (!tokenRow) return text(404, "Ссылка не найдена или отключена");

  const userId = String(tokenRow.user_id);

  const [eventsResult, tasksResult] = await Promise.all([
    admin
      .from("events")
      .select("id, title, date, time, place, type, starts_at")
      .order("date", { ascending: true })
      .limit(2000),
    admin
      .from("tasks")
      .select("id, title, due_date, due_time, status, area")
      .eq("owner_id", userId)
      .neq("status", "done")
      .neq("status", "cancelled")
      .order("due_date", { ascending: true })
      .limit(2000),
  ]);

  if (eventsResult.error) {
    console.error("[calendar-feed] events query failed:", eventsResult.error.message);
    return text(500, "Не удалось прочитать события");
  }
  if (tasksResult.error) {
    console.error("[calendar-feed] tasks query failed:", tasksResult.error.message);
    return text(500, "Не удалось прочитать задачи");
  }

  // Приложение пишет date/time; если пришло только starts_at — достаём дату и время (Красноярск, UTC+7).
  const KRSK_OFFSET_MS = 7 * 3600 * 1000;
  const events = ((eventsResult.data || []) as (CalendarEvent & { starts_at?: string | null })[]).map((ev) => {
    const out: CalendarEvent & { starts_at?: string | null } = { ...ev };
    if (!out.date && ev.starts_at) {
      const d = new Date(new Date(ev.starts_at).getTime() + KRSK_OFFSET_MS);
      out.date = d.toISOString().slice(0, 10);
      if (!out.time) out.time = d.toISOString().slice(11, 16);
    }
    return out;
  });

  const ics = buildCalendar(
    events as CalendarEvent[],
    (tasksResult.data || []) as CalendarTask[],
  );

  return new Response(ics, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="priznaki.ics"',
      "Cache-Control": "public, max-age=300",
    },
  });
}

// ------------------------------------------------------------ POST: управление

async function manageLink(
  req: Request,
  admin: AdminClient,
  supaUrl: string,
  anonKey: string,
): Promise<Response> {
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return json(401, { error: "Требуется вход в штаб" });

  const userClient = createClient(supaUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(jwt);
  if (userError || !userData.user) return json(401, { error: "Сессия недействительна" });
  const userId = userData.user.id;

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, role, access_status")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) {
    console.error("[calendar-feed] profile lookup failed:", profileError.message);
    return json(500, { error: "Не удалось проверить доступ" });
  }
  if (!profile || profile.access_status !== "active" || !ALLOWED_ROLES.includes(String(profile.role))) {
    return json(403, { error: "Нет активного доступа к штабу" });
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return json(400, { error: "Некорректный JSON" });
  }
  const action = String(payload.action || "");

  async function loadToken(): Promise<string> {
    const { data } = await admin.from("calendar_tokens").select("token").eq("user_id", userId).maybeSingle();
    return data ? String(data.token) : "";
  }

  async function saveToken(token: string): Promise<boolean> {
    const { error } = await admin
      .from("calendar_tokens")
      .upsert({ user_id: userId, token, created_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) console.error("[calendar-feed] token save failed:", error.message);
    return !error;
  }

  try {
    switch (action) {
      case "status": {
        const token = await loadToken();
        return json(200, {
          linked: !!token,
          token,
          url: token ? feedUrl(supaUrl, token) : "",
        });
      }

      case "link": {
        const existing = await loadToken();
        if (existing) return json(200, { linked: true, token: existing, url: feedUrl(supaUrl, existing) });
        const token = newToken();
        if (!(await saveToken(token))) return json(500, { error: "Не удалось сохранить ссылку" });
        return json(200, { linked: true, token, url: feedUrl(supaUrl, token) });
      }

      case "rotate": {
        const token = newToken();
        if (!(await saveToken(token))) return json(500, { error: "Не удалось обновить ссылку" });
        return json(200, { linked: true, token, url: feedUrl(supaUrl, token) });
      }

      case "revoke": {
        const { error } = await admin.from("calendar_tokens").delete().eq("user_id", userId);
        if (error) {
          console.error("[calendar-feed] token delete failed:", error.message);
          return json(500, { error: "Не удалось отключить ссылку" });
        }
        return json(200, { linked: false, token: "", url: "" });
      }

      default:
        return json(400, { error: "Неизвестное действие" });
    }
  } catch (error) {
    console.error("[calendar-feed] action failed:", error);
    return json(500, { error: "Внутренняя ошибка сервера" });
  }
}

// ------------------------------------------------------------------ dispatch

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supaUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supaUrl || !anonKey || !serviceKey) return text(500, "Edge Function secrets are not configured");

  const admin = createClient(supaUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    if (req.method === "GET") return await serveFeed(admin, new URL(req.url), supaUrl);
    if (req.method === "POST") return await manageLink(req, admin, supaUrl, anonKey);
    return text(405, "Method not allowed");
  } catch (error) {
    console.error("[calendar-feed] unhandled error:", error);
    return text(500, "Внутренняя ошибка сервера");
  }
});
