import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT=fileURLToPath(new URL("../",import.meta.url));
const extensions=/\.(ts|tsx|js|mjs|json)$/i;
const exposedEnv=/\bEXPO_PUBLIC_[A-Z0-9_]*(?:SERVICE_ROLE|SECRET|PRIVATE_KEY|DISPATCH|RESEND_API_KEY|STRIPE_SECRET|WEBHOOK_SECRET)(?:_[A-Z0-9_]+)?\b/g;
const leakedService=/["'](?:sb_secret_[A-Za-z0-9_-]{8,}|eyJ[A-Za-z0-9_-]{25,}\.eyJ[A-Za-z0-9_-]{25,}\.[A-Za-z0-9_-]{25,})["']/g;

/** Returns only issue categories; never prints a suspected secret. */
export function auditClientText(text) {
 const problems=[];
 if(exposedEnv.test(text))problems.push("A private secret is referenced as EXPO_PUBLIC_*");
 exposedEnv.lastIndex=0;
 if(leakedService.test(text))problems.push("Possible hardcoded privileged API key or token");
 leakedService.lastIndex=0;
 return problems;
}
async function walk(path){
 const items=[];
 try{
  for(const dirent of await readdir(path,{withFileTypes:true})){
   if(dirent.name.startsWith(".")||dirent.name==="node_modules")continue;
   const child=join(path,dirent.name);
   if(dirent.isDirectory())items.push(...await walk(child));
   else if(extensions.test(child))items.push(child);
  }
 }catch(e){if(e.code!=="ENOENT")throw e;}
 return items;
}
export async function securityProblems(root=ROOT){
 const files=[
  ...await walk(join(root,"src")),
  ...await walk(join(root,"admin")),
  join(root,"App.tsx"),join(root,"app.json")
 ];
 const issues=[];
 for(const file of files){
  let source;
  try{source=await readFile(file,"utf8");}catch(e){if(e.code==="ENOENT")continue;throw e;}
  for(const item of auditClientText(source))
   issues.push(relative(root,file)+": "+item);
 }
 return issues;
}
if(process.argv[1] && fileURLToPath(import.meta.url)===fileURLToPath(new URL("file://"+process.argv[1],import.meta.url))){
 void securityProblems().then(problems=>{
  if(problems.length){
   console.error("Nearry client security audit failed:\n- "+problems.join("\n- "));
   process.exitCode=1;
  }else console.log("Nearry client audit: no obvious embedded private keys or EXPO_PUBLIC_* secrets.");
 }).catch(error=>{
  console.error("Nearry client audit could not complete:",error.message);
  process.exitCode=1;
 });
}
