// Static deployment config validation. Never place secrets in the browser.
const validOrigin=value=>{
 try{
  const url=new URL(value);
  return url.protocol==='https:' && url.pathname==='/' && !url.search && !url.hash &&
    !url.username && !url.password && /^[a-z0-9-]+\.supabase\.co$/i.test(url.hostname);
 }catch{return false}
};
export function validateRuntimeConfig(raw,locationOrigin){
 const off={enabled:false,googleEnabled:false,serverFocusEnabled:false,autoInitializeWallet:false};
 if(!raw?.enabled)return {ok:true,config:off,reason:'disabled'};
 if(!validOrigin(raw.url))return {ok:false,config:off,reason:'invalid_supabase_url'};
 if(typeof raw.publishableKey!=='string'||
    !/^sb_publishable_[A-Za-z0-9_-]{4,}$/.test(raw.publishableKey))
   return {ok:false,config:off,reason:'invalid_publishable_key'};
 let pageOrigin;
 try{pageOrigin=new URL(locationOrigin)}catch{return {ok:false,config:off,reason:'invalid_page_origin'}}
 const local=pageOrigin.hostname==='localhost'||pageOrigin.hostname==='127.0.0.1';
 if(pageOrigin.protocol!=='https:' && !(local && pageOrigin.protocol==='http:'))
   return {ok:false,config:off,reason:'insecure_page_origin'};
 const expected=Array.isArray(raw.allowedOrigins)?raw.allowedOrigins:[];
 if(!expected.includes(pageOrigin.origin))
   return {ok:false,config:off,reason:'origin_not_allowlisted'};
 return {
   ok:true,
   config:{
     enabled:true,url:raw.url,publishableKey:raw.publishableKey,
     googleEnabled:raw.googleEnabled===true,
     serverFocusEnabled:raw.serverFocusEnabled===true,
     autoInitializeWallet:raw.autoInitializeWallet===true
   },
   reason:'staging_configured'
 };
}
