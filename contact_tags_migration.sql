-- ============================================================
-- Tags por workspace + vínculo com contatos
-- Rode no SQL Editor do Supabase
-- ============================================================

create table if not exists public.workspace_tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  color text not null default '#6366f1',
  created_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create index if not exists workspace_tags_ws on public.workspace_tags(workspace_id);

alter table public.workspace_tags enable row level security;

drop policy if exists "wt_select" on public.workspace_tags;
create policy "wt_select" on public.workspace_tags for select
  using (public.is_ws_member(workspace_id));
drop policy if exists "wt_insert" on public.workspace_tags;
create policy "wt_insert" on public.workspace_tags for insert
  with check (public.is_ws_member(workspace_id));
drop policy if exists "wt_update" on public.workspace_tags;
create policy "wt_update" on public.workspace_tags for update
  using (public.is_ws_member(workspace_id));
drop policy if exists "wt_delete" on public.workspace_tags;
create policy "wt_delete" on public.workspace_tags for delete
  using (public.is_ws_member(workspace_id));

create table if not exists public.contact_tags (
  contact_id uuid not null references public.contacts(id) on delete cascade,
  tag_id uuid not null references public.workspace_tags(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (contact_id, tag_id)
);

create index if not exists contact_tags_tag on public.contact_tags(tag_id);
create index if not exists contact_tags_ws on public.contact_tags(workspace_id);

alter table public.contact_tags enable row level security;

drop policy if exists "ct_select" on public.contact_tags;
create policy "ct_select" on public.contact_tags for select
  using (public.is_ws_member(workspace_id));
drop policy if exists "ct_insert" on public.contact_tags;
create policy "ct_insert" on public.contact_tags for insert
  with check (public.is_ws_member(workspace_id));
drop policy if exists "ct_delete" on public.contact_tags;
create policy "ct_delete" on public.contact_tags for delete
  using (public.is_ws_member(workspace_id));
