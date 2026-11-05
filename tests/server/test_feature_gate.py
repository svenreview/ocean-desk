"""Verify reversible RPC feature gate in disposable CI PostgreSQL only."""
import json
import os
import sys
from pathlib import Path
from urllib.parse import urlparse
import psycopg

dsn=os.environ["OD_TEST_DATABASE_URL"]
assert urlparse(dsn).hostname in ("127.0.0.1","localhost"), "Refusing nonlocal DB"
phase=sys.argv[1]
assert phase in ("before","stopped","resumed")
snapshot_file=Path("tests/server/.feature-gate-snapshot.json")
functions=[
 "public.od_server_travel_draw(uuid,text,uuid)",
 "public.od_server_initialize_wallet(uuid)",
 "public.od_server_claim_verified_puzzle(uuid,uuid,text)",
 "public.od_server_focus_start(uuid,uuid,integer)",
 "public.od_server_focus_finish(uuid,uuid)",
 "public.od_server_focus_cancel(uuid,uuid)",
 "public.od_server_focus_status(uuid)",
]
tables=[
 "rooms","seats","room_instances","instance_seats",
 "focus_sessions","personal_focus_sessions",
 "od_regions","od_environments","od_wallets",
 "od_owned_environments","od_reward_claims","od_travel_draws",
 "od_verified_focus","od_verified_ad_events","od_focus_attempts"
]
with psycopg.connect(dsn) as conn:
    state={}
    for table in tables:
        state[table]=conn.execute("SELECT COUNT(*) FROM public."+table).fetchone()[0]
        rls=conn.execute("SELECT relrowsecurity FROM pg_class WHERE oid=%s::regclass",("public."+table,)).fetchone()[0]
        assert rls, "RLS disabled: "+table
    for signature in functions:
        for role in ("anon","authenticated"):
            assert not conn.execute("SELECT has_function_privilege(%s,%s,'EXECUTE')",(role,signature)).fetchone()[0],(phase,role,signature)
        permitted=conn.execute("SELECT has_function_privilege('service_role',%s,'EXECUTE')",(signature,)).fetchone()[0]
        assert permitted == (phase!="stopped"),(phase,signature,permitted)
    for table in ("rooms","seats","room_instances","instance_seats","focus_sessions","personal_focus_sessions"):
        assert conn.execute("SELECT COUNT(*) FROM pg_policies WHERE schemaname='public' AND tablename=%s",(table,)).fetchone()[0]>0
    if phase=="before":
        snapshot_file.write_text(json.dumps(state,sort_keys=True),encoding="utf-8")
    else:
        assert snapshot_file.is_file(),"Missing baseline for safety check"
        baseline=json.loads(snapshot_file.read_text(encoding="utf-8"))
        assert state==baseline,(phase,state,baseline)
print("PASS isolated feature gate phase:",phase,"table counts/RLS stable; browser roles denied")
