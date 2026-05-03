-- ============================================================
-- DarkFunnel — Sprint CRM 1.0 — Pipeline (deals + stages)
-- Rode no SQL Editor do Supabase
-- ============================================================

create table if not exists public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  color text not null default '#6366f1',
  position int not null default 0,
  is_won boolean not null default false,
  is_lost boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.pipeline_stages
  add column if not exists color text not null default '#6366f1',
  add column if not exists position int not null default 0,
  add column if not exists is_won boolean not null default false,
  add column if not exists is_lost boolean not null default false,
  add column if not exists created_at timestamptz not null default now();

create index if not exists pipeline_stages_ws_pos on public.pipeline_stages(workspace_id, position);

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  stage_id uuid not null references public.pipeline_stages(id) on delete restrict,
  contact_id uuid references public.contacts(id) on delete set null,
  title text not null,
  value_cents bigint not null default 0,
  currency text not null default 'BRL',
  position int not null default 0,
  assigned_to uuid references auth.users(id) on delete set null,
  notes text,
  expected_close_date date,
  status text not null default 'open' check (status in ('open','won','lost')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.deals
  add column if not exists value_cents bigint not null default 0,
  add column if not exists currency text not null default 'BRL',
  add column if not exists position int not null default 0,
  add column if not exists assigned_to uuid references auth.users(id) on delete set null,
  add column if not exists notes text,
  add column if not exists expected_close_date date,
  add column if not exists status text not null default 'open',
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz;

create index if not exists deals_ws_stage on public.deals(workspace_id, stage_id, position) where deleted_at is null;

-- updated_at trigger
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists deals_set_updated_at on public.deals;
create trigger deals_set_updated_at before update on public.deals
for each row execute function public.tg_set_updated_at();

-- ============== RLS ==============
alter table public.pipeline_stages enable row level security;
alter table public.deals enable row level security;

-- assumindo função public.is_workspace_member(uuid) já existente das migrations anteriores
-- senão, fallback baseado em workspace_members
create or replace function public.is_ws_member(_ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = _ws and user_id = auth.uid()
  );
$$;

drop policy if exists "stages_select" on public.pipeline_stages;
create policy "stages_select" on public.pipeline_stages for select
  using (public.is_ws_member(workspace_id));
drop policy if exists "stages_insert" on public.pipeline_stages;
create policy "stages_insert" on public.pipeline_stages for insert
  with check (public.is_ws_member(workspace_id));
drop policy if exists "stages_update" on public.pipeline_stages;
create policy "stages_update" on public.pipeline_stages for update
  using (public.is_ws_member(workspace_id));
drop policy if exists "stages_delete" on public.pipeline_stages;
create policy "stages_delete" on public.pipeline_stages for delete
  using (public.is_ws_member(workspace_id));

drop policy if exists "deals_select" on public.deals;
create policy "deals_select" on public.deals for select
  using (public.is_ws_member(workspace_id));
drop policy if exists "deals_insert" on public.deals;
create policy "deals_insert" on public.deals for insert
  with check (public.is_ws_member(workspace_id));
drop policy if exists "deals_update" on public.deals;
create policy "deals_update" on public.deals for update
  using (public.is_ws_member(workspace_id));
drop policy if exists "deals_delete" on public.deals;
create policy "deals_delete" on public.deals for delete
  using (public.is_ws_member(workspace_id));

-- ============== Seed default stages para workspaces existentes ==============
insert into public.pipeline_stages (workspace_id, name, color, position, is_won, is_lost)
select w.id, s.name, s.color, s.position, s.is_won, s.is_lost
from public.workspaces w
cross join (values
  ('Lead',         '#94a3b8', 0, false, false),
  ('Qualificado',  '#6366f1', 1, false, false),
  ('Proposta',     '#f59e0b', 2, false, false),
  ('Negociação',   '#ec4899', 3, false, false),
  ('Ganho',        '#10b981', 4, true,  false),
  ('Perdido',      '#ef4444', 5, false, true)
) as s(name, color, position, is_won, is_lost)
where not exists (
  select 1 from public.pipeline_stages ps where ps.workspace_id = w.id
);
