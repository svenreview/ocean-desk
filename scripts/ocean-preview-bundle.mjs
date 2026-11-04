// Prepare a local-only static demo package; never deploy or modify remote services.
import {copyFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectLocalPreview,readPreviewFiles} from './ocean-preview-readiness.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const STATIC_PREVIEW_ASSETS=Object.freeze([
 'index.html','od-scenery.js','od-runtime-config.js','od-account.js',
 'od-focus-sync.js','od-auth-flow.mjs','od-wallet-bootstrap.mjs','od-config-validator.mjs'
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
  'OCEAN DESK LOCAL DEMO — 36th preview package\n\n'+
  'This archive is for local tests only. No Google OAuth or real rewards.\n'+
  '1. Unzip all files into the same folder.\n'+
  '2. Open a terminal in that folder.\n'+
  '3. Run: python3 -m http.server 4173 --bind 127.0.0.1\n'+
  '   Windows: py -m http.server 4173 --bind 127.0.0.1\n'+
  '4. Open http://127.0.0.1:4173 in a browser on that PC.\n'+
  'Use HTTP server, not file://; JS modules require an HTTP origin.\n'+
  'No production site, Supabase database, or account settings are changed.\n'
 ,'utf8');
 return {ok:true,files:plan.files.length,output:target,deployActions:false};
}
function readFile(name){try{return requireRead(name)}catch{return undefined}}
function requireRead(name){
 const file=resolve(root,name);
 return existsSync(file)?importedRead(file):undefined;
}
import {readFileSync as importedRead} from 'node:fs';
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=buildPreviewBundle(process.argv[2]||resolve(root,'preview-package'));
 console.log(JSON.stringify(result));
}
