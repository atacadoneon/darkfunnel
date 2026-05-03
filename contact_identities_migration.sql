-- ============================================================
-- Contact identities — múltiplos canais por contato (lead)
-- whatsapp / instagram / email (extensível)
-- ============================================================

create table if not exists public.contact_identities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  kind text not null check (kind in ('whatsapp','instagram','email')),
  value text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (workspace_id, kind, value)
);

create index if not exists contact_identities_contact on public.contact_identities(contact_id);
create index if not exists contact_identities_ws_kind on public.contact_identities(workspace_id, kind);

alter table public.contact_identities enable row level security;

drop policy if exists "ci_select" on public.contact_identities;
create policy "ci_select" on public.contact_identities for select
  using (public.is_ws_member(workspace_id));
drop policy if exists "ci_insert" on public.contact_identities;
create policy "ci_insert" on public.contact_identities for insert
  with check (public.is_ws_member(workspace_id));
drop policy if exists "ci_update" on public.contact_identities;
create policy "ci_update" on public.contact_identities for update
  using (public.is_ws_member(workspace_id));
drop policy if exists "ci_delete" on public.contact_identities;
create policy "ci_delete" on public.contact_identities for delete
  using (public.is_ws_member(workspace_id));

-- backfill: telefones existentes em contacts -> identities whatsapp
insert into public.contact_identities (workspace_id, contact_id, kind, value, is_primary)
select c.workspace_id, c.id, 'whatsapp', c.phone_e164, true
from public.contacts c
where c.phone_e164 is not null
  and not exists (
    select 1 from public.contact_identities ci
    where ci.contact_id = c.id and ci.kind = 'whatsapp' and ci.value = c.phone_e164
  );
