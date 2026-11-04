// Ocean Desk staging preflight: NO network calls or deployments.
import {validateRuntimeConfig} from '../od-config-validator.mjs';

export const LIVE_PROJECT_REF='gozsvzkqhpmimadtgfie';
export const LIVE_SITE_ORIGIN='https://ocean-desk.vercel.app';

export function inspectStaging({url,publishableKey,origin,googleClientId}){
  const failures=[];
  let projectRef=null,site=null;
  try{
    const u=new URL(url);
    projectRef=u.hostname.endsWith('.supabase.co')?u.hostname.slice(0,-'.supabase.co'.length):null;
  }catch{failures.push('invalid_project_url')}
  try{site=new URL(origin)}catch{failures.push('invalid_site_origin')}
  if(!projectRef||projectRef===LIVE_PROJECT_REF)failures.push('staging_project_required');
  if(site?.origin===LIVE_SITE_ORIGIN)failures.push('production_site_not_allowed');
  if(!googleClientId||!googleClientId.endsWith('.apps.googleusercontent.com'))
    failures.push('google_oauth_client_id_missing');
  const normalized=site?.origin||origin;
  const result=validateRuntimeConfig({
    enabled:true,url,publishableKey,googleEnabled:true,serverFocusEnabled:false,
    autoInitializeWallet:false,allowedOrigins:[normalized]
  },normalized);
  if(!result.ok)failures.push('invalid_public_client_config:'+result.reason);
  return {
    ok:failures.length===0,
    failures,
    summary:{
      stagingProjectValidated:Boolean(projectRef&&projectRef!==LIVE_PROJECT_REF),
      stagingOriginValidated:Boolean(site&&site.origin!==LIVE_SITE_ORIGIN&&result.ok),
      oauthClientIdProvided:Boolean(googleClientId?.endsWith('.apps.googleusercontent.com')),
      secretsExposed:false,
      databaseModified:false,
      oauthVerified:false
    }
  };
}
