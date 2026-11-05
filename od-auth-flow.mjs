// Browser-independent Google OAuth flow and stale-auth protection.
// No OAuth client secret, service-role token, or user wallet data here.
export function createAuthEpoch(){
  let version=0;
  return {
    next:()=>++version,
    isCurrent:n=>n===version,
    invalidate:()=>++version
  };
}
export function googleRedirectUrl(location){
  const origin=new URL(location.origin);
  if(!['https:','http:'].includes(origin.protocol)||origin.username||origin.password)
    throw new Error('invalid_origin');
  // Keep the current page path, deliberately strip query and URL fragment.
  return new URL(location.pathname || '/',origin).href;
}
export async function startGoogleSignIn(auth,location){
  if(!auth||typeof auth.signInWithOAuth!=='function')throw new Error('missing_oauth_client');
  const redirectTo=googleRedirectUrl(location);
  const {error}=await auth.signInWithOAuth({
    provider:'google',
    options:{redirectTo}
  });
  if(error)throw error;
  return {redirectTo};
}
