"""Integration tests against disposable PostgreSQL in GitHub Actions, never production."""
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4
from urllib.parse import urlparse
import os
import psycopg

DSN = os.environ["OD_TEST_DATABASE_URL"]
host = urlparse(DSN).hostname
assert host in {"localhost", "127.0.0.1"}, "Must use disposable localhost database"

def query(statement, params=(), role=None):
    with psycopg.connect(DSN) as conn:
        if role is not None:
            assert role in {"anon","authenticated","service_role"}
            conn.execute("SET ROLE " + role)
        return conn.execute(statement, params).fetchone()

def new_user(tickets):
    uid=uuid4()
    with psycopg.connect(DSN) as conn:
        conn.execute("INSERT INTO auth.users(id) VALUES (%s)",(uid,))
        conn.execute("INSERT INTO public.od_wallets(user_id,tickets) VALUES (%s,%s)",(uid,tickets))
    return uid

def draw(uid, region, request=None):
    return query("SELECT public.od_server_travel_draw(%s,%s,%s)",(uid,region,request or uuid4()),role="service_role")[0]

def balance(uid):
    return query("SELECT tickets FROM public.od_wallets WHERE user_id=%s",(uid,))[0]

def own_count(uid):
    return query("SELECT count(*) FROM public.od_owned_environments WHERE user_id=%s",(uid,))[0]

# Prove the RPC and wallet mutations are not allowed from browser roles.
for role in ("anon","authenticated"):
    assert not query("SELECT has_function_privilege(%s,'public.od_server_travel_draw(uuid,text,uuid)','EXECUTE')",(role,))[0]
    assert not query("SELECT has_table_privilege(%s,'public.od_wallets','UPDATE')",(role,))[0]
    assert not query("SELECT has_table_privilege(%s,'public.od_owned_environments','INSERT')",(role,))[0]
assert query("SELECT has_function_privilege('service_role','public.od_server_travel_draw(uuid,text,uuid)','EXECUTE')")[0]

# The same request is idempotent; only one ticket may be debited.
uid=new_user(2)
req=uuid4()
first=draw(uid,"jeju",req)
again=draw(uid,"jeju",req)
assert first["replayed"] is False and again["replayed"] is True
assert first["environment_id"] == again["environment_id"]
assert balance(uid)==1 and own_count(uid)==1

# Two concurrent requests with only one ticket allow one success.
uid2=new_user(1)
def attempt(_):
    try:
        return ("ok",draw(uid2,"jeju")["environment_id"])
    except psycopg.Error as exc:
        return ("error",str(exc).splitlines()[0])
with ThreadPoolExecutor(max_workers=2) as pool:
    outcomes=list(pool.map(attempt,range(2)))
assert sum(x[0]=="ok" for x in outcomes)==1, outcomes
assert balance(uid2)==0 and own_count(uid2)==1

# Bali café is the default. Only the other two Bali scenes may be won.
uid3=new_user(5)
one=draw(uid3,"bali")
two=draw(uid3,"bali")
assert one["environment_id"]!=two["environment_id"]
assert own_count(uid3)==2 and balance(uid3)==3
try:
    draw(uid3,"bali")
    raise AssertionError("Expected collection-complete exception")
except psycopg.Error as exc:
    assert "region_collection_complete" in str(exc)
assert balance(uid3)==3

# A request UUID cannot be replayed against a different region.
uid4=new_user(2)
request=uuid4()
draw(uid4,"jeju",request)
try:
    draw(uid4,"bali",request)
    raise AssertionError("Expected request_id_region_mismatch")
except psycopg.Error as exc:
    assert "request_id_region_mismatch" in str(exc)
assert balance(uid4)==1
try:
    draw(uid4,"unknown")
    raise AssertionError("Expected invalid_region")
except psycopg.Error as exc:
    assert "invalid_region" in str(exc)
assert balance(uid4)==1

print("PASS ACL, idempotent retries, parallel draw, collection complete, no duplicate awards, validation")


# RLS: a logged-in account sees only its own wallet and collection.
# The JWT claim in this disposable test is simulated via a connection setting;
# it is not a substitute for end-to-end Supabase Auth integration.
def visible_rows(statement, acting_uid):
    with psycopg.connect(DSN) as conn:
        conn.execute("SET ROLE authenticated")
        conn.execute("SELECT set_config('request.jwt.claim.sub', %s, true)", (str(acting_uid),))
        return conn.execute(statement).fetchall()

# The two users already created above own different wallets and scenes.
for acting_uid in (uid, uid2):
    rows=visible_rows("SELECT user_id, tickets FROM public.od_wallets",acting_uid)
    assert len(rows)==1 and rows[0][0]==acting_uid, rows
    scenes=visible_rows("SELECT user_id, environment_id FROM public.od_owned_environments",acting_uid)
    assert scenes and all(row[0]==acting_uid for row in scenes), scenes
    claims=visible_rows("SELECT user_id FROM public.od_reward_claims",acting_uid)
    assert all(row[0]==acting_uid for row in claims), claims
    draws=visible_rows("SELECT user_id FROM public.od_travel_draws",acting_uid)
    assert draws and all(row[0]==acting_uid for row in draws), draws

# A missing JWT subject must yield no user-scoped records.
with psycopg.connect(DSN) as conn:
    conn.execute("SET ROLE authenticated")
    assert conn.execute("SELECT count(*) FROM public.od_wallets").fetchone()[0]==0
    assert conn.execute("SELECT count(*) FROM public.od_owned_environments").fetchone()[0]==0

# Public/anonymous access to account tables is not granted.
for table in ("od_wallets","od_owned_environments","od_reward_claims","od_travel_draws"):
    assert not query("SELECT has_table_privilege('anon', %s, 'SELECT')",("public."+table,))[0]
    assert query("SELECT has_table_privilege('authenticated', %s, 'SELECT')",("public."+table,))[0]

print("PASS RLS: own records visible, other users denied, unauthenticated claim hidden, anon denied")


# Idempotent wallet initialization cannot reset earned tickets or create balances.
new_uid=uuid4()
with psycopg.connect(DSN) as conn:
    conn.execute("INSERT INTO auth.users(id) VALUES (%s)",(new_uid,))
created=query("SELECT public.od_server_initialize_wallet(%s)",(new_uid,),role="service_role")[0]
assert created["pieces"]==0 and created["tickets"]==0
assert balance(new_uid)==0
with psycopg.connect(DSN) as conn:
    conn.execute("UPDATE public.od_wallets SET pieces=7, tickets=3 WHERE user_id=%s",(new_uid,))
reopened=query("SELECT public.od_server_initialize_wallet(%s)",(new_uid,),role="service_role")[0]
assert reopened["pieces"]==7 and reopened["tickets"]==3
assert balance(new_uid)==3
assert not query("SELECT has_function_privilege('anon','public.od_server_initialize_wallet(uuid)','EXECUTE')")[0]
assert not query("SELECT has_function_privilege('authenticated','public.od_server_initialize_wallet(uuid)','EXECUTE')")[0]
assert query("SELECT has_function_privilege('service_role','public.od_server_initialize_wallet(uuid)','EXECUTE')")[0]
try:
    query("SELECT public.od_server_initialize_wallet(%s)",(uuid4(),),role="service_role")
    raise AssertionError("Missing auth.users FK should reject unknown user")
except psycopg.Error as exc:
    assert exc.sqlstate == "23503", str(exc)
print("PASS wallet initialization: idempotent, no reset, ACL and valid user FK")


# Verified puzzle granting requires BOTH independently server-verified receipts.
# Test fixture inserts trusted receipts as postgres superuser; browser roles have no INSERT.
def add_verified_receipts(uid, session_id, event_id, minutes=25, focus=True, ad=True):
    with psycopg.connect(DSN) as conn:
        if focus:
            conn.execute("INSERT INTO public.od_verified_focus(session_id,user_id,planned_minutes) VALUES (%s,%s,%s)",(session_id,uid,minutes))
        if ad:
            conn.execute("INSERT INTO public.od_verified_ad_events(event_id,session_id,user_id,provider) VALUES (%s,%s,%s,'staging-test')",(event_id,session_id,uid))

def claim(uid, session, event):
    return query("SELECT public.od_server_claim_verified_puzzle(%s,%s,%s)",(uid,session,event),role="service_role")[0]

def pieces(uid):
    return query("SELECT pieces FROM public.od_wallets WHERE user_id=%s",(uid,))[0]

for role in ("anon","authenticated"):
    assert not query("SELECT has_function_privilege(%s,'public.od_server_claim_verified_puzzle(uuid,uuid,text)','EXECUTE')",(role,))[0]
    for table in ("od_verified_focus","od_verified_ad_events"):
        for permission in ("INSERT","UPDATE","SELECT"):
            assert not query("SELECT has_table_privilege(%s,%s,%s)",(role,"public."+table,permission))[0]
assert query("SELECT has_function_privilege('service_role','public.od_server_claim_verified_puzzle(uuid,uuid,text)','EXECUTE')")[0]

reward_uid=new_user(0)
session=uuid4()
event="verified-ad-"+str(uuid4())
try:
    claim(reward_uid,session,event)
    raise AssertionError("must require verified focus")
except psycopg.Error as exc:
    assert "focus_not_verified" in str(exc)
add_verified_receipts(reward_uid,session,event,focus=True,ad=False)
try:
    claim(reward_uid,session,event)
    raise AssertionError("must require verified ad receipt")
except psycopg.Error as exc:
    assert "ad_not_verified" in str(exc)
add_verified_receipts(reward_uid,session,event,focus=False,ad=True)
first_claim=claim(reward_uid,session,event)
replayed_claim=claim(reward_uid,session,event)
assert first_claim["replayed"] is False and replayed_claim["replayed"] is True
assert pieces(reward_uid)==1 and balance(reward_uid)==0

# Same session may not use another ad event.
try:
    claim(reward_uid,session,"another-"+str(uuid4()))
    raise AssertionError("duplicate session must fail")
except psycopg.Error as exc:
    assert "session_already_claimed" in str(exc)
assert pieces(reward_uid)==1

# Another user cannot claim someone else's receipts.
other_user=new_user(0)
try:
    claim(other_user,session,event)
    raise AssertionError("other user receipt must not be usable")
except psycopg.Error as exc:
    assert "focus_not_verified" in str(exc)
assert pieces(other_user)==0

# Rollover: 9 pieces + 1 verified reward -> 0 pieces and 1 ticket.
with psycopg.connect(DSN) as conn:
    conn.execute("UPDATE public.od_wallets SET pieces=9 WHERE user_id=%s",(reward_uid,))
roll_session=uuid4()
roll_event="verified-ad-"+str(uuid4())
add_verified_receipts(reward_uid,roll_session,roll_event)
roll=claim(reward_uid,roll_session,roll_event)
assert roll["ticket_awarded"] is True
assert pieces(reward_uid)==0 and balance(reward_uid)==1
assert claim(reward_uid,roll_session,roll_event)["replayed"] is True
assert balance(reward_uid)==1

# Two simultaneous calls for one verified receipt grant once.
parallel_uid=new_user(0)
parallel_session=uuid4()
parallel_event="verified-ad-"+str(uuid4())
add_verified_receipts(parallel_uid,parallel_session,parallel_event)
with ThreadPoolExecutor(max_workers=2) as pool:
    claimed=list(pool.map(lambda _:claim(parallel_uid,parallel_session,parallel_event),range(2)))
assert sorted(x["replayed"] for x in claimed)==[False,True]
assert pieces(parallel_uid)==1

print("PASS verified reward gating, ACL, replay, cross-user, rollover and concurrency")


# Server focus clock tests: requests cannot claim an early completion.
def focus_start(uid,request,minutes):
    return query("SELECT public.od_server_focus_start(%s,%s,%s)",(uid,request,minutes),role="service_role")[0]

def focus_finish(uid,session):
    return query("SELECT public.od_server_focus_finish(%s,%s)",(uid,session),role="service_role")[0]

for role in ("anon","authenticated"):
    for signature in ("public.od_server_focus_start(uuid,uuid,integer)","public.od_server_focus_finish(uuid,uuid)"):
        assert not query("SELECT has_function_privilege(%s,%s,'EXECUTE')",(role,signature))[0]
    for perm in ("SELECT","INSERT","UPDATE","DELETE"):
        assert not query("SELECT has_table_privilege(%s,'public.od_focus_attempts',%s)",(role,perm))[0]

focus_uid=new_user(0)
request=uuid4()
s25=focus_start(focus_uid,request,25)
assert s25["status"]=="active" and s25["planned_minutes"]==25 and not s25["replayed"]
assert focus_start(focus_uid,request,25)["replayed"] is True
try:
    focus_start(focus_uid,request,50)
    raise AssertionError("request UUID must not change minutes")
except psycopg.Error as exc:
    assert "focus_request_id_mismatch" in str(exc)
try:
    focus_start(focus_uid,uuid4(),50)
    raise AssertionError("one concurrent active focus per user")
except psycopg.Error as exc:
    assert "focus_already_active" in str(exc)
try:
    focus_finish(focus_uid,s25["session_id"])
    raise AssertionError("early finish must fail")
except psycopg.Error as exc:
    assert "focus_too_early" in str(exc)
assert query("SELECT count(*) FROM public.od_verified_focus WHERE user_id=%s",(focus_uid,))[0]==0
try:
    focus_finish(new_user(0),s25["session_id"])
    raise AssertionError("other users must not finish someone's focus")
except psycopg.Error as exc:
    assert "focus_session_not_found" in str(exc)
with psycopg.connect(DSN) as conn:
    # Advance DB clock only in disposable test, never through a public API.
    conn.execute("UPDATE public.od_focus_attempts SET started_at=clock_timestamp()-interval '25 minutes 2 seconds' WHERE id=%s",(s25["session_id"],))
finished=focus_finish(focus_uid,s25["session_id"])
assert finished["verified"] is True and finished["status"]=="completed" and not finished["replayed"]
assert focus_finish(focus_uid,s25["session_id"])["replayed"] is True
assert query("SELECT count(*) FROM public.od_verified_focus WHERE user_id=%s",(focus_uid,))[0]==1
assert pieces(focus_uid)==0, "focus completion alone must not grant a puzzle"

# Expired focus never produces a trusted receipt.
old=focus_start(focus_uid,uuid4(),50)
with psycopg.connect(DSN) as conn:
    conn.execute("UPDATE public.od_focus_attempts SET started_at=clock_timestamp()-interval '2 hours 5 minutes' WHERE id=%s",(old["session_id"],))
expired=focus_finish(focus_uid,old["session_id"])
assert expired["verified"] is False and expired["status"]=="expired"
assert query("SELECT count(*) FROM public.od_verified_focus WHERE session_id=%s",(old["session_id"],))[0]==0

# Same user cannot start two active sessions even if two requests are concurrent.
focus_parallel=new_user(0)
def try_start(_):
    try:
        return ("ok",focus_start(focus_parallel,uuid4(),25))
    except psycopg.Error as exc:
        return ("error",str(exc).splitlines()[0])
with ThreadPoolExecutor(max_workers=2) as pool:
    starts=list(pool.map(try_start,range(2)))
assert sum(result[0]=="ok" for result in starts)==1, starts

# 50 min example: server confirms once its own elapsed clock passes.
fifty_user=new_user(0)
fifty=focus_start(fifty_user,uuid4(),50)
with psycopg.connect(DSN) as conn:
    conn.execute("UPDATE public.od_focus_attempts SET started_at=clock_timestamp()-interval '50 minutes 3 seconds' WHERE id=%s",(fifty["session_id"],))
assert focus_finish(fifty_user,fifty["session_id"])["verified"] is True
assert query("SELECT count(*) FROM public.od_verified_focus WHERE user_id=%s",(fifty_user,))[0]==1
print("PASS focus: server-time only, early block, 25/50, one-active, foreign user, replay and expiry")


# Pause/reset is modelled as an authenticated server-side cancellation.
cancel_user=new_user(0)
cancel_start=focus_start(cancel_user,uuid4(),25)
def focus_cancel(uid,session):
    return query("SELECT public.od_server_focus_cancel(%s,%s)",(uid,session),role="service_role")[0]
for role in ("anon","authenticated"):
    assert not query("SELECT has_function_privilege(%s,'public.od_server_focus_cancel(uuid,uuid)','EXECUTE')",(role,))[0]
try:
    focus_cancel(other_user,cancel_start["session_id"])
    raise AssertionError("cross-account cancellation should fail")
except psycopg.Error as exc:
    assert "focus_session_not_found" in str(exc)
cancelled=focus_cancel(cancel_user,cancel_start["session_id"])
assert cancelled["status"]=="expired" and cancelled["cancelled"] is True
assert focus_cancel(cancel_user,cancel_start["session_id"])["cancelled"] is False
with psycopg.connect(DSN) as conn:
    conn.execute("UPDATE public.od_focus_attempts SET started_at=clock_timestamp()-interval '26 minutes' WHERE id=%s",(cancel_start["session_id"],))
try:
    focus_finish(cancel_user,cancel_start["session_id"])
    raise AssertionError("cancelled focus must not later verify")
except psycopg.Error as exc:
    assert "focus_session_expired" in str(exc)
assert query("SELECT count(*) FROM public.od_verified_focus WHERE session_id=%s",(cancel_start["session_id"],))[0]==0
fresh=focus_start(cancel_user,uuid4(),25)
assert fresh["status"]=="active" and fresh["session_id"]!=cancel_start["session_id"]
print("PASS focus cancel: cross-user denied, idempotent, no receipt, fresh restart")

# Account-history RLS: users can view only their own server focus sessions.
with psycopg.connect(DSN) as conn:
    conn.execute("INSERT INTO auth.users(id) VALUES (%s)",(uuid4(),))
for acting_uid in (focus_uid, fifty_user):
    rows=visible_rows("SELECT user_id, id FROM public.od_focus_attempts",acting_uid)
    assert rows and all(r[0]==acting_uid for r in rows), rows
assert not query("SELECT has_table_privilege('anon','public.od_focus_attempts','SELECT')")[0]
assert query("SELECT has_table_privilege('authenticated','public.od_focus_attempts','SELECT')")[0]
assert not query("SELECT has_table_privilege('authenticated','public.od_focus_attempts','UPDATE')")[0]
print("PASS account focus history isolation and read-only access")
