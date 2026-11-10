const formatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' });

export function shortDate(iso: string | null): string {
  if (!iso) return 'без срока';
  return formatter.format(new Date(`${iso}T12:00:00`));
}

export function todayIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Krasnoyarsk' }).format(new Date());
}
