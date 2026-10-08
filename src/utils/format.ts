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
