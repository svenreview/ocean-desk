import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWalletBootstrap} from '../od-wallet-bootstrap.mjs';

const uid='00000000-0000-4000-8000-000000000001';
const endpoint='https://staging.supabase.co/functions/v1/od-wallet-initialize';
function helper(request,getAccessToken=async()=> 'jwt'){
 return createWalletBootstrap({getAccessToken,request,endpoint,publishableKey:'sb_publishable_test'});
}

test('two simultaneous account boots make exactly one request and return preserved balances',async()=>{
 let count=0;
 const ensure=helper(async(url,opts)=>{
   count++;
   assert.equal(url,endpoint);
   assert.equal(opts.body,'{}');
   assert.equal(opts.headers.authorization,'Bearer jwt');
   await new Promise(resolve=>setTimeout(resolve,10));
   return {ok:true,json:async()=>({user_id:uid,pieces:9,tickets:4})};
 });
 const [one,two]=await Promise.all([ensure(uid),ensure(uid)]);
 assert.deepEqual(one,{ok:true,wallet:{pieces:9,tickets:4}});
 assert.deepEqual(two,one);
 assert.equal(count,1);
});

test('bootstrap never sends locally owned puzzle, ticket or gallery data',async()=>{
 const ensure=helper(async(_url,options)=>{
   assert.deepEqual(Object.keys(JSON.parse(options.body)),[]);
   assert.equal(options.headers.apikey,'sb_publishable_test');
   return {ok:true,json:async()=>({user_id:uid,pieces:0,tickets:0})};
 });
 assert.equal((await ensure(uid)).ok,true);
});

test('missing token does not call server',async()=>{
 let called=false;
 const ensure=helper(async()=>{called=true;throw Error('unexpected')},async()=>null);
 assert.deepEqual(await ensure(uid),{ok:false,error:'login_required'});
 assert.equal(called,false);
});

test('server error, account mismatch and invalid wallet are rejected',async()=>{
 for(const response of [
   {ok:false,status:503},
   {ok:true,json:async()=>({user_id:'someone-else',pieces:0,tickets:0})},
   {ok:true,json:async()=>({user_id:uid,pieces:-1,tickets:'7'})}
 ]){
   const ensure=helper(async()=>response);
   assert.equal((await ensure(uid)).ok,false);
 }
});

test('network errors are reported and retry is possible',async()=>{
 let count=0;
 const ensure=helper(async()=>{
   count++;
   if(count===1)throw Error('offline');
   return {ok:true,json:async()=>({user_id:uid,pieces:0,tickets:0})};
 });
 assert.equal((await ensure(uid)).error,'network_unavailable');
 assert.equal((await ensure(uid)).ok,true);
 assert.equal(count,2);
});
