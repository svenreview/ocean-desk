import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAuthEpoch,googleRedirectUrl,startGoogleSignIn} from '../od-auth-flow.mjs';

test('Google sign-in uses OAuth provider and strips query/fragment from return URI',async()=>{
 let called=null;
 const auth={signInWithOAuth:async args=>{called=args;return {error:null}}};
 const location={origin:'https://preview.example.com',pathname:'/focus/',search:'?token=private',hash:'#session'};
 const result=await startGoogleSignIn(auth,location);
 assert.equal(result.redirectTo,'https://preview.example.com/focus/');
 assert.deepEqual(called,{provider:'google',options:{redirectTo:'https://preview.example.com/focus/'}});
});
test('reject unusual URL schemes and pass OAuth errors to caller',async()=>{
 assert.throws(()=>googleRedirectUrl({origin:'javascript:alert(1)',pathname:'/'}));
 await assert.rejects(()=>startGoogleSignIn({
  signInWithOAuth:async()=>({error:new Error('provider_disabled')})
 },{origin:'https://preview.example.com',pathname:'/'}),/provider_disabled/);
});
test('stale getUser results cannot overwrite login or logout state',()=>{
 const epoch=createAuthEpoch();
 const old=epoch.next();
 const newest=epoch.next();
 assert.equal(epoch.isCurrent(old),false);
 assert.equal(epoch.isCurrent(newest),true);
 epoch.invalidate();
 assert.equal(epoch.isCurrent(newest),false);
});
