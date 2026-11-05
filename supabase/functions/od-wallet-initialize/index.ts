// Ocean Desk 2.0 authenticated wallet initialization (staging draft).
// Deploy only after staging migration and auth/CORS tests.
const asJson=(status:number,body:unknown,headers:Record<string,string>={})=>
  new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json",...headers}});
Deno.serve(async req=>{
  const origin=req.headers.get("origin");
  const allowed=new Set((Deno.env.get("OD_ALLOWED_ORIGINS")||"").split(",").map(s=>s.trim()).filter(Boolean));
  const cors:Record<string,string>=origin&&allowed.has(origin)?{
    "access-control-allow-origin":origin,"vary":"Origin",
    "access-control-allow-methods":"POST,OPTIONS",
    "access-control-allow-headers":"authorization,content-type,apikey"
  }:{};
  if(req.method==="OPTIONS")return new Response(null,{status:origin&&allowed.has(origin)?204:403,headers:cors});
  if(req.method!=="POST")return asJson(405,{error:"method_not_allowed"},cors);
  if(origin&&!allowed.has(origin))return asJson(403,{error:"origin_not_allowed"},cors);
  const url=Deno.env.get("SUPABASE_URL");
  const publishable=Deno.env.get("SUPABASE_ANON_KEY");
  const secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!publishable||!secret)return asJson(503,{error:"not_configured"},cors);
  const header=req.headers.get("authorization")||"";
  if(!/^Bearer\s+\S+$/i.test(header))return asJson(401,{error:"missing_auth"},cors);
  const token=header.replace(/^Bearer\s+/i,"").trim();
  let userResponse:Response;
  try {
    userResponse=await fetch(url+"/auth/v1/user",{
      headers:{"apikey":publishable,"authorization":"Bearer "+token}
    });
  } catch {return asJson(503,{error:"auth_unavailable"},cors)}
  if(!userResponse.ok)return asJson(401,{error:"invalid_session"},cors);
  const user=await userResponse.json().catch(()=>null);
  if(typeof user?.id!=="string")return asJson(401,{error:"invalid_user"},cors);
  let rpcResponse:Response;
  try {
    rpcResponse=await fetch(url+"/rest/v1/rpc/od_server_initialize_wallet",{
      method:"POST",
      headers:{"apikey":secret,"authorization":"Bearer "+secret,"content-type":"application/json"},
      body:JSON.stringify({p_user_id:user.id})
    });
  } catch {return asJson(503,{error:"wallet_unavailable"},cors)}
  if(!rpcResponse.ok)return asJson(503,{error:"wallet_initialization_failed"},cors);
  return asJson(200,await rpcResponse.json(),cors);
});
