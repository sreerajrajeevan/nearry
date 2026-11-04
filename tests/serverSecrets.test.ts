import test from "node:test";
import assert from "node:assert/strict";
import { validServerSecret } from "../supabase/functions/_shared/serverSecrets";

test("worker config fails closed for absent, short or placeholder secrets",()=>{
 for(const item of [undefined,null,"","test-secret","changeme-1234","  "+"a".repeat(40)+"  "])
  assert.equal(validServerSecret(item),false);
 assert.equal(validServerSecret("a".repeat(32)),true);
 assert.equal(validServerSecret("long-unique-secret-for-worker-2026-11-04"),true);
});
