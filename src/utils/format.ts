/** Tiny formatting helpers. */

export function timeLeft(endsAtIso: string, now = new Date()): string {
  const ms = new Date(endsAtIso).getTime() - now.getTime();
  if (ms <= 0) return 'ENDED';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}H ${m}M LEFT`;
  return `${m}M LEFT`;
}

export function vacanciesLeft(vacancies: number, joined: number): string {
  const left = Math.max(0, vacancies - joined);
  return left === 0 ? 'FULL' : `${left} SPOT${left === 1 ? '' : 'S'} LEFT`;
}

function twelveHour(d: Date): string {
  const h = d.getHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const mm = d.getMinutes();
  const ap = h < 12 ? 'am' : 'pm';
  return mm === 0 ? `${h12} ${ap}` : `${h12}:${String(mm).padStart(2, '0')} ${ap}`;
}

/** "2:30 pm" for an ISO timestamp. */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : twelveHour(d);
}

/** "Tonight, 8 pm" · "Today, 5:30 pm" · "Tomorrow, 8 pm" · "Mon, 8 pm". */
export function formatWhen(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const day = (x: Date) => x.getFullYear() * 1000 + Math.floor(
    (x.getTime() - new Date(x.getFullYear(), 0, 0).getTime()) / 86_400_000,
  );
  const diff = day(d) - day(now);
  const t = twelveHour(d);
  if (diff === 0) return `${d.getHours() >= 17 ? 'Tonight' : 'Today'}, ${t}`;
  if (diff === 1) return `Tomorrow, ${t}`;
  return `${d.toLocaleDateString('en-US', { weekday: 'short' })}, ${t}`;
}
