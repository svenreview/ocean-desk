-- Ocean Desk staging-only focus history read policy.
begin;
create policy od_focus_attempts_read_own on public.od_focus_attempts for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.od_focus_attempts from anon, authenticated;
grant select on public.od_focus_attempts to authenticated;
commit;
