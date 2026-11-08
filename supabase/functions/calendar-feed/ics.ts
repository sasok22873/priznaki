// Чистая сборка ICS-файла для подписки на календарь.
// Модуль без зависимостей: его использует Edge Function calendar-feed
// и локальная проверка _diag/calendar/ics-test.mjs (Node 24 читает .ts напрямую).
//
// Правила RFC 5545, которые здесь важны:
//   - строки разделяются CRLF ("\r\n"), файл заканчивается CRLF;
//   - каждая строка не длиннее 75 байт UTF-8, продолжение — с ведущего пробела;
//   - в текстовых значениях экранируются \ ; , и переводы строк;
//   - дата-время с часовым поясом: DTSTART;TZID=Asia/Krasnoyarsk:YYYYMMDDTHHMMSS.
//
// ВАЖНО: при правках не добавляй сюда enum/namespace и прочий TS-синтаксис,
// который не стирается: файл импортируется Node без сборки.

export const APP_TIMEZONE = "Asia/Krasnoyarsk";

export type CalendarEvent = {
  id?: string | null;
  title?: string | null;
  date?: string | null;
  time?: string | null;
  place?: string | null;
  type?: string | null;
};

export type CalendarTask = {
  id?: string | null;
  title?: string | null;
  due_date?: string | null;
  due_time?: string | null;
  status?: string | null;
  area?: string | null;
};

type DateParts = { y: number; m: number; d: number };
type TimeParts = { h: number; min: number };

const CRLF = "\r\n";
const MAX_LINE_BYTES = 75;
const TEXT_ENCODER = new TextEncoder();

const STATUS_LABELS: Record<string, string> = {
  new: "Новая",
  planned: "Запланирована",
  in_progress: "В работе",
  review: "На проверке",
  done: "Завершена",
  cancelled: "Отменена",
};

function byteLength(text: string): number {
  return TEXT_ENCODER.encode(text).length;
}

/** Длина строки в байтах UTF-8 (для проверки фолдинга). */
export function utf8Length(text: string): number {
  return byteLength(text);
}

/** Экранирование текстового значения по RFC 5545. */
export function escapeText(value: unknown): string {
  return String(value == null ? "" : value)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** Складывание строки по 75 байт с продолжением на пробеле. */
export function foldLine(line: string): string {
  if (byteLength(line) <= MAX_LINE_BYTES) return line;
  const chunks: string[] = [];
  let chunk = "";
  let chunkBytes = 0;
  let limit = MAX_LINE_BYTES;
  for (const char of line) {
    const code = char.codePointAt(0) || 0;
    const width = code < 128 ? 1 : byteLength(char);
    if (chunkBytes + width > limit) {
      chunks.push(chunk);
      chunk = "";
      chunkBytes = 0;
      // продолжение начинается с пробела, поэтому в нём максимум 74 байта
      limit = MAX_LINE_BYTES - 1;
    }
    chunk += char;
    chunkBytes += width;
  }
  if (chunk) chunks.push(chunk);
  return chunks.map((part, index) => (index === 0 ? part : " " + part)).join(CRLF);
}

function pad2(value: number): string {
  return value < 10 ? "0" + value : String(value);
}

function parseDate(value: unknown): DateParts | null {
  const text = String(value == null ? "" : value).trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  // отсекаем 31 февраля и подобное
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return null;
  return { y, m, d };
}

function parseTime(value: unknown): TimeParts | null {
  const text = String(value == null ? "" : value).trim();
  if (!text) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(text);
  if (!match) return null;
  const h = Number(match[1]);
  const min = Number(match[2]);
  if (h > 23 || min > 59) return null;
  return { h, min };
}

function formatDate(parts: DateParts): string {
  return String(parts.y) + pad2(parts.m) + pad2(parts.d);
}

function formatLocalDateTime(parts: DateParts, time: TimeParts): string {
  return formatDate(parts) + "T" + pad2(time.h) + pad2(time.min) + "00";
}

function formatUtcStamp(now: Date): string {
  return (
    String(now.getUTCFullYear()) +
    pad2(now.getUTCMonth() + 1) +
    pad2(now.getUTCDate()) +
    "T" +
    pad2(now.getUTCHours()) +
    pad2(now.getUTCMinutes()) +
    pad2(now.getUTCSeconds()) +
    "Z"
  );
}

/** +1 час к дате и времени события (стеночные часы, без пересчёта пояса). */
function plusOneHour(parts: DateParts, time: TimeParts): { date: DateParts; time: TimeParts } {
  const base = new Date(Date.UTC(parts.y, parts.m - 1, parts.d, time.h, time.min, 0));
  const moved = new Date(base.getTime() + 60 * 60 * 1000);
  return {
    date: { y: moved.getUTCFullYear(), m: moved.getUTCMonth() + 1, d: moved.getUTCDate() },
    time: { h: moved.getUTCHours(), min: moved.getUTCMinutes() },
  };
}

function eventLines(event: CalendarEvent, index: number, stamp: string): string[] {
  const date = parseDate(event.date);
  if (!date) return [];
  const time = parseTime(event.time);
  const place = String(event.place == null ? "" : event.place).trim();
  const type = String(event.type == null ? "" : event.type).trim();
  const uid = "event-" + String(event.id == null || event.id === "" ? index : event.id) + "@priznaki";
  const lines = ["BEGIN:VEVENT", "UID:" + uid, "DTSTAMP:" + stamp];
  if (time) {
    lines.push("DTSTART;TZID=" + APP_TIMEZONE + ":" + formatLocalDateTime(date, time));
    const end = plusOneHour(date, time);
    lines.push("DTEND;TZID=" + APP_TIMEZONE + ":" + formatLocalDateTime(end.date, end.time));
  } else {
    lines.push("DTSTART;VALUE=DATE:" + formatDate(date));
  }
  lines.push("SUMMARY:" + escapeText(event.title || "Событие"));
  if (place) lines.push("LOCATION:" + escapeText(place));
  if (type) lines.push("DESCRIPTION:" + escapeText(type));
  lines.push("END:VEVENT");
  return lines;
}

function taskLines(task: CalendarTask, index: number, stamp: string): string[] {
  const date = parseDate(task.due_date);
  if (!date) return [];
  const time = parseTime(task.due_time);
  const rawStatus = String(task.status == null ? "" : task.status).trim();
  const status = STATUS_LABELS[rawStatus] || rawStatus;
  const area = String(task.area == null ? "" : task.area).trim();
  const description = [
    area ? "Направление: " + area : "",
    status ? "Статус: " + status : "",
  ]
    .filter(Boolean)
    .join("\n");
  const uid = "task-" + String(task.id == null || task.id === "" ? index : task.id) + "@priznaki";
  const lines = ["BEGIN:VEVENT", "UID:" + uid, "DTSTAMP:" + stamp];
  if (time) {
    lines.push("DTSTART;TZID=" + APP_TIMEZONE + ":" + formatLocalDateTime(date, time));
  } else {
    lines.push("DTSTART;VALUE=DATE:" + formatDate(date));
  }
  lines.push("SUMMARY:" + escapeText("Задача: " + (task.title || "Без названия")));
  if (description) lines.push("DESCRIPTION:" + escapeText(description));
  lines.push("CATEGORIES:Задачи");
  lines.push("END:VEVENT");
  return lines;
}

/**
 * Собирает .ics: все события группы + задачи одного пользователя.
 * Возвращает готовую строку с CRLF-разделителями и финальным CRLF.
 */
export function buildCalendar(
  events: CalendarEvent[] | null | undefined,
  tasks: CalendarTask[] | null | undefined,
  now: Date = new Date(),
): string {
  const stamp = formatUtcStamp(now);
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PRIZNAKI 24//RU",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:ПРИЗНАКИ БЕШЕНСТВА 24",
    "X-WR-TIMEZONE:" + APP_TIMEZONE,
  ];
  (events || []).forEach((event, index) => {
    lines.push(...eventLines(event, index, stamp));
  });
  (tasks || []).forEach((task, index) => {
    lines.push(...taskLines(task, index, stamp));
  });
  lines.push("END:VCALENDAR");
  // Фолдинг применяется к каждой строке уже после сборки: значения могут
  // содержать кириллицу, поэтому режем именно по байтам, а не по символам.
  return lines.map((line) => foldLine(line)).join(CRLF) + CRLF;
}
