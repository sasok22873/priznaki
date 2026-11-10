const fmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' });

export function short(iso: string | null): string {
  return iso ? fmt.format(new Date(`${iso}T12:00:00`)) : 'без срока';
}
