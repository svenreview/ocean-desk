import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectStaging,LIVE_PROJECT_REF,LIVE_SITE_ORIGIN} from '../scripts/ocean-staging-preflight.mjs';

const valid={
 url:'https://separate-staging.supabase.co',
 publishableKey:'sb_publishable_test_key_123',
 origin:'https://ocean-desk-preview.example.com',
 googleClientId:'1234567890-testclient.apps.googleusercontent.com'
};
test('separate HTTPS staging with public credentials passes preflight without executing calls',()=>{
 const result=inspectStaging(valid);
 assert.equal(result.ok,true);
 assert.deepEqual(result.failures,[]);
 assert.equal(result.summary.networkOrDatabaseActionsPerformed,false);
 assert.equal(result.summary.actualGoogleOAuthTested,false);
});
test('live Supabase project blocked even with a staging preview hostname',()=>{
 const result=inspectStaging({...valid,url:'https://'+LIVE_PROJECT_REF+'.supabase.co'});
 assert.equal(result.ok,false);
 assert.ok(result.failures.includes('staging_project_required'));
});
test('live production hostname blocked even with a different Supabase project',()=>{
 const result=inspectStaging({...valid,origin:LIVE_SITE_ORIGIN});
 assert.equal(result.ok,false);
 assert.ok(result.failures.includes('production_site_not_allowed'));
});
test('insecure or malformed URL and keys fail closed',()=>{
 const cases=[
  {...valid,origin:'http://ocean-desk-preview.example.com'},
  {...valid,origin:'https://ocean-desk-preview.example.com/extra'},
  {...valid,url:'https://separate-staging.supabase.co/path'},
  {...valid,publishableKey:'sb_secret_do_not_use'},
  {...valid,googleClientId:'not-really-an-oauth-client'}
 ];
 for(const c of cases){
  const r=inspectStaging(c);
  assert.equal(r.ok,false,JSON.stringify(c));
 }
});
