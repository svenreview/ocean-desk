// Ocean Desk 2.0 — server-only travel draw endpoint, staging draft.
// Deploy ONLY after migrations and access-control tests pass.
// Requires: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
// OD_ALLOWED_ORIGINS (comma-separated exact https origins).
// No service-role key or direct wallet mutation is ever sent to the browser.
const json = (status: number, payload: unknown, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {"content-type":"application/json; charset=utf-8",...headers}
  });

function cors(origin: string | null, allowed: Set<string>) {
  const valid = origin && allowed.has(origin);
  return valid
    ? {"access-control-allow-origin":origin!,"vary":"Origin",
       "access-control-allow-headers":"authorization,content-type",
       "access-control-allow-methods":"POST,OPTIONS"}
    : {};
}

Deno.serve(async (req: Request) => {
  const allowed = new Set((Deno.env.get("OD_ALLOWED_ORIGINS") || "")
    .split(",").map(x=>x.trim()).filter(Boolean));
  const origin = req.headers.get("origin");
  const headers = cors(origin, allowed);

  if (req.method === "OPTIONS") return new Response(null, {status:origin && allowed.has(origin)?204:403, headers});
  if (req.method !== "POST") return json(405, {error:"method_not_allowed"}, headers);
  // Reject browser requests from unexpected origins. Nonbrowser scripts still
  // require a real Supabase JWT; an Origin header is not authentication.
  if (origin && !allowed.has(origin)) return json(403, {error:"origin_not_allowed"}, headers);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !secret) return json(503, {error:"server_not_configured"}, headers);

  const bearer = req.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+$/i.test(bearer)) return json(401, {error:"missing_auth"}, headers);
  const jwt = bearer.replace(/^Bearer\s+/i,"").trim();

  let input: unknown;
  try {
    if (Number(req.headers.get("content-length")||0) > 2048) return json(413,{error:"too_large"},headers);
    input = await req.json();
  } catch { return json(400, {error:"invalid_json"}, headers); }

  if (!input || typeof input !== "object" || Array.isArray(input)) return json(400,{error:"invalid_input"},headers);
  const body = input as Record<string, unknown>;
  const region = body.region_id;
  const requestId = body.request_id;
  if (typeof region !== "string" || !["bali","jeju","santorini"].includes(region) ||
      typeof requestId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    return json(400,{error:"invalid_region_or_request_id"},headers);
  }

  // Do NOT trust user_id from JSON. Validate the token with Supabase Auth.
  let authResp: Response;
  try {
    authResp = await fetch(url + "/auth/v1/user", {
      headers: {"apikey":anonKey, "authorization":"Bearer "+jwt},
    });
  } catch { return json(503,{error:"auth_unavailable"},headers); }
  if (!authResp.ok) return json(401,{error:"invalid_session"},headers);

  const user = await authResp.json().catch(()=>null);
  if (!user?.id || typeof user.id !== "string") return json(401,{error:"invalid_user"},headers);

  // Service role accesses a tightly scoped DB RPC that holds wallet row lock
  // and returns an idempotent result for repeated request IDs.
  let rpc: Response;
  try {
    rpc = await fetch(url + "/rest/v1/rpc/od_server_travel_draw", {
      method:"POST",
      headers:{"apikey":secret,"authorization":"Bearer "+secret,"content-type":"application/json"},
      body:JSON.stringify({p_user_id:user.id,p_region_id:region,p_request_id:requestId})
    });
  } catch { return json(503,{error:"draw_unavailable"},headers); }
  if (!rpc.ok) {
    const err = await rpc.json().catch(()=>({}));
    const known = new Set(["invalid_arguments","wallet_not_initialized","request_id_region_mismatch",
      "insufficient_tickets","invalid_region","region_collection_complete"]);
    const message = typeof err?.message === "string" && known.has(err.message)
      ? err.message : "draw_failed";
    const status = message==="insufficient_tickets"||message==="region_collection_complete"?409
      : message==="wallet_not_initialized"?409
      : message==="invalid_region"||message==="invalid_arguments"||message==="request_id_region_mismatch"?400:503;
    return json(status,{error:message},headers);
  }
  return json(200,await rpc.json(),headers);
});
