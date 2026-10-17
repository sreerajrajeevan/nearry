// review-verification — admin review page + decision endpoint for business
// verification. Links are HMAC-signed (?token=...) and emailed by
// notify-verification; no login needed, links expire in 7 days.
//
// Deploy with JWT verification disabled (email links carry no user JWT):
//   supabase functions deploy review-verification --no-verify-jwt
// Secrets: REVIEW_SECRET (same value as notify-verification uses).
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const REJECT_REASONS = [
  'Need a clearer photo',
  'Valid ID required',
  'Document not acceptable',
];

async function hmacSign(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function verifyToken(token: string, secret: string): Promise<{ user_id: string } | null> {
  const dot = token.lastIndexOf('.');
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if ((await hmacSign(payload, secret)) !== sig) return null;
  try {
    const data = JSON.parse(atob(payload));
    if (!data.user_id || data.exp < Date.now()) return null;
    return { user_id: data.user_id };
  } catch {
    return null;
  }
}

function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function page(title: string, body: string): Response {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
     <title>${esc(title)}</title>
     <style>body{font-family:sans-serif;background:#0a0a0a;color:#f5f5f5;max-width:640px;margin:0 auto;padding:24px}
     h1{font-size:22px}.card{background:#141414;border:1px solid #2a2a2a;border-radius:12px;padding:16px;margin:16px 0}
     img{max-width:100%;border-radius:8px}.btn{display:inline-block;padding:12px 20px;border-radius:8px;font-weight:bold;border:0;cursor:pointer;font-size:15px;margin:6px 6px 6px 0}
     .approve{background:#16a34a;color:#fff}.reason{background:#1f1f1f;color:#f5f5f5;border:1px solid #444}
     input[type=text]{width:100%;box-sizing:border-box;background:#000;color:#f5f5f5;border:1px solid #444;border-radius:8px;padding:12px;margin-top:8px}
     a{color:#e11d2e}.muted{color:#999;font-size:13px}</style></head>
     <body><h1>${esc(title)}</h1>${body}</body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

serve(async (req) => {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const reviewSecret = Deno.env.get('REVIEW_SECRET');
  if (!url || !serviceKey || !reviewSecret) return new Response('not configured', { status: 500 });
  const db = createClient(url, serviceKey);

  const reqUrl = new URL(req.url);
  let token = reqUrl.searchParams.get('token') ?? '';
  let decision = reqUrl.searchParams.get('decision');
  let reason = '';

  if (req.method === 'POST') {
    const form = await req.formData().catch(() => null);
    token = String(form?.get('token') ?? '');
    decision = String(form?.get('decision') ?? '');
    reason = String(form?.get('reason') ?? '').trim();
  }

  const authed = await verifyToken(token, reviewSecret);
  if (!authed) return page('Link invalid', '<p>This review link is invalid or expired.</p>');

  const { data: p } = await db
    .from('profiles')
    .select('id, display_name, business_name, verification_doc_path, verification_status, verification_note')
    .eq('id', authed.user_id)
    .single();
  if (!p) return page('Not found', '<p>Business not found.</p>');

  // ── Apply a decision ──
  if (decision === 'approved' || decision === 'rejected') {
    const note = decision === 'rejected' ? (reason || 'Not approved.') : null;
    const status = decision === 'approved' ? 'verified' : 'rejected';
    await db.from('profiles').update({ verification_status: status, verification_note: note }).eq('id', p.id);
    await db.from('notifications').insert({
      user_id: p.id,
      kind: decision === 'approved' ? 'verification_approved' : 'verification_rejected',
      title: decision === 'approved' ? 'Verification approved' : 'Verification needs attention',
      body: decision === 'approved'
        ? 'Your business is verified. You can now publish offers.'
        : `Not approved: ${note} Please submit a new document.`,
    });
    const name = p.business_name || p.display_name;
    return page(
      decision === 'approved' ? 'Approved ✓' : 'Rejected',
      `<div class="card"><p><b>${esc(name)}</b> is now <b>${status.toUpperCase()}</b>.</p>` +
        (note ? `<p>Reason sent to business: ${esc(note)}</p>` : '') +
        `<p class="muted">They have been notified in the app.</p></div>`,
    );
  }

  // ── Review page ──
  if (p.verification_status !== 'pending') {
    return page('Already reviewed', `<p>This business is already <b>${esc(p.verification_status)}</b>.</p>`);
  }
  let docHtml = '<p class="muted">Document unavailable.</p>';
  if (p.verification_doc_path) {
    const { data: signed } = await db.storage.from('verification_docs').createSignedUrl(p.verification_doc_path, 3600);
    if (signed?.signedUrl) {
      const isImg = /\.(png|jpe?g|gif|webp)$/i.test(p.verification_doc_path);
      docHtml = isImg
        ? `<a href="${signed.signedUrl}" target="_blank"><img src="${signed.signedUrl}" alt="verification document"></a>`
        : `<p><a href="${signed.signedUrl}" target="_blank">Open document</a></p>`;
    }
  }
  const name = p.business_name || p.display_name;
  const reasonBtns = REJECT_REASONS.map(
    (r) => `<form method="post" style="display:inline">
      <input type="hidden" name="token" value="${esc(token)}">
      <input type="hidden" name="decision" value="rejected">
      <input type="hidden" name="reason" value="${esc(r)}">
      <button class="btn reason" type="submit">${esc(r)}</button></form>`,
  ).join('');
  return page(
    `Review: ${name}`,
    `<div class="card"><p><b>Business:</b> ${esc(name)}<br><b>Contact:</b> ${esc(p.display_name)}</p></div>
     <div class="card">${docHtml}</div>
     <div class="card">
       <form method="post">
         <input type="hidden" name="token" value="${esc(token)}">
         <input type="hidden" name="decision" value="approved">
         <button class="btn approve" type="submit">APPROVE</button>
       </form>
       <p class="muted">or reject with a reason (sent to the business in-app):</p>
       ${reasonBtns}
       <form method="post">
         <input type="hidden" name="token" value="${esc(token)}">
         <input type="hidden" name="decision" value="rejected">
         <input type="text" name="reason" placeholder="Custom reason…" maxlength="200">
         <button class="btn reason" type="submit" style="margin-top:8px">REJECT WITH NOTE</button>
       </form>
     </div>`,
  );
});
