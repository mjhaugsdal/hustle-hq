-- Run as postgres in the SQL editor after creating both accounts administratively.
-- Replace these three values. Never run this file from a browser or public client.
do $$
declare
  owner_email text := 'replace-with-owner-email@example.com';
  member_email text := 'replace-with-member-email@example.com';
  workspace_name text := 'My Side Hustle HQ';
  owner_id uuid;
  member_id uuid;
  workspace_id uuid;
begin
  select id into strict owner_id from auth.users where lower(email) = lower(owner_email);
  select id into strict member_id from auth.users where lower(email) = lower(member_email);
  if member_id = owner_id then
    raise exception 'Owner and member must be different accounts';
  end if;
  if exists (
    select 1 from public.workspace_members where user_id in (owner_id, member_id)
  ) then
    raise exception 'Both accounts must have no existing workspace membership';
  end if;

  insert into public.workspaces (name) values (workspace_name) returning id into workspace_id;
  insert into public.workspace_members (workspace_id, user_id, role)
    values (workspace_id, owner_id, 'owner'), (workspace_id, member_id, 'member');
  raise notice 'Workspace created: %', workspace_id;
end;
$$;
