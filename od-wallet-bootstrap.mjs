// Single-flight, server-verified first-login wallet bootstrap.
// Deliberately never accepts pieces, tickets or inventory from the browser.
export function createWalletBootstrap({getAccessToken,request,endpoint,publishableKey}){
  const pending=new Map();
  return async function ensureWallet(userId){
    if(typeof userId!=='string'||!userId)return {ok:false,error:'invalid_user'};
    if(pending.has(userId))return pending.get(userId);
    const job=(async()=>{
      try{
        const token=await getAccessToken();
        if(!token)return {ok:false,error:'login_required'};
        const response=await request(endpoint,{
          method:'POST',
          headers:{authorization:'Bearer '+token,apikey:publishableKey,'content-type':'application/json'},
          body:'{}'
        });
        if(!response.ok)return {ok:false,error:'wallet_initialize_unavailable',status:response.status};
        const data=await response.json();
        if(data?.user_id!==userId)return {ok:false,error:'account_mismatch'};
        if(!Number.isInteger(data.pieces)||!Number.isInteger(data.tickets))return {ok:false,error:'invalid_server_wallet'};
        return {ok:true,wallet:{pieces:data.pieces,tickets:data.tickets}};
      }catch{return {ok:false,error:'network_unavailable'}}
    })();
    pending.set(userId,job);
    try{return await job}finally{if(pending.get(userId)===job)pending.delete(userId)}
  };
}
