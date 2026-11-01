import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
const config=window.NEARRY_ADMIN_CONFIG;
const $=id=>document.getElementById(id);
const NAV=[
  ["overview","Overview","Home"],["business","Business reviews","Pending submissions"],
  ["reports","Safety reports","Open abuse cases"],["users","Accounts","User status"],
  ["plans","Plans","Posted activities"],["offers","Offers","Local promotions"],
  ["bookings","Bookings","Reservations"],["operations","Operations","Workers and queues"],
  ["audit","Audit trail","Moderator decisions"]
];
const safe=v=>String(v??"—").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const date=v=>v?new Date(v).toLocaleString(undefined,{dateStyle:"medium",timeStyle:"short"}):"—";
const shorten=(v,n=125)=>{const s=String(v??"—");return s.length>n?s.slice(0,n)+"…":s};
const field=(v,n)=>safe(shorten(v,n||110));
const cell=(v)=>'<td>'+v+'</td>';
const tag=v=>'<span class="chip '+(/pending|open|failed|rejected/i.test(String(v))?"attention":"")+'">'+safe(v)+'</span>';
const tdText=(v,n)=>cell('<span class="truncate">'+field(v,n)+'</span>');
const serverOk=config && /^https:\/\/.+\.supabase\.co$/.test(config.supabaseUrl)&&
  config.publishableKey && !config.publishableKey.includes("YOUR_") && !/service_role|sb_secret/i.test(config.publishableKey);
let client,section="overview",offset=0,rowsLength=0,session=null,role="";
let busy=false;
function message(text,auth=false){$(auth?"auth-message":"feedback").textContent=text||"";}
function configError(){ $("setup").hidden=false; $("setup").textContent="Admin configuration is missing or invalid. See admin/README.md (only public Supabase credentials belong in config.js)."; }
if(!serverOk){configError();}
else {
 client=createClient(config.supabaseUrl,config.publishableKey,{
   auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}
 });
 init().catch(e=>{message(e.message,true);showLogin();});
}
function showLogin(){session=null;$("signin").hidden=false;$("dashboard").hidden=true}
function showDashboard(){ $("signin").hidden=true;$("dashboard").hidden=false; }
async function call(payload){
 if(!session?.access_token) throw new Error("Session expired. Please sign in again.");
 const res=await fetch(config.supabaseUrl+"/functions/v1/admin-console",{
   method:"POST",
   headers:{"Authorization":"Bearer "+session.access_token,"apikey":config.publishableKey,"Content-Type":"application/json"},
   body:JSON.stringify(payload),cache:"no-store"
 });
 let body={};try{body=await res.json()}catch{}
 if(!res.ok)throw new Error(body.error||"Admin service unavailable");
 return body;
}
async function bootstrap(){
 const current=await client.auth.getSession();
 session=current.data.session;
 if(!session){showLogin();return}
 try{
   const me=await call({action:"status"});
   role=me.role;
   $("operator").textContent="Role: "+role;
   showDashboard();navigation();await load();
 }catch(e){showLogin();message(e.message,true)}
}
async function init(){
 $("email-form").addEventListener("submit",async e=>{
   e.preventDefault();message("Sending sign-in code…",true);
   const email=$("email").value.trim();
   try{
     const res=await client.auth.signInWithOtp({email,options:{shouldCreateUser:false}});
     if(res.error)throw res.error;
     $("code-form").hidden=false;message("Code requested. Check your email.",true);
   }catch(err){message(err.message,true)}
 });
 $("code-form").addEventListener("submit",async e=>{
   e.preventDefault();message("Verifying…",true);
   try{
     const r=await client.auth.verifyOtp({email:$("email").value.trim(),token:$("otp").value.trim(),type:"email"});
     if(r.error)throw r.error;
     session=r.data.session;await bootstrap();
   }catch(err){message(err.message,true)}
 });
 $("google").addEventListener("click",async()=>{
   const res=await client.auth.signInWithOAuth({provider:"google",options:{redirectTo:location.origin+location.pathname}});
   if(res.error)message(res.error.message,true);
 });
 $("signout").addEventListener("click",async()=>{
   await client.auth.signOut();session=null;showLogin();
 });
 $("refresh").addEventListener("click",()=>load());
 $("previous").addEventListener("click",()=>{offset=Math.max(0,offset-25);load()});
 $("next").addEventListener("click",()=>{offset+=25;load()});
 document.addEventListener("click",e=>{
   const nav=e.target.closest("[data-section]");
   if(nav){section=nav.dataset.section;offset=0;navigation();load();return}
   const btn=e.target.closest("[data-action]");
   if(btn)void decide(btn.dataset.action,btn.dataset.id,btn.dataset.kind);
 });
 const initial=await client.auth.getSession();
 session=initial.data.session;
 await bootstrap();
}
function navigation(){
 $("navigation").innerHTML=NAV.map(([id,title])=>
  '<button class="nav-item '+(section===id?"active":"")+'" data-section="'+id+'" aria-current="'+(section===id?"page":"false")+'">'+safe(title)+'</button>').join("");
 const active=NAV.find(n=>n[0]===section);
 $("section-title").textContent=active[1];
 $("section-description").textContent=active[2]+".";
}
async function load(){
 if(busy)return;
 busy=true;$("refresh").disabled=true;message("Loading…");
 try{
  const response=await call({action:"list",section,offset});
  if(section==="overview")renderMetrics(response.metrics);
  else if(section==="operations")renderOperations(response.operations);
  else renderTable(response.rows||[]);
  rowsLength=response.rows?.length||0;
  $("pagination").hidden=section==="overview"||section==="operations";
  $("page-label").textContent="Page "+(1+Math.floor(offset/25));
  $("previous").disabled=offset===0;
  $("next").disabled=rowsLength<25;
  message("");
 }catch(e){$("content").innerHTML='<div class="empty">'+safe(e.message)+'</div>';message("Unable to load "+section)}
 finally{busy=false;$("refresh").disabled=false}
}
function renderMetrics(m){
 const items=[
  ["Members",m.users],["Plans",m.plans],["Local offers",m.offers],
  ["Bookings",m.bookings],["Open reports",m.openReports],["Pending business reviews",m.pendingBusinessReviews]
 ];
 $("content").innerHTML='<div class="cards">'+items.map(([label,value])=>
  '<div class="metric"><span>'+safe(label)+'</span><strong>'+safe(value??0)+'</strong></div>').join("")+'</div>'+
  '<div class="panel" style="margin-top:20px"><h2>Review what matters</h2><p>Approve legitimate businesses, investigate reports and watch failed background jobs. This panel deliberately does not offer unrestricted reading of private conversations.</p></div>';
}
function table(headers,rows){
 if(!rows.length)return '<div class="empty">Nothing to review in this section.</div>';
 return '<div class="table-wrap"><table class="table"><thead><tr>'+headers.map(h=>'<th>'+safe(h)+'</th>').join("")+'</tr></thead><tbody>'+rows.join("")+'</tbody></table></div>';
}
const action=(label,id,kind,style="")=>
 '<button class="action '+style+'" data-action="'+safe(label)+'" data-kind="'+safe(kind)+'" data-id="'+safe(id)+'">'+safe(label)+'</button>';
function renderTable(rows){
 let head=[],out=[];
 switch(section){
 case "business":
  head=["Business","Submitted","Status","Actions"];
  out=rows.map(r=>'<tr>'+tdText(r.person||r.user_id)+tdText(date(r.created_at))+cell(tag("Pending"))+
  cell('<div class="actions">'+action("View proof",r.id,"business")+
  action("Approve",r.id,"business","positive")+action("Reject",r.id,"business","negative")+'</div>')+'</tr>');break;
 case "reports":
  head=["Reason","Subject","Evidence","Submitted","Actions"];
  out=rows.map(r=>'<tr>'+cell(tag(r.reason)+"<br>"+field(r.target_kind))+tdText(r.subject||r.subject_user_id)+
  tdText((r.details||"")+" · "+(r.evidence||""),250)+tdText(date(r.created_at))+
  cell('<div class="actions">'+action("Dismiss",r.id,"report")+
  action("Remove",r.id,"report","negative")+
  (role==="owner"?action("Suspend",r.id,"report","negative"):"")+'</div>')+'</tr>');break;
 case "users":
  head=["Member","Type","Verification","Status","Joined"];
  out=rows.map(r=>'<tr>'+tdText(r.business_name||r.display_name)+tdText(r.account_type)+cell(tag(r.verification_status))+
  cell(tag(r.deletion_requested_at?"Deleting":r.suspended_at?"Suspended":"Active"))+tdText(date(r.created_at))+'</tr>');break;
 case "plans":
  head=["Plan","Host ID","When","Status","Spots"];
  out=rows.map(r=>'<tr>'+tdText(r.title,100)+tdText(r.author_id)+tdText(date(r.starts_at))+cell(tag(r.status))+tdText(r.vacancies)+'</tr>');break;
 case "offers":
  head=["Offer","Business ID","Starts","Ends","Status"];
  out=rows.map(r=>'<tr>'+tdText(r.title,100)+tdText(r.business_id)+tdText(date(r.starts_at))+tdText(date(r.ends_at))+cell(tag(r.status))+'</tr>');break;
 case "bookings":
  head=["Booking ID","Customer ID","Offer ID","Slot","Status"];
  out=rows.map(r=>'<tr>'+tdText(r.id)+tdText(r.customer_id)+tdText(r.offer_id)+tdText(date(r.slot))+cell(tag(r.status))+'</tr>');break;
 case "audit":
  head=["Action","Actor ID","Target ID","Note","At"];
  out=rows.map(r=>'<tr>'+tdText(r.action)+tdText(r.actor_id)+tdText(r.target_id)+tdText(r.note,150)+tdText(date(r.created_at))+'</tr>');break;
 }
 $("content").innerHTML=table(head,out);
}
function renderOperations(o){
 const op=(name,items,cols,fields)=>'<section class="panel"><h2>'+safe(name)+'</h2>'+
   table(cols,items.map(item=>'<tr>'+fields.map(f=>tdText(f(item),100)).join("")+'</tr>'))+'</section>';
 $("content").innerHTML=op("Account deletion queue",o.deletions,["Account ID","Attempts","Last error","Requested"],[
  r=>r.user_id,r=>r.attempts,r=>r.last_error,r=>date(r.requested_at)])+
 op("Pending file cleanup",o.media,["Bucket","Path","Attempts","Last error"],[
  r=>r.bucket,r=>r.path,r=>r.attempts,r=>r.last_error])+
 op("Pending push notifications",o.push,["Job ID","Attempts","Last error"],[
  r=>r.id,r=>r.attempts,r=>r.last_error]);
}
async function decide(action,id,kind){
 if(!id||!kind)return;
 if(action==="View proof"){
   message("Generating a short-lived private proof link…");
   try{
    const r=await call({action:"proof",id});
    if(!r.url.startsWith("https://"))throw new Error("Invalid document URL");
    window.open(r.url,"_blank","noopener,noreferrer");
    message("Private link expires in one minute. Do not share it.");
   }catch(e){message(e.message)}
   return;
 }
 const codes={Approve:"approved",Reject:"rejected",Dismiss:"dismiss",Remove:"remove",Suspend:"suspend"};
 const decision=codes[action];if(!decision)return;
 if(!confirm(action+" this "+(kind==="business"?"business review":"report")+"? This decision is logged."))return;
 let note="";
 if(["rejected","remove","suspend"].includes(decision)){
  const text=prompt("Enter a review reason (max 200 characters):");
  if(text===null)return;
  note=text.trim().slice(0,200);
  if(!note){message("Reason is required for this decision.");return;}
 }
 message("Saving moderation decision…");
 try{await call({action:"decide",kind,id,decision,note});message("Action saved and audited.");await load();}
 catch(e){message(e.message)}
}
