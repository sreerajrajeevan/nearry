export type ClockTime = { hour: number; minute: number; period: "AM" | "PM" };

export function clockParts(date: Date): ClockTime {
  const hour = date.getHours();
  return {
    hour: hour % 12 || 12,
    minute: date.getMinutes(),
    period: hour < 12 ? "AM" : "PM",
  };
}

/** Apply the chosen local time without mutating the selected plan date. */
export function withClockTime(date: Date, time: ClockTime): Date {
  const next = new Date(date);
  next.setHours(
    (time.hour % 12) + (time.period === "PM" ? 12 : 0),
    time.minute,
    0,
    0,
  );
  return next;
}
