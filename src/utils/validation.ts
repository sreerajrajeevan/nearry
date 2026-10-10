/**
 * Client-side input validation. Mirrors the database CHECK constraints so
 * bad input is caught before it ever leaves the phone. Every rule here has
 * a server-side counterpart in supabase/migrations.
 */

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function isValidOtp(code: string): boolean {
  return /^\d{6}$/.test(code.trim());
}

export function isValidDisplayName(name: string): boolean {
  const t = name.trim();
  return t.length >= 2 && t.length <= 40;
}

export type PostDraft = {
  title: string;
  description: string;
  startsAt: Date | null;
  expiresAt?: Date | null;
  vacancies: number;
  costCents?: number;
};

/** Returns a human-readable error, or null when the draft is valid. */
export function validatePostDraft(d: PostDraft, now: Date = new Date()): string | null {
  if (d.title.trim().length < 4) return 'Give your activity a title (min 4 characters).';
  if (d.title.trim().length > 80) return 'Title is too long (max 80 characters).';
  if (d.description.trim().length < 10) return 'Add a few more details (min 10 characters).';
  if (d.description.trim().length > 1000) return 'Description is too long (max 1000 characters).';
  if (!d.startsAt || Number.isNaN(d.startsAt.getTime())) return 'Pick a date and time.';
  if (d.startsAt.getTime() <= now.getTime() + 15 * 60 * 1000)
    return 'Start time must be at least 15 minutes in the future.';
  if (d.expiresAt) {
    if (Number.isNaN(d.expiresAt.getTime())) return 'Expiry date is invalid.';
    if (d.expiresAt.getTime() <= now.getTime()) return 'Expiry must be in the future.';
    if (d.expiresAt.getTime() >= d.startsAt.getTime())
      return 'Expiry must be before the start time.';
  }
  if (!Number.isInteger(d.vacancies) || d.vacancies < 1 || d.vacancies > 100)
    return 'Vacancies must be between 1 and 100.';
  if (d.costCents !== undefined && (!Number.isInteger(d.costCents) || d.costCents < 0))
    return 'Cost must be a non-negative whole amount.';
  return null;
}

export function isValidBusinessName(name: string): boolean {
  const t = name.trim();
  return t.length >= 2 && t.length <= 80;
}

export type OfferDraft = {
  title: string;
  description: string;
  discountPct?: number;
  priceCents?: number;
  startsAt: string;
  endsAt: string;
  slotCapacity: number;
};

/**
 * Mirrors the offers CHECK constraints + guard rules:
 * future start, end after start, sane discount/price/capacity.
 */
export function validateOfferInput(input: OfferDraft): string | null {
  if (input.title.trim().length < 4) return 'Give the offer a title (min 4 characters).';
  if (input.description.trim().length < 10) return 'Add a few more details (min 10 characters).';
  const starts = new Date(input.startsAt).getTime();
  const ends = new Date(input.endsAt).getTime();
  if (Number.isNaN(starts) || Number.isNaN(ends)) return 'Start/end times are invalid.';
  if (starts <= Date.now()) return 'Start time must be in the future.';
  if (ends <= starts) return 'End time must be after the start time.';
  if (input.discountPct !== undefined && (input.discountPct < 0 || input.discountPct > 90))
    return 'Discount must be between 0 and 90%.';
  if (input.priceCents !== undefined && input.priceCents < 0) return 'Price cannot be negative.';
  if (!Number.isInteger(input.slotCapacity) || input.slotCapacity < 1 || input.slotCapacity > 500)
    return 'Seats per slot must be between 1 and 500.';
  return null;
}
