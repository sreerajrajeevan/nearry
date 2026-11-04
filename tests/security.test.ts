import {test} from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error Node-only JavaScript build helper has no declaration file.
import {auditClientText,securityProblems} from "../scripts/security-check.mjs";
test("public Supabase anon/publishable settings are allowed",()=>{
 assert.deepEqual(auditClientText('const key=process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;'),[]);
});
test("publicly prefixed secrets and hardcoded private keys are flagged",()=>{
 assert.equal(auditClientText('const key=process.env.EXPO_PUBLIC_SERVICE_ROLE_KEY;').length,1);
 assert.equal(auditClientText("const key='sb_secret_123456789abcdef';").length,1);
});
test("mobile and web entrypoints contain no obvious privileged secrets",async()=>{
 assert.deepEqual(await securityProblems(),[]);
});
