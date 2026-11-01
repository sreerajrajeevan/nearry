import { test } from "node:test";
import assert from "node:assert/strict";
import { createAdminConsoleHandler } from "../supabase/functions/_shared/adminConsole";

const user="00000000-0000-0000-0000-000000000010";
const origin="https://admin.nearry.example";
function db({authenticated=true,member=true,role="owner"}={}) {
 let authCalls=0;
 return {client:{
  auth:{getUser:async (token:string)=>{
    authCalls++;
    return authenticated&&token==="valid"?{data:{user:{id:user}},error:null}:{data:{user:null},error:{message:"invalid"}};
  }},
  from:()=>({select:()=>({eq:()=>({is:()=>({
    maybeSingle:async()=>({data:member?{role}:null,error:null})
  })})})}),
  rpc:async()=>({data:null,error:null})
 } as any,getAuthCalls:()=>authCalls};
}
function request(body:any, token="valid", from=origin) {
 return new Request("https://example.supabase.co/functions/v1/admin-console",{
  method:"POST",headers:{"Origin":from,"Authorization":"Bearer "+token,
  "Content-Type":"application/json"},body:JSON.stringify(body)
 });
}
test("strict origin configuration and block unwanted origins",async()=>{
 const x=db();
 assert.equal((await createAdminConsoleHandler(x.client,undefined)(request({action:"status"}))).status,503);
 assert.equal((await createAdminConsoleHandler(x.client,origin)(request({action:"status"},"valid","https://evil.example"))).status,403);
 assert.equal(x.getAuthCalls(),0);
});
test("invalid tokens and unallowlisted users cannot reach admin",async()=>{
 const h=createAdminConsoleHandler(db().client,origin);
 assert.equal((await h(request({action:"status"},"invalid"))).status,401);
 const noUser=createAdminConsoleHandler(db({member:false}).client,origin);
 assert.equal((await noUser(request({action:"status"}))).status,403);
});
test("authorized owner gets role only, no cached private response",async()=>{
 const r=await createAdminConsoleHandler(db().client,origin)(request({action:"status"}));
 assert.equal(r.status,200);
 assert.deepEqual(await r.json(),{role:"owner"});
 assert.equal(r.headers.get("Cache-Control"),"no-store");
});
test("moderators cannot suspend and business actions validate decisions",async()=>{
 const h=createAdminConsoleHandler(db({role:"moderator"}).client,origin);
 assert.equal((await h(request({action:"decide",kind:"report",id:user,decision:"suspend",note:"reason"}))).status,403);
 assert.equal((await h(request({action:"decide",kind:"business",id:user,decision:"suspend",note:""}))).status,400);
});
test("preflight only permits explicitly configured origins",async()=>{
 const h=createAdminConsoleHandler(db().client,origin);
 const mk=o=>new Request("https://example.supabase.co/functions/v1/admin-console",{method:"OPTIONS",headers:{"Origin":o}});
 assert.equal((await h(mk(origin))).status,204);
 assert.equal((await h(mk("https://evil.example"))).status,403);
});
