export function nextWeekendISO(from = new Date()): string {
  const d = new Date(from);
  const day = d.getDay();
  if (day !== 0 && day !== 6) d.setDate(d.getDate() + (6 - day));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function todayISO(from = new Date()): string {
  const y = from.getFullYear();
  const m = String(from.getMonth() + 1).padStart(2, '0');
  const dd = String(from.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
