export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** Native keyboards and pasted emails may use non-ASCII decimal digits. */
export function normalizeEmailCode(value: string): string {
  return Array.from(value)
    .map((char) => {
      const n = char.charCodeAt(0);
      for (const start of [0x0660, 0x06f0, 0x0966, 0xff10]) {
        if (n >= start && n <= start + 9) return String(n - start);
      }
      return char;
    })
    .join("")
    .replace(/[^0-9]/g, "")
    .slice(0, 10);
}

/** Resend limits belong to the recipient, not whichever form is currently open. */
export class EmailCodeCooldowns {
  private until = new Map<string, number>();
  constructor(private now = Date.now) {}
  record(email: string) {
    this.until.set(normalizeEmail(email), this.now() + 60_000);
  }
  expiresAt(email: string) {
    return this.until.get(normalizeEmail(email)) ?? 0;
  }
}

/** Only basic sign-in is needed: do not force consent/offline Google access. */
export const GOOGLE_SIGN_IN_PARAMS = { prompt: "select_account" } as const;
