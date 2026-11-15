import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

function run(code: string, reviewEnabled = "true") {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "--eval", code],
    {
      cwd: new URL("../", import.meta.url),
      encoding: "utf8",
      timeout: 20000,
      env: {
        ...process.env,
        EXPO_PUBLIC_REVIEWER_LOGIN_ENABLED: reviewEnabled,
        EXPO_PUBLIC_EMAIL_OTP_ENABLED: "false",
        EXPO_PUBLIC_SUPABASE_URL: "https://review-test.supabase.co",
        EXPO_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_testfixture",
      },
    },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
}
const setup = `
  import assert from 'node:assert/strict';
  import {signInReviewer} from './src/services/reviewerAuth.ts';
  import {getSupabase} from './src/services/supabase.ts';
  let calls=[];
  globalThis.fetch=async (url,init)=>{calls.push({url:String(url),init});return new Response(JSON.stringify({error:'invalid_grant',error_description:'private provider diagnostic'}),{status:400,headers:{'content-type':'application/json'}});};
`;

test("review access is unavailable in ordinary builds and makes no auth request", () => {
  run(
    setup +
      `await assert.rejects(signInReviewer('nearry.play.personal@example.invalid','fixture'),/review credentials/);assert.equal(calls.length,0);`,
    "false",
  );
});
test("review access rejects an ordinary email before calling Supabase", () => {
  run(
    setup +
      `await assert.rejects(signInReviewer('someone@nearry.app','fixture'),/review credentials/);assert.equal(calls.length,0);`,
  );
});
test("review login uses normal password authentication and never accepts a provider failure", () => {
  run(
    setup +
      `await assert.rejects(signInReviewer(' NEARRY.PLAY.PERSONAL@example.invalid ','fixture'),/Could not sign in/);
    assert.equal(calls.length,1);assert.match(calls[0].url,/auth\\/v1\\/token\\?grant_type=password/);
    const body=JSON.parse(calls[0].init.body);assert.equal(body.email,'nearry.play.personal@example.invalid');assert.equal(body.password,'fixture');
    await getSupabase().auth.stopAutoRefresh();`,
  );
});
test("a Google-only test build cannot request or verify an email code through another screen", () => {
  run(`import assert from 'node:assert/strict';import {sendEmailOtp,verifyEmailOtp} from './src/services/emailAuth.ts';
    let calls=0;globalThis.fetch=async()=>{calls++;throw Error('unexpected request');};
    await assert.rejects(sendEmailOtp('person@nearry.app','personal'),/continue with Google/);
    await assert.rejects(verifyEmailOtp('person@nearry.app','12345678'),/continue with Google/);assert.equal(calls,0);`);
});
