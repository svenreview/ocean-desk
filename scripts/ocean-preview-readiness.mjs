// Read-only preview readiness: run with "node scripts/ocean-preview-readiness.mjs".
// Does NOT deploy, contact APIs, change settings, or reveal secret values.
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const REQUIRED_PREVIEW_FILES=['index.html','od-scenery.js','od-runtime-config.js','od-account.js','od-focus-sync.js','vercel.json'];
export function inspectLocalPreview(files){
  const failures=[],warnings=[];
  for(const name of REQUIRED_PREVIEW_FILES)if(typeof files[name]!=='string')failures.push('required_file_missing:'+name);
  const html=files['index.html']||'';
  const config=files['od-runtime-config.js']||'';
  const vercel=files['vercel.json']||'';
  for(const src of ['od-scenery.js','od-runtime-config.js']){
    if(!html.includes(src))failures.push('html_dependency_not_referenced:'+src);
  }
  if(!/enabled\s*:\s*false\b/.test(config))failures.push('account_runtime_must_be_disabled_for_local_preview');
  if(!/googleEnabled\s*:\s*false\b/.test(config))failures.push('google_oauth_must_be_disabled_for_local_preview');
  if(!/serverFocusEnabled\s*:\s*false\b/.test(config))failures.push('server_focus_must_be_disabled_for_local_preview');
  if(!/autoInitializeWallet\s*:\s*false\b/.test(config))failures.push('wallet_auto_init_must_be_disabled_for_local_preview');
  if(/(?:service_role|sb_secret_|SUPABASE_SERVICE_ROLE_KEY|GOOGLE_CLIENT_SECRET)\s*[:=]\s*['"][^'"]+/i.test(config))failures.push('potential_private_credential_in_browser_config');
  if(!html.includes('od-local-daily-focus-v1'))warnings.push('daily_focus_store_not_detected');
  try{
    const parsed=JSON.parse(vercel);
    if(parsed.version!==2)warnings.push('unexpected_vercel_schema_version');
  }catch{failures.push('vercel_json_invalid')}
  return {ok:failures.length===0,failures,warnings,actionsPerformed:false,previewDeployed:false};
}
export function readPreviewFiles(){
  const data={};
  for(const name of REQUIRED_PREVIEW_FILES){
    const file=resolve(root,name);
    if(existsSync(file))data[name]=readFileSync(file,'utf8');
  }
  return data;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const report=inspectLocalPreview(readPreviewFiles());
  console.log(JSON.stringify(report,null,2));
  if(!report.ok)process.exitCode=1;
}
