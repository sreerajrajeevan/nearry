// notify-verification — emails the admin when a business submits a
// verification document. Called by a Postgres trigger (pg_net) when
// profiles.verification_status flips to 'pending'.
//
// Deploy with JWT verification disabled (trigger has no user JWT):
//   supabase functions deploy notify-verification --no-verify-jwt
// Secrets (supabase secrets set):
//   RESEND_API_KEY, ADMIN_EMAIL, REVIEW_SECRET
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API = 'https://api.resend.com/emails';
const TOKEN_TTL_MS = 7 * 24 * 3600 * 1000;

async function hmacSign(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function toBase64(buf: Uint8Array): string {
  let s = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) {
    s += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  return btoa(s);
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const adminEmail = Deno.env.get('ADMIN_EMAIL');
  const reviewSecret = Deno.env.get('REVIEW_SECRET');
  if (!url || !serviceKey || !resendKey || !adminEmail || !reviewSecret) {
    return new Response('email not configured', { status: 500 });
  }

  const { user_id } = await req.json().catch(() => ({}));
  if (!user_id) return new Response('missing user_id', { status: 400 });

  const db = createClient(url, serviceKey);
  const { data: p } = await db
    .from('profiles')
    .select('id, display_name, business_name, verification_doc_path, verification_status')
    .eq('id', user_id)
    .single();
  // Only notify for genuine pending reviews with a document attached.
  if (!p || p.verification_status !== 'pending' || !p.verification_doc_path) {
    return Response.json({ skipped: true });
  }

  const { data: file, error: dlError } = await db.storage
    .from('verification_docs')
    .download(p.verification_doc_path);
  if (dlError || !file) return new Response('document download failed', { status: 500 });
  const b64 = toBase64(new Uint8Array(await file.arrayBuffer()));
  const filename = String(p.verification_doc_path).split('/').pop() ?? 'document';

  // Signed review links (7-day expiry, HMAC so they can't be forged).
  const payload = btoa(JSON.stringify({ user_id: p.id, exp: Date.now() + TOKEN_TTL_MS }));
  const sig = await hmacSign(payload, reviewSecret);
  const token = `${payload}.${sig}`;
  const reviewBase = `${url}/functions/v1/review-verification?token=${encodeURIComponent(token)}`;
  const approveUrl = `${reviewBase}&decision=approved`;

  const name = p.business_name || p.display_name;
  const html = `
    <div style="font-family:sans-serif;max-width:560px">
      <h2>New business verification: ${esc(name)}</h2>
      <p><b>Business:</b> ${esc(name)}<br><b>Contact name:</b> ${esc(p.display_name)}</p>
      <p>The uploaded document is attached to this email.</p>
      <p>
        <a href="${approveUrl}" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold">APPROVE</a>
        &nbsp;
        <a href="${reviewBase}" style="display:inline-block;background:#fff;color:#111;padding:12px 24px;text-decoration:none;border-radius:8px;border:1px solid #ccc;font-weight:bold">REVIEW / REJECT WITH REASON</a>
      </p>
      <p style="color:#666;font-size:13px">Links expire in 7 days. Reject reasons: need a clearer photo, valid ID required, etc.</p>
    </div>`;

  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Nearry Verification <onboarding@resend.dev>',
      to: [adminEmail],
      subject: `Verify business: ${name}`,
      html,
      attachments: [{ filename, content: b64, content_type: file.type || 'application/octet-stream' }],
    }),
  });
  if (!res.ok) return new Response(`resend failed: ${await res.text()}`, { status: 502 });
  return Response.json({ sent: true });
});
