/**
 * How an offer's price reads everywhere. Nearry never takes payment: a listed
 * price is what the customer pays the business at the venue.
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

/** "Free", "₹199", or null when the business listed no price. */
export function offerPriceLabel(priceCents?: number | null): string | null {
  if (priceCents == null) return null;
  return priceCents === 0 ? "Free" : formatRupees(priceCents);
}

/** Short card detail: "₹199 at venue", "Free", or "Pay at venue". */
export function offerPriceShort(priceCents?: number | null): string {
  const label = offerPriceLabel(priceCents);
  if (label === null) return "Pay at venue";
  return priceCents === 0 ? label : `${label} at venue`;
}

/** What the customer pays and when, for the offer page and booking cards. */
export function offerPayment(priceCents?: number | null): {
  amount: string;
  note: string;
} {
  if (priceCents === 0)
    return { amount: "Free", note: "Nothing to pay. Just show up on time." };
  if (priceCents == null)
    return {
      amount: "Pay at the venue",
      note: "Ask the business for the price. Nothing is paid in the app.",
    };
  return {
    amount: formatRupees(priceCents),
    note: "Nothing is paid in the app.",
  };
}
