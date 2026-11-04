// Ocean Desk 2.0 — server-clock focus start/finish endpoint (STAGING DRAFT).
// Requires docs/ocean-server-focus-session-draft.sql and verified Supabase Auth JWT.
// NEVER trust browser elapsed seconds, start timestamps, or user_id as verification.
// Never award puzzles here; verified advertising evidence is still required.
const json=(status:number,payload:unknown,extra:Record<string,string>={})=>
  new Response(JSON.stringify(payload),{status,headers:{"content-type":"application/json; charset=utf-8",...extra}});
Deno.serve(async (req:Request)=>{
  const origin=req.headers.get("origin");
  const allowed=new Set((Deno.env.get("OD_ALLOWED_ORIGINS")||"").split(",").map(x=>x.trim()).filter(Boolean));
  const cors:Record<string,string>=origin&&allowed.has(origin)?{
    "access-control-allow-origin":origin,"vary":"Origin",
    "access-control-allow-methods":"POST,OPTIONS",
    "access-control-allow-headers":"authorization,apikey,content-type"
  }:{};
  if(req.method==="OPTIONS")return new Response(null,{status:origin&&allowed.has(origin)?204:403,headers:cors});
  if(req.method!=="POST")return json(405,{error:"method_not_allowed"},cors);
  if(origin&&!allowed.has(origin))return json(403,{error:"origin_not_allowed"},cors);
  const url=Deno.env.get("SUPABASE_URL");
  const pub=Deno.env.get("SUPABASE_ANON_KEY");
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!pub||!service)return json(503,{error:"server_not_configured"},cors);
  const bearer=req.headers.get("authorization")||"";
  if(!/^Bearer\s+\S+$/i.test(bearer))return json(401,{error:"missing_auth"},cors);
  let body:Record<string,unknown>;
  try {
    if(Number(req.headers.get("content-length")||0)>2048) return json(413,{error:"too_large"},cors);
    const data=await req.json();
    if(!data||typeof data!=="object"||Array.isArray(data))throw Error("invalid");
    body=data as Record<string,unknown>;
  } catch {return json(400,{error:"invalid_json"},cors)}
  const action=body.action;
  const isUUID=(x:unknown)=>typeof x==="string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
  if(action!=="start"&&action!=="finish"&&action!=="cancel")return json(400,{error:"invalid_action"},cors);
  if(action==="start"&&(!isUUID(body.request_id)||![25,50].includes(body.minutes as number)))
    return json(400,{error:"invalid_start"},cors);
  if((action==="finish"||action==="cancel")&&!isUUID(body.session_id))return json(400,{error:"invalid_finish"},cors);

  let auth:Response;
  try {
    auth=await fetch(url+"/auth/v1/user",{
      headers:{"apikey":pub,"authorization":bearer}
    });
  } catch {return json(503,{error:"auth_unavailable"},cors)}
  if(!auth.ok)return json(401,{error:"invalid_session"},cors);
  const user=await auth.json().catch(()=>null);
  if(typeof user?.id!=="string"||!isUUID(user.id))return json(401,{error:"invalid_user"},cors);
  const rpc=action==="start"?"od_server_focus_start":action==="cancel"?"od_server_focus_cancel":"od_server_focus_finish";
  const args=action==="start"
   ?{p_user_id:user.id,p_request_id:body.request_id,p_minutes:body.minutes}
   :{p_user_id:user.id,p_session_id:body.session_id};
  let result:Response;
  try {
    result=await fetch(url+"/rest/v1/rpc/"+rpc,{
      method:"POST",
      headers:{"apikey":service,"authorization":"Bearer "+service,"content-type":"application/json"},
      body:JSON.stringify(args)
    });
  } catch {return json(503,{error:"focus_unavailable"},cors)}
  if(!result.ok){
    const error=await result.json().catch(()=>({}));
    const expected=new Set(["invalid_focus_request","focus_request_id_mismatch",
      "focus_already_active","focus_session_not_found","focus_session_expired","focus_too_early"]);
    const code=typeof error?.message==="string"&&expected.has(error.message)
      ?error.message:"focus_operation_failed";
    const status=code==="focus_already_active"||code==="focus_too_early"||code==="focus_session_expired"
      ?409:code==="focus_operation_failed"?503:400;
    return json(status,{error:code},cors);
  }
  return json(200,await result.json(),cors);
});
