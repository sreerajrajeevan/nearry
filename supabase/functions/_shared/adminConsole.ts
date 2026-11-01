/**
 * Authenticated admin API. Service-role is server-only. All requests,
 * including read-only statistics and private proof links, require a valid
 * Supabase user JWT AND an allowlisted admin_console_members row.
 */
type Db = any;
const SECTIONS = new Set(["overview","business","reports","users","plans","offers","bookings","operations","audit"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 25;
const columns: Record<string,string> = {
  business: "id,user_id,document_path,created_at,reviewed_at,decision,attempts",
  reports: "id,reporter_id,subject_user_id,target_kind,target_id,reason,details,snapshot,status,created_at",
  users: "id,account_type,display_name,business_name,verification_status,onboarding_completed,created_at,suspended_at,deletion_requested_at",
  plans: "id,author_id,title,status,starts_at,venue_name,vacancies,created_at",
  offers: "id,business_id,title,status,starts_at,ends_at,created_at",
  bookings: "id,offer_id,customer_id,status,slot,party_size,created_at",
  audit: "id,actor_id,action,target_id,note,created_at",
};
function checked<T>(result: {data:T;error?:{message:string}|null}): T {
  if(result.error) throw new Error(result.error.message);
  return result.data;
}
function json(body:unknown,status:number,origin:string|null) {
  const headers: Record<string,string> = {
    "Content-Type":"application/json; charset=utf-8",
    "Cache-Control":"no-store",
    "X-Content-Type-Options":"nosniff",
    "Vary":"Origin",
  };
  if(origin) {
    headers["Access-Control-Allow-Origin"]=origin;
    headers["Access-Control-Allow-Headers"]="authorization, content-type, apikey, x-client-info";
    headers["Access-Control-Allow-Methods"]="POST, OPTIONS";
  }
  return new Response(JSON.stringify(body),{status,headers});
}
function validInt(value:unknown,max:number):number {
  const n=typeof value==="number" ? value : 0;
  return Number.isSafeInteger(n)&&n>=0?Math.min(n,max):0;
}
async function profilesFor(db:Db,ids:unknown[]) {
  const distinct=[...new Set(ids.filter((id):id is string=>typeof id==="string"&&UUID.test(id)))];
  if(!distinct.length) return {};
  const rows=checked<any[]>(await db.from("profiles")
    .select("id,display_name,business_name,verification_status,verification_doc_path")
    .in("id",distinct));
  return Object.fromEntries(rows.map((p:any)=>[p.id,{
    name:p.business_name||p.display_name||"Member",
    verification:p.verification_status,
    documentPath:p.verification_doc_path
  }]));
}
async function metrics(db:Db) {
  const specs:[string,string? ,string?][] = [
    ["users"],["posts"],["offers"],["bookings"],["content_reports","status","open"],
    ["verification_review_jobs","reviewed_at","null"]
  ];
  const vals=await Promise.all(specs.map(async ([table,field,value])=>{
    let q=db.from(table).select("id",{head:true,count:"exact"});
    if(field==="status") q=q.eq(field,value);
    if(field==="reviewed_at") q=q.is(field,null);
    const res=await q;
    if(res.error) throw new Error(res.error.message);
    return res.count??0;
  }));
  return Object.fromEntries(["users","plans","offers","bookings","openReports","pendingBusinessReviews"]
    .map((key,i)=>[key,vals[i]]));
}
async function list(db:Db,section:string,offset:number) {
  if(section==="overview") return {metrics:await metrics(db)};
  if(section==="operations") {
    const [deletions,media,push] = await Promise.all([
      db.from("account_deletion_jobs").select("user_id,requested_at,attempts,next_attempt_at,last_error").order("requested_at",{ascending:false}).limit(25),
      db.from("media_cleanup_jobs").select("id,bucket,path,attempts,next_attempt_at,last_error").order("next_attempt_at",{ascending:false}).limit(25),
      db.from("push_jobs").select("id,attempts,next_attempt_at,last_error").is("sent_at",null).order("next_attempt_at",{ascending:true}).limit(25),
    ]);
    return {operations:{
      deletions:checked(deletions),media:checked(media),push:checked(push)
    }};
  }
  const source:Record<string,string> = {
    business:"verification_review_jobs",reports:"content_reports",users:"profiles",
    plans:"posts",offers:"offers",bookings:"bookings",audit:"admin_console_audit",
  };
  const table=source[section];
  let q=db.from(table).select(columns[section]).order("created_at",{ascending:false});
  if(section==="business") q=q.is("reviewed_at",null);
  if(section==="reports") q=q.eq("status","open");
  const rows=checked<any[]>(await q.range(offset,offset+PAGE_SIZE-1));
  if(section==="business") {
    const people=await profilesFor(db,rows.map(r=>r.user_id));
    return {rows:rows.filter(r=>{
      const p=(people as any)[r.user_id];
      return p?.verification==="pending" && p?.documentPath===r.document_path;
    }).map(({document_path,...r}:any)=>({...r,person:(people as any)[r.user_id]?.name})) ,offset};
  }
  if(section==="reports") {
    const people=await profilesFor(db,rows.flatMap(r=>[r.reporter_id,r.subject_user_id]));
    return {rows:rows.map(({snapshot,...r}:any)=>({...r, evidence:snapshot,
      subject:(people as any)[r.subject_user_id]?.name||"Unknown"})),offset};
  }
  return {rows,offset};
}

export function createAdminConsoleHandler(db:Db, allowedOrigins:string|undefined) {
  const allowed=new Set((allowedOrigins??"").split(",").map(x=>x.trim()).filter(Boolean));
  return async (req:Request):Promise<Response>=>{
    const origin=req.headers.get("Origin");
    if(!allowed.size) return json({error:"Admin origin is not configured"},503,null);
    if(origin && !allowed.has(origin)) return json({error:"Origin not allowed"},403,null);
    if(req.method==="OPTIONS") {
      return new Response(null,{status:204,headers:{
        "Access-Control-Allow-Origin":origin??"",
        "Access-Control-Allow-Headers":"authorization, content-type, apikey, x-client-info",
        "Access-Control-Allow-Methods":"POST, OPTIONS",
        "Access-Control-Max-Age":"600","Vary":"Origin"
      }});
    }
    if(req.method!=="POST") return json({error:"Method not allowed"},405,origin);
    const bearer=req.headers.get("Authorization")||"";
    const token=/^Bearer (.+)$/i.exec(bearer)?.[1];
    if(!token || token.length>12000) return json({error:"Sign in required"},401,origin);
    const auth=await db.auth.getUser(token);
    const user=auth?.data?.user;
    if(auth.error || !user?.id || !UUID.test(user.id))
      return json({error:"Invalid or expired session"},401,origin);
    const member=await db.from("admin_console_members")
      .select("role").eq("user_id",user.id).is("revoked_at",null).maybeSingle();
    if(member.error) return json({error:"Admin membership unavailable"},503,origin);
    if(!member.data) return json({error:"Not an authorized Nearry administrator"},403,origin);
    let payload:any;
    try {payload=await req.json();} catch {return json({error:"Invalid request"},400,origin);}
    if(!payload||typeof payload!=="object"||Array.isArray(payload))
      return json({error:"Invalid request"},400,origin);
    try {
      if(payload.action==="status") return json({role:member.data.role},200,origin);
      if(payload.action==="list") {
        if(!SECTIONS.has(payload.section)) return json({error:"Invalid section"},400,origin);
        const result=await list(db,payload.section,validInt(payload.offset,5000));
        return json(result,200,origin);
      }
      if(payload.action==="proof") {
        if(!UUID.test(payload.id??"")) return json({error:"Invalid review ID"},400,origin);
        const review=checked<any>(await db.from("verification_review_jobs")
          .select("id,user_id,document_path,reviewed_at,created_at")
          .eq("id",payload.id).maybeSingle());
        if(!review || review.reviewed_at ||
          new Date(review.created_at).getTime()<Date.now()-7*86400000)
          return json({error:"Review unavailable"},404,origin);
        const profiles=await profilesFor(db,[review.user_id]);
        const p=(profiles as any)[review.user_id];
        if(!p || p.verification!=="pending"||p.documentPath!==review.document_path ||
          !review.document_path.startsWith(review.user_id+"/"))
          return json({error:"Review unavailable"},404,origin);
        const signed=checked<any>(await db.storage.from("verification_docs")
          .createSignedUrl(review.document_path,60));
        return json({url:signed.signedUrl,expiresIn:60},200,origin);
      }
      if(payload.action==="decide") {
        const kind=payload.kind, decision=payload.decision;
        if(!UUID.test(payload.id??"")||
          !((kind==="business"&&["approved","rejected"].includes(decision))||
            (kind==="report"&&["dismiss","remove","suspend"].includes(decision)))||
          typeof payload.note!=="string"||payload.note.length>200)
          return json({error:"Invalid moderation decision"},400,origin);
        if(kind==="report" && decision==="suspend" && member.data.role!=="owner")
          return json({error:"Only owners can suspend accounts"},403,origin);
        checked(await db.rpc("admin_console_decide",{
          p_actor:user.id,p_kind:kind,p_record_id:payload.id,
          p_decision:decision,p_note:payload.note,
        }));
        return json({ok:true},200,origin);
      }
      return json({error:"Unknown action"},400,origin);
    }catch(e){
      // No internal SQL, private paths or tokens in production responses.
      const message=e instanceof Error?e.message:"Failed";
      const safe=/^(review unavailable|review expired|report already reviewed|invalid|unsupported)/i.test(message);
      return json({error:safe?message:"Request failed. Check the server logs or retry."},safe?409:500,origin);
    }
  };
}
