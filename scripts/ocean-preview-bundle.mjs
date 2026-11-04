// Prepare a local-only static demo package; never deploy or modify remote services.
import {copyFileSync,mkdirSync,writeFileSync,existsSync,readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectLocalPreview} from './ocean-preview-readiness.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const STATIC_PREVIEW_ASSETS=Object.freeze([
 'index.html','od-scenery.js','od-runtime-config.js','od-account.js',
 'od-focus-sync.js','od-auth-flow.mjs','od-wallet-bootstrap.mjs','od-config-validator.mjs',
 'ocean-local-server.py'
]);
export function previewBundlePlan(files){
 const report=inspectLocalPreview(files);
 const missing=STATIC_PREVIEW_ASSETS.filter(name=>typeof files[name]!=='string');
 return {ok:report.ok&&!missing.length,failures:[...report.failures,...missing.map(x=>'asset_missing:'+x)],files:[...STATIC_PREVIEW_ASSETS],networkActions:false,deployActions:false};
}
export function buildPreviewBundle(outputDir){
 const plan=previewBundlePlan(Object.fromEntries(STATIC_PREVIEW_ASSETS.map(name=>[name,existsSync(resolve(root,name))?readFile(name):undefined]).concat([['vercel.json',readFile('vercel.json')]])));
 if(!plan.ok)throw Error('unsafe_or_incomplete_preview:'+plan.failures.join(','));
 const target=resolve(outputDir);
 if(target===root||target===resolve(root,'scripts'))throw Error('unsafe_output_directory');
 mkdirSync(target,{recursive:true});
 for(const name of plan.files)copyFileSync(resolve(root,name),resolve(target,name));
 writeFileSync(resolve(target,'README.txt'),
  'OCEAN DESK LOCAL DEMO — 37th preview package\n\n'+
  'This archive is for local tests only. No Google OAuth or real rewards.\n'+
  '1. Unzip all files into the same folder.\n'+
  '2. Open a terminal in that folder.\n'+
  '3. PC-only: py ocean-local-server.py (Windows) or python3 ocean-local-server.py (macOS/Linux).\n'+
  '4. PC URL: http://127.0.0.1:4173/\n'+
  '5. Phone on SAME TRUSTED PRIVATE Wi-Fi: stop server and restart with --lan.\n'+
  '   Windows: py ocean-local-server.py --lan\n'+
  '   macOS/Linux: python3 ocean-local-server.py --lan\n'+
  '6. The script prints POSSIBLE phone URLs. Check your PC private Wi-Fi IP and firewall.\n'+
  '7. Never use public Wi-Fi, port forwarding or internet exposure. Stop with Ctrl+C.\n'+
  '8. PC and phone local records are separate.\n'+
  'Use HTTP server, not file://; JS modules require an HTTP origin.\n'+
  'No production site, Supabase database, or account settings are changed.\n'
 ,'utf8');
 return {ok:true,files:plan.files.length,output:target,deployActions:false};
}
function readFile(name){
 const file=resolve(root,name);
 return existsSync(file)?readFileSync(file,'utf8'):undefined;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=buildPreviewBundle(process.argv[2]||resolve(root,'preview-package'));
 console.log(JSON.stringify(result));
}
