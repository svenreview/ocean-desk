import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectLocalPreview,readPreviewFiles,REQUIRED_PREVIEW_FILES} from '../scripts/ocean-preview-readiness.mjs';

test('current local preview files pass read-only safety checks',()=>{
 const result=inspectLocalPreview(readPreviewFiles());
 assert.equal(result.ok,true,JSON.stringify(result.failures));
 assert.equal(result.actionsPerformed,false);
 assert.equal(result.previewDeployed,false);
});
test('preview blocks an enabled auth runtime and hidden missing dependencies',()=>{
 const files=readPreviewFiles();
 const enabled={...files,'od-runtime-config.js':files['od-runtime-config.js'].replace('enabled:false','enabled:true')};
 assert.ok(inspectLocalPreview(enabled).failures.includes('account_runtime_must_be_disabled_for_local_preview'));
 const missing={...files};delete missing['od-scenery.js'];
 assert.ok(inspectLocalPreview(missing).failures.includes('required_file_missing:od-scenery.js'));
});
test('preview refuses malformed deployment configuration and private browser credentials',()=>{
 const files=readPreviewFiles();
 const bad={...files,'vercel.json':'not-json','od-runtime-config.js':files['od-runtime-config.js']+"\nconst GOOGLE_CLIENT_SECRET='do-not-place-here';"};
 const result=inspectLocalPreview(bad);
 assert.ok(result.failures.includes('vercel_json_invalid'));
 assert.ok(result.failures.includes('potential_private_credential_in_browser_config'));
});
test('preview only reads repository files and never claims a deployment',()=>{
 const result=inspectLocalPreview(readPreviewFiles());
 assert.equal(REQUIRED_PREVIEW_FILES.length,6);
 assert.equal(result.actionsPerformed,false);
 assert.equal(result.previewDeployed,false);
});
