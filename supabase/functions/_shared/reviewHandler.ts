import { escapeHtml as esc } from "./reviewToken.ts";

function page(title: string, body: string, status = 200) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>body{font-family:system-ui;background:#faf9f5;color:#252a26;max-width:640px;margin:40px auto;padding:24px}button{background:#c14d2f;color:white;border:0;padding:12px;margin:8px 0;cursor:pointer}img{max-width:100%}textarea{display:block;width:100%;box-sizing:border-box}form{margin-top:24px}</style></head><body><h1>${esc(title)}</h1>${body}</body></html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy":
          "default-src 'none'; img-src https:; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
/** Old email URLs are a handoff only. Link possession grants no private access. */
export function adminDashboardUrl(raw?: string): string | null {
  try {
    const url = new URL(raw ?? "");
    if (url.protocol !== "https:" || url.username || url.password) return null;
    url.hash = "";
    url.search = "";
    return url.toString();
  } catch {
    return null;
  }
}
export function createReviewHandler(
  _db: unknown,
  _secret: string,
  consoleUrl?: string,
) {
  return async (req: Request) => {
    if (!["GET", "POST"].includes(req.method))
      return new Response("method not allowed", { status: 405 });
    const url = adminDashboardUrl(consoleUrl);
    return page(
      "Review in Nearry Admin",
      "<p>Sign in to the admin dashboard with your authenticator to review this submission. Email links no longer open private documents or approve accounts.</p>" +
        (url
          ? '<p><a href="' +
            esc(url) +
            '" rel="noopener noreferrer">Open Nearry Admin</a></p>'
          : "<p>Open your saved Nearry Admin dashboard address.</p>"),
    );
  };
}
