export type ReviewToken = {
  user_id: string;
  review_id: string;
  document_path: string;
  exp: number;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const encoder = new TextEncoder();
async function key(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}
export async function signReviewToken(
  data: ReviewToken,
  secret: string,
): Promise<string> {
  const payload = btoa(
    String.fromCharCode(...encoder.encode(JSON.stringify(data))),
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const signature = await crypto.subtle.sign(
    "HMAC",
    await key(secret),
    encoder.encode(payload),
  );
  return `${payload}.${Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, "0")).join("")}`;
}
export async function verifyReviewToken(
  token: string,
  secret: string,
  now = Date.now(),
): Promise<ReviewToken | null> {
  try {
    if (!secret || token.length > 4096) return null;
    const [payload, signature, extra] = token.split(".");
    if (
      extra !== undefined ||
      !/^[a-zA-Z0-9_-]+$/.test(payload) ||
      !/^[a-f0-9]{64}$/.test(signature)
    )
      return null;
    const bytes = new Uint8Array(
      signature.match(/../g)!.map((h) => parseInt(h, 16)),
    );
    if (
      !(await crypto.subtle.verify(
        "HMAC",
        await key(secret),
        bytes,
        encoder.encode(payload),
      ))
    )
      return null;
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const data = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(decoded, (c) => c.charCodeAt(0)),
      ),
    );
    if (
      !uuid.test(data.user_id) ||
      !uuid.test(data.review_id) ||
      typeof data.document_path !== "string" ||
      !data.document_path.startsWith(`${data.user_id}/`) ||
      !Number.isFinite(data.exp) ||
      data.exp <= now
    )
      return null;
    return data;
  } catch {
    return null;
  }
}
export function escapeHtml(value: string): string {
  return String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
