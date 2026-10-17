import type { Booking, Offer } from "../services/mappers";

/** Local calendar days, including short/long days at daylight-saving changes. */
export function businessDay(
  bookings: Booking[],
  offers: Offer[],
  now = new Date(),
) {
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const end = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  ).getTime();
  const today = bookings
    .filter(
      (b) =>
        b.status !== "cancelled" &&
        new Date(b.slot).getTime() >= start &&
        new Date(b.slot).getTime() < end,
    )
    .sort((a, b) => new Date(a.slot).getTime() - new Date(b.slot).getTime());
  const liveOffers = offers.filter(
    (o) => o.status === "live" && new Date(o.endsAt).getTime() > now.getTime(),
  );
  const drafts = offers.filter((o) => o.status === "draft");
  return { today, liveOffers, drafts };
}
