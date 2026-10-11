// Supabase Edge Function: send-push
//
// Sends an Expo push notification to all registered devices of a user.
// Deploy:  supabase functions deploy send-push
// Secrets: supabase secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
//          (SUPABASE_URL is auto-provided on hosted Supabase.)
//
// The app invokes this (fire-and-forget) after actions that notify another
// user: sending a chat message, requesting to join, approving a request,
// creating/confirming a booking. The in-app notification row is written by
// DB triggers regardless, so the notification center works even if this
// function is not deployed.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 });
  }
  let payload: { user_id?: string; title?: string; body?: string };
  try {
    payload = await req.json();
  } catch {
    return new Response('bad request', { status: 400 });
  }
  const { user_id, title, body } = payload;
  if (!user_id || !title) {
    return new Response('missing user_id/title', { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('user_id', user_id);
  if (!tokens || tokens.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const messages = tokens.map((t: { token: string }) => ({
    to: t.token,
    sound: 'default',
    title,
    body: body ?? '',
  }));
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messages),
  });
  return new Response(JSON.stringify({ sent: messages.length, status: res.status }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
