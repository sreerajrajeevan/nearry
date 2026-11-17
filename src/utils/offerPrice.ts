/**
 * How an offer's price reads everywhere. An offer price is always per person,
 * and Nearry never takes payment: it is paid to the business at the venue.
 */

/** 19900 -> "₹199", 4950 -> "₹49.50", 1250000 -> "₹12,500". */
export function formatRupees(cents: number): string {
  const whole = Math.floor(cents / 100);
  const paise = cents % 100;
  const digits = String(whole);
  // Indian grouping: last three digits, then pairs (1,23,456).
  const head = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  const grouped = head ? `${head},${digits.slice(-3)}` : digits;
  return `₹${grouped}${paise ? `.${String(paise).padStart(2, "0")}` : ""}`;
}

/** "Free", "₹199 / person", or null when the business listed no price. */
export function offerPriceLabel(priceCents?: number | null): string | null {
  if (priceCents == null) return null;
  return priceCents === 0 ? "Free" : `${formatRupees(priceCents)} / person`;
}

/** Short card detail: "₹199 / person", "Free", or "Pay at venue". */
export function offerPriceShort(priceCents?: number | null): string {
  return offerPriceLabel(priceCents) ?? "Pay at venue";
}

/** Total for a booking: 19900 × 2 -> "₹398". Null when free or unpriced. */
export function bookingTotal(
  priceCents: number | null | undefined,
  people: number,
): string | null {
  if (!priceCents) return null;
  return formatRupees(priceCents * people);
}

/** What the customer pays and when, for the offer page. */
export function offerPayment(
  priceCents?: number | null,
  people = 1,
): { amount: string; note: string } {
  if (priceCents === 0)
    return { amount: "Free", note: "Nothing to pay. Just show up on time." };
  if (priceCents == null)
    return {
      amount: "Pay at the venue",
      note: "Ask the business for the price. Nothing is paid in the app.",
    };
  return {
    amount: `${formatRupees(priceCents)} / person`,
    note:
      people > 1
        ? `${bookingTotal(priceCents, people)} for ${people} people, to be paid at the venue. Nothing is paid in the app.`
        : "To be paid at the venue. Nothing is paid in the app.",
  };
}
