import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateRuntimeConfig} from '../od-config-validator.mjs';

const base={enabled:true,url:'https://staging.supabase.co',publishableKey:'sb_publishable_testkey',
 googleEnabled:true,serverFocusEnabled:true,autoInitializeWallet:true,
 allowedOrigins:['http://127.0.0.1:4173','https://preview.ocean.example']};
const check=(v,origin='http://127.0.0.1:4173')=>validateRuntimeConfig(v,origin);

test('disabled config never activates server features',()=>{
 const r=check({enabled:false,googleEnabled:true,serverFocusEnabled:true});
 assert.equal(r.ok,true);assert.equal(r.config.enabled,false);
 assert.equal(r.config.googleEnabled,false);assert.equal(r.config.serverFocusEnabled,false);
});

test('allowlisted preview and local origins can enable public-only config',()=>{
 const local=check(base);
 const preview=check(base,'https://preview.ocean.example');
 assert.equal(local.ok,true);
 assert.equal(preview.ok,true);
 assert.equal(local.config.autoInitializeWallet,true);
 assert.equal(local.config.allowedOrigins,undefined);
});

test('unlisted origin, http remote origin, malformed urls fail closed',()=>{
 for(const [input,origin] of [
  [base,'https://evil.example'],
  [base,'http://preview.ocean.example'],
  [{...base,url:'https://evil.example'},'http://127.0.0.1:4173'],
  [{...base,url:'http://staging.supabase.co'},'http://127.0.0.1:4173'],
  [{...base,url:'https://staging.supabase.co/malicious'},'http://127.0.0.1:4173'],
 ]){
  const r=check(input,origin);
  assert.equal(r.ok,false);
  assert.equal(r.config.enabled,false);
 }
});

test('secret or legacy anonymous keys are rejected from browser config',()=>{
 for(const key of ['sb_secret_BAD','eyJlegacyAnon','service_role','sb_publishable_']){
  const r=check({...base,publishableKey:key});
  assert.equal(r.ok,false);
  assert.equal(r.config.enabled,false);
 }
});

test('feature flags default off unless explicitly enabled',()=>{
 const r=check({...base,googleEnabled:'true',serverFocusEnabled:1,autoInitializeWallet:null});
 assert.equal(r.ok,true);
 assert.equal(r.config.googleEnabled,false);
 assert.equal(r.config.serverFocusEnabled,false);
 assert.equal(r.config.autoInitializeWallet,false);
});
