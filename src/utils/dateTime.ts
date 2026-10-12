/** Reject impossible dates rather than letting JavaScript roll them into another day. */
export function parseDateTime(dateStr: string, timeStr: string): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim()),
    t = /^(\d{2}):(\d{2})$/.exec(timeStr.trim());
  if (!d || !t) return null;
  const [year, month, day] = d.slice(1).map(Number),
    [hour, minute] = t.slice(1).map(Number);
  const date = new Date(year, month - 1, day, hour, minute);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date.getHours() === hour &&
    date.getMinutes() === minute
    ? date
    : null;
}
