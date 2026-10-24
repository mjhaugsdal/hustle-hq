-- Workspaces and memberships are provisioned by a trusted SQL/admin process only.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_id_idx on public.workspace_members(user_id, workspace_id);

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  summary text check (char_length(summary) <= 5000),
  problem text check (char_length(problem) <= 10000),
  target_customer text check (char_length(target_customer) <= 5000),
  solution text check (char_length(solution) <= 10000),
  revenue_model text check (char_length(revenue_model) <= 5000),
  category text check (char_length(btrim(category)) between 1 and 100),
  status text not null default 'inbox'
    check (status in ('inbox', 'researching', 'validating', 'active', 'rejected', 'archived')),
  startup_cost numeric(12,2) check (startup_cost >= 0 and startup_cost < 'Infinity'::numeric),
  currency_code text check (currency_code ~ '^[A-Z]{3}$'),
  weekly_hours numeric(6,2) check (weekly_hours >= 0 and weekly_hours < 'Infinity'::numeric),
  is_shortlisted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check ((status = 'archived') = (archived_at is not null)),
  check (startup_cost is null or currency_code is not null)
);
create index ideas_workspace_status_idx on public.ideas(workspace_id, status);
create index ideas_workspace_updated_at_idx on public.ideas(workspace_id, updated_at desc);

create table public.research_sources (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  url text check (char_length(url) <= 2048 and url ~* '^https?://[^[:space:]/?#]+[^[:space:]]*$'),
  source_type text check (char_length(btrim(source_type)) between 1 and 100),
  finding text check (char_length(finding) <= 10000),
  evidence_type text not null default 'evidence' check (evidence_type in ('evidence', 'assumption', 'conclusion')),
  confidence text not null default 'low' check (confidence in ('low', 'medium', 'high')),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  retrieved_at timestamptz
);
create index research_sources_idea_id_idx on public.research_sources(idea_id);

create table public.idea_scores (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas(id) on delete cascade,
  criterion text not null check (criterion in ('demand', 'monetization', 'differentiation', 'speed', 'cost', 'fit')),
  score smallint not null check (score between 1 and 5),
  rationale text check (char_length(rationale) <= 5000),
  scored_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  unique (idea_id, criterion, scored_by)
);

create table public.experiments (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  hypothesis text not null check (char_length(btrim(hypothesis)) between 1 and 10000),
  method text check (char_length(method) <= 10000),
  success_metric text check (char_length(success_metric) <= 5000),
  result text check (char_length(result) <= 10000),
  outcome text not null default 'pending' check (outcome in ('pending', 'successful', 'unsuccessful', 'inconclusive')),
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (completed_at is null or (started_at is not null and completed_at >= started_at)),
  check (outcome = 'pending' or nullif(btrim(result), '') is not null)
);
create index experiments_idea_id_idx on public.experiments(idea_id);

create table public.idea_notes (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas(id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  body text not null check (char_length(btrim(body)) between 1 and 10000),
  created_at timestamptz not null default now()
);
create index idea_notes_idea_id_created_at_idx on public.idea_notes(idea_id, created_at);

-- Non-exposed, narrowly scoped helpers avoid recursive membership RLS.
create function private.is_workspace_member(p_workspace_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace_id and m.user_id = (select auth.uid())
  );
$$;

create function private.is_idea_member(p_idea_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.ideas i
    where i.id = p_idea_id and private.is_workspace_member(i.workspace_id)
  );
$$;
revoke all on function private.is_workspace_member(uuid) from public, anon;
revoke all on function private.is_idea_member(uuid) from public, anon;
grant execute on function private.is_workspace_member(uuid) to authenticated;
grant execute on function private.is_idea_member(uuid) to authenticated;

-- Provenance and parent identifiers cannot be rewritten, even by another member.
create function private.protect_provenance()
returns trigger language plpgsql set search_path = ''
as $$
declare
  key text;
begin
  foreach key in array TG_ARGV loop
    if to_jsonb(new) -> key is distinct from to_jsonb(old) -> key then
      raise exception 'Immutable field: %', key using errcode = '23514';
    end if;
  end loop;
  return new;
end;
$$;

create function private.touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

create function private.stamp_created_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.created_at := statement_timestamp();
  return new;
end;
$$;

create function private.sync_archive_timestamp()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.status = 'archived' then
    if TG_OP = 'INSERT' then
      new.archived_at := statement_timestamp();
    elsif old.status <> 'archived' then
      new.archived_at := statement_timestamp();
    else
      new.archived_at := old.archived_at;
    end if;
  else
    new.archived_at := null;
  end if;
  return new;
end;
$$;
revoke all on function private.protect_provenance() from public, anon, authenticated;
revoke all on function private.touch_updated_at() from public, anon, authenticated;
revoke all on function private.stamp_created_at() from public, anon, authenticated;
revoke all on function private.sync_archive_timestamp() from public, anon, authenticated;

create trigger workspaces_updated_at before insert or update on public.workspaces
for each row execute function private.touch_updated_at();
create trigger ideas_updated_at before insert or update on public.ideas
for each row execute function private.touch_updated_at();
create trigger idea_scores_updated_at before insert or update on public.idea_scores
for each row execute function private.touch_updated_at();
create trigger workspaces_created_at before insert on public.workspaces
for each row execute function private.stamp_created_at();
create trigger workspace_members_created_at before insert on public.workspace_members
for each row execute function private.stamp_created_at();
create trigger ideas_created_at before insert on public.ideas
for each row execute function private.stamp_created_at();
create trigger research_sources_created_at before insert on public.research_sources
for each row execute function private.stamp_created_at();
create trigger experiments_created_at before insert on public.experiments
for each row execute function private.stamp_created_at();
create trigger idea_notes_created_at before insert on public.idea_notes
for each row execute function private.stamp_created_at();
create trigger ideas_archive_timestamp before insert or update on public.ideas
for each row execute function private.sync_archive_timestamp();
create trigger ideas_provenance before update on public.ideas
for each row execute function private.protect_provenance('id', 'workspace_id', 'created_by', 'created_at');
create trigger research_sources_provenance before update on public.research_sources
for each row execute function private.protect_provenance('id', 'idea_id', 'created_by', 'created_at');
create trigger idea_scores_provenance before update on public.idea_scores
for each row execute function private.protect_provenance('id', 'idea_id', 'scored_by', 'criterion');
create trigger experiments_provenance before update on public.experiments
for each row execute function private.protect_provenance('id', 'idea_id', 'created_by', 'created_at');
create trigger idea_notes_provenance before update on public.idea_notes
for each row execute function private.protect_provenance('id', 'idea_id', 'author_id', 'created_at');

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.ideas enable row level security;
alter table public.research_sources enable row level security;
alter table public.idea_scores enable row level security;
alter table public.experiments enable row level security;
alter table public.idea_notes enable row level security;

revoke all on public.workspaces, public.workspace_members, public.ideas,
  public.research_sources, public.idea_scores, public.experiments, public.idea_notes
  from anon, authenticated;
grant select on public.workspaces, public.workspace_members to authenticated;
grant select, insert, update, delete on public.ideas, public.research_sources,
  public.idea_scores, public.experiments, public.idea_notes to authenticated;
grant all on public.workspaces, public.workspace_members, public.ideas,
  public.research_sources, public.idea_scores, public.experiments, public.idea_notes to service_role;

create policy workspaces_member_read on public.workspaces for select to authenticated
using (private.is_workspace_member(id));
create policy workspace_members_member_read on public.workspace_members for select to authenticated
using (private.is_workspace_member(workspace_id));

create policy ideas_member_read on public.ideas for select to authenticated
using (private.is_workspace_member(workspace_id));
create policy ideas_member_insert on public.ideas for insert to authenticated
with check (private.is_workspace_member(workspace_id) and created_by = (select auth.uid()));
create policy ideas_member_update on public.ideas for update to authenticated
using (private.is_workspace_member(workspace_id))
with check (private.is_workspace_member(workspace_id));
create policy ideas_member_delete on public.ideas for delete to authenticated
using (private.is_workspace_member(workspace_id));

create policy research_sources_member_read on public.research_sources for select to authenticated
using (private.is_idea_member(idea_id));
create policy research_sources_member_insert on public.research_sources for insert to authenticated
with check (private.is_idea_member(idea_id) and created_by = (select auth.uid()));
create policy research_sources_member_update on public.research_sources for update to authenticated
using (private.is_idea_member(idea_id)) with check (private.is_idea_member(idea_id));
create policy research_sources_member_delete on public.research_sources for delete to authenticated
using (private.is_idea_member(idea_id));

create policy idea_scores_member_read on public.idea_scores for select to authenticated
using (private.is_idea_member(idea_id));
create policy idea_scores_scorer_insert on public.idea_scores for insert to authenticated
with check (private.is_idea_member(idea_id) and scored_by = (select auth.uid()));
create policy idea_scores_scorer_update on public.idea_scores for update to authenticated
using (private.is_idea_member(idea_id) and scored_by = (select auth.uid()))
with check (private.is_idea_member(idea_id) and scored_by = (select auth.uid()));
create policy idea_scores_scorer_delete on public.idea_scores for delete to authenticated
using (private.is_idea_member(idea_id) and scored_by = (select auth.uid()));

create policy experiments_member_read on public.experiments for select to authenticated
using (private.is_idea_member(idea_id));
create policy experiments_member_insert on public.experiments for insert to authenticated
with check (private.is_idea_member(idea_id) and created_by = (select auth.uid()));
create policy experiments_member_update on public.experiments for update to authenticated
using (private.is_idea_member(idea_id)) with check (private.is_idea_member(idea_id));
create policy experiments_member_delete on public.experiments for delete to authenticated
using (private.is_idea_member(idea_id));

create policy idea_notes_member_read on public.idea_notes for select to authenticated
using (private.is_idea_member(idea_id));
create policy idea_notes_member_insert on public.idea_notes for insert to authenticated
with check (private.is_idea_member(idea_id) and author_id = (select auth.uid()));
create policy idea_notes_member_update on public.idea_notes for update to authenticated
using (private.is_idea_member(idea_id)) with check (private.is_idea_member(idea_id));
create policy idea_notes_member_delete on public.idea_notes for delete to authenticated
using (private.is_idea_member(idea_id));

-- Invoker security deliberately retains table RLS; errors roll back both writes.
create function public.record_decision(p_idea_id uuid, p_decision text, p_reason text)
returns void language plpgsql security invoker set search_path = ''
as $$
declare
  next_status text;
begin
  if auth.uid() is null or not private.is_idea_member(p_idea_id) then
    raise exception 'Workspace membership required' using errcode = '42501';
  end if;
  next_status := case p_decision
    when 'pursue' then 'active'
    when 'investigate' then 'researching'
    when 'archive' then 'archived'
    else null end;
  if next_status is null then
    raise exception 'Invalid decision' using errcode = '22023';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 1 and 5000 then
    raise exception 'Decision reason must contain 1 to 5000 characters' using errcode = '22023';
  end if;
  update public.ideas set status = next_status where id = p_idea_id;
  if not found then
    raise exception 'Idea not accessible' using errcode = '42501';
  end if;
  insert into public.idea_notes (idea_id, author_id, body)
    values (p_idea_id, auth.uid(), 'Decision: ' || p_decision || E'\n' || btrim(p_reason));
end;
$$;
revoke all on function public.record_decision(uuid, text, text) from public, anon, service_role;
grant execute on function public.record_decision(uuid, text, text) to authenticated;
