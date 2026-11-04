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
