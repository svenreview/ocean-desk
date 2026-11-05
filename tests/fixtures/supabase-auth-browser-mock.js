// Browser-only mock of Supabase Auth + read-only queries.
// This fixture is loaded by Playwright after explicitly intercepting the SDK CDN.
// Never include this file in production HTML.
const userById={
  alpha:{id:'00000000-0000-4000-8000-000000000001',email:'alpha@example.test'},
  beta:{id:'00000000-0000-4000-8000-000000000002',email:'beta@example.test'}
};
let active=null;
const listeners=new Set();
const wallets={
  [userById.alpha.id]:{pieces:4,tickets:2},
  [userById.beta.id]:{pieces:8,tickets:7}
};
const spaces={
  [userById.alpha.id]:[{environment_id:'bali-sunset'}],
  [userById.beta.id]:[{environment_id:'jeju-forest'}]
};
const auth={
  async getUser(){return {data:{user:active},error:null}},
  async getSession(){return {data:{session:active?{access_token:'mock-'+active.id}:null},error:null}},
  onAuthStateChange(cb){
    listeners.add(cb);
    return {data:{subscription:{unsubscribe(){listeners.delete(cb)}}}};
  },
  async signInWithOAuth(args){window.__odAuthMock.lastOAuth=args;return {error:null}},
  async signInWithOtp(){return {error:null}},
  async signOut(){active=null;listeners.forEach(fn=>fn('SIGNED_OUT',null));return {error:null}}
};
function from(table){
  let ownerId=null;
  return {
    select(){return this},
    eq(column,value){if(column==='user_id')ownerId=value;return this},
    order(){return this},
    limit(){return Promise.resolve({data:[],error:null})},
    maybeSingle(){return Promise.resolve({data:ownerId===active?.id?(wallets[ownerId]||null):null,error:null})},
    then(resolve,reject){
      let data=[];
      if(ownerId===active?.id && table==='od_owned_environments')data=spaces[ownerId]||[];
      return Promise.resolve({data,error:null}).then(resolve,reject);
    }
  };
}
window.__odAuthMock={
  lastOAuth:null,
  signIn(which){
    active=userById[which]||null;
    listeners.forEach(fn=>fn('SIGNED_IN',active?{user:active}:null));
  },
  switchTo(which){
    active=userById[which]||null;
    listeners.forEach(fn=>fn('TOKEN_REFRESHED',active?{user:active}:null));
  },
  getCurrent(){return active?.id||null},
  users:userById
};
window.__odMockClient={auth,from};
