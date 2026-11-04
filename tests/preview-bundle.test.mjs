import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {STATIC_PREVIEW_ASSETS,previewBundlePlan,buildPreviewBundle} from '../scripts/ocean-preview-bundle.mjs';
import {readPreviewFiles} from '../scripts/ocean-preview-readiness.mjs';
test('local preview bundle uses public-only static files and never deploys',()=>{
 const files=readPreviewFiles();
 for(const name of STATIC_PREVIEW_ASSETS)if(!(name in files))files[name]=readFileSync(new URL('../'+name,import.meta.url),'utf8');
 const result=previewBundlePlan(files);
 assert.equal(result.ok,true,JSON.stringify(result.failures));
 assert.equal(result.deployActions,false);
 assert.equal(result.networkActions,false);
 assert.equal(result.files.length,8);
 assert.ok(!result.files.some(name=>name.includes('.env')||name.includes('secret')||name.includes('.git')));
});
test('bundle refuses missing modules and unsafe auth settings',()=>{
 const files=readPreviewFiles();
 const absent={...files};
 delete absent['od-runtime-config.js'];
 assert.equal(previewBundlePlan(absent).ok,false);
 const changed={...files,'od-runtime-config.js':files['od-runtime-config.js'].replace('enabled:false','enabled:true')};
 assert.ok(previewBundlePlan(changed).failures.includes('account_runtime_must_be_disabled_for_local_preview'));
});
test('local preview bundle copies matching files into a temporary folder without network',()=>{
 const directory=mkdtempSync(join(tmpdir(),'od-preview-'));
 try{
   const result=buildPreviewBundle(join(directory,'preview'));
   assert.equal(result.ok,true);
   for(const name of STATIC_PREVIEW_ASSETS)assert.ok(existsSync(join(directory,'preview',name)));
   assert.ok(readFileSync(join(directory,'preview','README.txt'),'utf8').includes('LOCAL DEMO'));
   assert.equal(result.deployActions,false);
 }finally{rmSync(directory,{recursive:true,force:true})}
});
