// Deploy with JWT verification disabled ONLY for this secret-authenticated worker.
// Schedule POST calls using PUSH_DISPATCH_SECRET; never put that secret in Expo.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const secret = Deno.env.get('PUSH_DISPATCH_SECRET');
  if (!secret || req.headers.get('x-dispatch-secret') !== secret) {
    return new Response('unauthorized', { status: 401 });
  }
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: jobs, error } = await db.rpc('claim_push_jobs');
  if (error) return new Response('could not claim deliveries', { status: 500 });
  let sent = 0, failed = 0;
  for (const job of jobs ?? []) {
    try {
      const { data: tokens, error: tokenError } = await db.from('push_tokens').select('token').eq('user_id', job.user_id);
      if (tokenError) throw tokenError;
      const messages = (tokens ?? []).map(({ token }: { token: string }) => ({ to: token, title: job.title, body: job.body, sound: 'default' }));
      if (messages.length) {
        // Expo limits each request to 100 messages.
        for (let start = 0; start < messages.length; start += 100) {
          const batch = messages.slice(start, start + 100);
          const result = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(batch),
          });
          if (!result.ok) throw new Error(`Expo HTTP ${result.status}`);
          const payload = await result.json();
          if (!Array.isArray(payload.data) || payload.data.length !== batch.length) throw new Error('invalid Expo response');
          for (let i = 0; i < payload.data.length; i++) {
            const ticket = payload.data[i];
            if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
              await db.from('push_tokens').delete().eq('token', batch[i].to);
            } else if (ticket.status !== 'ok') throw new Error(ticket.details?.error ?? 'push rejected');
          }
        }
      }
      const { error: doneError } = await db.from('push_jobs').update({ sent_at: new Date().toISOString(), last_error: null }).eq('id', job.id);
      if (doneError) throw doneError;
      sent++;
    } catch (e) {
      failed++;
      await db.from('push_jobs').update({ last_error: e instanceof Error ? e.message.slice(0, 200) : 'delivery failed' }).eq('id', job.id);
    }
  }
  return Response.json({ sent, failed });
});
