import { join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import {
  legalConfigured,
  legalContact,
  legalSections,
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
const shell = (title: string, body: string) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} · Nearry</title><style>body{max-width:760px;margin:40px auto;padding:0 24px;background:#FAF9F5;color:#252A26;font:17px/1.65 system-ui}h1{font-size:36px;line-height:1.2}h2{font-size:22px;margin-top:32px}a{color:#A64025}nav{display:flex;gap:16px;flex-wrap:wrap}p{white-space:pre-line}</style></head><body><nav><a href="privacy.html">Privacy</a><a href="terms.html">Terms</a><a href="delete-account.html">Delete account</a></nav><h1>${escape(title)}</h1><p>Nearry · Last updated 19 October 2026</p>${body}<footer><p>${escape(legalContact.owner)} · <a href="mailto:${escape(legalContact.email)}">${escape(legalContact.email)}</a></p></footer></body></html>`;
async function main() {
  const output = process.env.LEGAL_OUTPUT_DIR || "dist-legal";
  await mkdir(output, { recursive: true });
  for (const page of ["privacy", "terms"] as const)
    await writeFile(
      join(output, `${page}.html`),
      shell(
        page === "privacy" ? "Privacy policy" : "Community guidelines & terms",
        legalSections(page)
          .map(
            (s) =>
              `<section><h2>${escape(s.title)}</h2><p>${escape(s.body)}</p></section>`,
          )
          .join(""),
      ),
    );
  await writeFile(
    join(output, "delete-account.html"),
    shell(
      "Delete your Nearry account",
      `<h2>From the app</h2><p>Open Profile or Business → Safety &amp; privacy → Delete my account. Read the consequences, type DELETE and confirm. Your account is deactivated, upcoming plans and bookings cancelled, and files and account data queued for permanent deletion.</p><h2>Without reinstalling</h2><p>Email <a href="mailto:${escape(legalContact.email)}?subject=Nearry%20account%20deletion">${escape(legalContact.email)}</a> from your registered email address with the subject “Nearry account deletion”. We will verify account ownership before processing the request. Do not send a password, sign-in code or identity document by email.</p><h2>What is removed</h2><p>Your profile, posts, uploaded files, offers, participation, bookings and shared conversations are removed. Temporary caches and provider backups may retain copies until their normal expiry. See the privacy policy for retention details. Deletion cannot be undone.</p>`,
    ),
  );
  console.log(
    `Exported privacy.html, terms.html and delete-account.html to ${output}. Review and host these files before submitting store URLs.`,
  );
}
void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Legal export failed");
  process.exitCode = 1;
});
