import { join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import {
  legalConfigured,
  legalContact,
  legalSections,
  legalTitle,
  legalUpdated,
} from "../src/utils/legal";
if (!legalConfigured)
  throw new Error(
    "Set EXPO_PUBLIC_LEGAL_OWNER and EXPO_PUBLIC_SUPPORT_EMAIL before exporting public policies.",
  );
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const shell = (title: string, body: string, updated = "19 October 2026") =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} · Nearry</title><style>body{max-width:760px;margin:40px auto;padding:0 24px;background:#FAF9F5;color:#252A26;font:17px/1.65 system-ui}h1{font-size:36px;line-height:1.2}h2{font-size:22px;margin-top:32px}a{color:#A64025}nav{display:flex;gap:16px;flex-wrap:wrap}p{white-space:pre-line}</style></head><body><nav><a href="privacy.html">Privacy</a><a href="terms.html">Terms</a><a href="delete-account.html">Delete account</a><a href="child-safety.html">Child safety</a></nav><h1>${escape(title)}</h1><p>Nearry · Last updated ${escape(updated)}</p>${body}<footer><p>${escape(legalContact.owner)} · <a href="mailto:${escape(legalContact.email)}">${escape(legalContact.email)}</a></p></footer></body></html>`;
const PLAY = "https://play.google.com/store/apps/details?id=com.nearry.app";
const openPlanPage = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Join a plan · Nearry</title><style>body{max-width:480px;margin:0 auto;padding:56px 24px;background:#F8FAFC;color:#111827;font:17px/1.6 system-ui;text-align:center}h1{font-size:30px;line-height:1.2;margin:18px 0 8px}.logo{width:64px;height:64px;border-radius:20px;background:#F59E0B;display:inline-flex;align-items:center;justify-content:center;font-size:30px;font-weight:800;color:#030712}a.btn{display:block;margin:14px 0;padding:15px;border-radius:28px;font-weight:700;text-decoration:none}.open{background:#030712;color:#fff}.store{border:1.5px solid #111827;color:#111827}p{color:#4B5563}</style></head><body><div class="logo">n</div><h1>You’re invited to a plan</h1><p id="msg">Open it in Nearry to see the details and ask to join.</p><a id="open" class="btn open" href="${PLAY}">Open in Nearry</a><a class="btn store" href="${PLAY}">Get Nearry on Google Play</a><script>(function(){var id=new URLSearchParams(location.search).get("plan")||"";var open=document.getElementById("open");if(!/^[A-Za-z0-9_-]{1,64}$/.test(id)){open.style.display="none";document.getElementById("msg").textContent="Get Nearry to find plans near you.";return}var play="${PLAY}";var target=/android/i.test(navigator.userAgent)?"intent://plan/"+id+"#Intent;scheme=nearry;package=com.nearry.app;S.browser_fallback_url="+encodeURIComponent(play)+";end":"nearry://plan/"+id;open.href=target;if(/android/i.test(navigator.userAgent))location.href=target})();</script></body></html>`;
async function main() {
  const output = process.env.LEGAL_OUTPUT_DIR || "dist-legal";
  await mkdir(output, { recursive: true });
  for (const page of ["privacy", "terms", "child-safety"] as const)
    await writeFile(
      join(output, `${page}.html`),
      shell(
        page === "privacy" ? "Privacy policy" : legalTitle(page),
        legalSections(page)
          .map(
            (s) =>
              `<section><h2>${escape(s.title)}</h2><p>${escape(s.body)}</p></section>`,
          )
          .join(""),
        legalUpdated(page),
      ),
    );
  await writeFile(
    join(output, "delete-account.html"),
    shell(
      "Delete your Nearry account",
      `<h2>From the app</h2><p>Open Profile or Business → Safety &amp; privacy → Delete my account. Read the consequences, type DELETE and confirm. Your account is deactivated, upcoming plans and bookings cancelled, and files and account data queued for permanent deletion.</p><h2>Without reinstalling</h2><p>Email <a href="mailto:${escape(legalContact.email)}?subject=Nearry%20account%20deletion">${escape(legalContact.email)}</a> from your registered email address with the subject “Nearry account deletion”. We will verify account ownership before processing the request. Do not send a password, sign-in code or identity document by email.</p><h2>What is removed</h2><p>Your profile, posts, uploaded files, offers, participation, bookings and shared conversations are removed. Temporary caches and provider backups may retain copies until their normal expiry. See the privacy policy for retention details. Deletion cannot be undone.</p>`,
    ),
  );
  await writeFile(
    join(output, "index.html"),
    shell(
      "Nearry support & policies",
      `<p>Find nearby plans, places and business offers with Nearry. Use the links above for privacy, community guidelines, account deletion and child safety.</p><p>For support, email <a href="mailto:${escape(legalContact.email)}">${escape(legalContact.email)}</a>.</p>`,
      "16 November 2026",
    ),
  );
  // Landing page for shared plan links: opens the plan in the app, or the
  // Play Store when the app isn't installed. Set EXPO_PUBLIC_SHARE_URL to
  // this page's hosted address so shared plans link here.
  await writeFile(join(output, "open.html"), openPlanPage);
  console.log(
    `Exported index.html, privacy.html, terms.html, delete-account.html, child-safety.html and open.html to ${output}. Review and host these files before submitting store URLs.`,
  );
}
void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Legal export failed");
  process.exitCode = 1;
});
