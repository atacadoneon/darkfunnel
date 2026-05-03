-- ============================================================
-- DarkFunnel — Lead Edit (7 abas) — rode no SQL Editor
-- ============================================================

-- 1) Pipelines (múltiplos funis)
create table if not exists public.pipelines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  position int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists pipelines_ws_idx on public.pipelines(workspace_id, position);

alter table public.pipeline_stages add column if not exists pipeline_id uuid references public.pipelines(id) on delete cascade;
alter table public.deals          add column if not exists pipeline_id uuid references public.pipelines(id) on delete restrict;

-- backfill: cria 1 pipeline padrão por workspace e amarra
do $$
declare ws record; pid uuid;
begin
  for ws in select id from public.workspaces loop
    select id into pid from public.pipelines where workspace_id = ws.id and is_default limit 1;
    if pid is null then
      insert into public.pipelines (workspace_id, name, is_default) values (ws.id, 'Padrão', true) returning id into pid;
    end if;
    update public.pipeline_stages set pipeline_id = pid where workspace_id = ws.id and pipeline_id is null;
    update public.deals           set pipeline_id = pid where workspace_id = ws.id and pipeline_id is null;
  end loop;
end$$;

alter table public.pipelines enable row level security;
drop policy if exists "pipelines_rw" on public.pipelines;
create policy "pipelines_rw" on public.pipelines for all to authenticated
  using (public.is_ws_member(workspace_id)) with check (public.is_ws_member(workspace_id));

-- 2) Contacts: campos extras
alter table public.contacts
  add column if not exists company_name text,
  add column if not exists email text,
  add column if not exists phone2_e164 text,
  add column if not exists niche text,
  add column if not exists city text;

-- 3) Deals: novos campos
alter table public.deals
  add column if not exists value_sold_cents bigint not null default 0,  -- valor da venda (após fechado)
  add column if not exists ad_source text,                                -- google_ads, meta_ads, etc
  add column if not exists entry_date date,
  add column if not exists first_message text;

-- 4) Múltiplos responsáveis (deal_assignees) — cada deal pode ter vários, com 1 owner principal (assigned_to existente)
create table if not exists public.deal_assignees (
  deal_id uuid not null references public.deals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (deal_id, user_id)
);
create index if not exists deal_assignees_user on public.deal_assignees(user_id);
alter table public.deal_assignees enable row level security;
drop policy if exists "deal_assignees_rw" on public.deal_assignees;
create policy "deal_assignees_rw" on public.deal_assignees for all to authenticated
  using (public.is_ws_member(workspace_id)) with check (public.is_ws_member(workspace_id));

-- 5) Produtos / serviços (catálogo)
create table if not exists public.workspace_products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  default_value_cents bigint not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.workspace_products enable row level security;
drop policy if exists "products_rw" on public.workspace_products;
create policy "products_rw" on public.workspace_products for all to authenticated
  using (public.is_ws_member(workspace_id)) with check (public.is_ws_member(workspace_id));

-- Vínculo produtos por deal (multi)
create table if not exists public.deal_products (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id uuid references public.workspace_products(id) on delete set null,
  name_snapshot text not null,
  created_at timestamptz not null default now()
);
create index if not exists deal_products_deal on public.deal_products(deal_id);
alter table public.deal_products enable row level security;
drop policy if exists "deal_products_rw" on public.deal_products;
create policy "deal_products_rw" on public.deal_products for all to authenticated
  using (public.is_ws_member(workspace_id)) with check (public.is_ws_member(workspace_id));

-- 6) Compras
create table if not exists public.deal_purchases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  product_id uuid references public.workspace_products(id) on delete set null,
  product_name text not null,
  description text,
  value_cents bigint not null default 0,
  purchased_at date not null default current_date,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists deal_purchases_deal on public.deal_purchases(deal_id, purchased_at desc);
alter table public.deal_purchases enable row level security;
drop policy if exists "deal_purchases_rw" on public.deal_purchases;
create policy "deal_purchases_rw" on public.deal_purchases for all to authenticated
  using (public.is_ws_member(workspace_id)) with check (public.is_ws_member(workspace_id));

-- 7) Anexos
create table if not exists public.deal_attachments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists deal_attach_deal on public.deal_attachments(deal_id, created_at desc);
alter table public.deal_attachments enable row level security;
drop policy if exists "deal_attach_rw" on public.deal_attachments;
create policy "deal_attach_rw" on public.deal_attachments for all to authenticated
  using (public.is_ws_member(workspace_id)) with check (public.is_ws_member(workspace_id));

-- bucket de storage
insert into storage.buckets (id, name, public)
  values ('deal-attachments', 'deal-attachments', false)
  on conflict (id) do nothing;

drop policy if exists "deal_files_select" on storage.objects;
create policy "deal_files_select" on storage.objects for select to authenticated
  using (bucket_id = 'deal-attachments');
drop policy if exists "deal_files_insert" on storage.objects;
create policy "deal_files_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'deal-attachments');
drop policy if exists "deal_files_delete" on storage.objects;
create policy "deal_files_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'deal-attachments');

-- 8) Atividades (timeline)
create table if not exists public.deal_activities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  kind text not null default 'note',  -- meeting, call, task, note, email
  title text not null,
  description text,
  scheduled_at timestamptz,
  duration_minutes int,
  done boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists deal_activities_deal on public.deal_activities(deal_id, scheduled_at desc nulls last, created_at desc);
alter table public.deal_activities enable row level security;
drop policy if exists "deal_activities_rw" on public.deal_activities;
create policy "deal_activities_rw" on public.deal_activities for all to authenticated
  using (public.is_ws_member(workspace_id)) with check (public.is_ws_member(workspace_id));

-- 9) Campos personalizados
create table if not exists public.deal_custom_fields (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  field_name text not null,
  field_value text,
  created_at timestamptz not null default now()
);
create index if not exists deal_cf_deal on public.deal_custom_fields(deal_id);
alter table public.deal_custom_fields enable row level security;
drop policy if exists "deal_cf_rw" on public.deal_custom_fields;
create policy "deal_cf_rw" on public.deal_custom_fields for all to authenticated
  using (public.is_ws_member(workspace_id)) with check (public.is_ws_member(workspace_id));

-- 10) Histórico de alterações
create table if not exists public.deal_history (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  field text not null,
  old_value text,
  new_value text,
  changed_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists deal_history_deal on public.deal_history(deal_id, created_at desc);
alter table public.deal_history enable row level security;
drop policy if exists "deal_history_select" on public.deal_history;
create policy "deal_history_select" on public.deal_history for select to authenticated
  using (public.is_ws_member(workspace_id));
drop policy if exists "deal_history_insert" on public.deal_history;
create policy "deal_history_insert" on public.deal_history for insert to authenticated
  with check (public.is_ws_member(workspace_id));

-- trigger genérico de auditoria
create or replace function public.tg_log_deal_changes()
returns trigger language plpgsql security definer set search_path=public as $$
declare uid uuid;
begin
  uid := auth.uid();
  if (new.stage_id is distinct from old.stage_id) then
    insert into public.deal_history (workspace_id, deal_id, field, old_value, new_value, changed_by)
    values (new.workspace_id, new.id, 'stage_id', old.stage_id::text, new.stage_id::text, uid);
  end if;
  if (new.title is distinct from old.title) then
    insert into public.deal_history (workspace_id, deal_id, field, old_value, new_value, changed_by)
    values (new.workspace_id, new.id, 'title', old.title, new.title, uid);
  end if;
  if (new.value_cents is distinct from old.value_cents) then
    insert into public.deal_history (workspace_id, deal_id, field, old_value, new_value, changed_by)
    values (new.workspace_id, new.id, 'value_cents', old.value_cents::text, new.value_cents::text, uid);
  end if;
  if (new.status is distinct from old.status) then
    insert into public.deal_history (workspace_id, deal_id, field, old_value, new_value, changed_by)
    values (new.workspace_id, new.id, 'status', old.status, new.status, uid);
  end if;
  if (new.assigned_to is distinct from old.assigned_to) then
    insert into public.deal_history (workspace_id, deal_id, field, old_value, new_value, changed_by)
    values (new.workspace_id, new.id, 'assigned_to', old.assigned_to::text, new.assigned_to::text, uid);
  end if;
  return new;
end$$;
drop trigger if exists deals_log_changes on public.deals;
create trigger deals_log_changes after update on public.deals
  for each row execute function public.tg_log_deal_changes();

-- log de criação
create or replace function public.tg_log_deal_create()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.deal_history (workspace_id, deal_id, field, old_value, new_value, changed_by)
  values (new.workspace_id, new.id, 'stage_id', null, new.stage_id::text, auth.uid());
  return new;
end$$;
drop trigger if exists deals_log_create on public.deals;
create trigger deals_log_create after insert on public.deals
  for each row execute function public.tg_log_deal_create();

-- 11) Atribuição ADS (1:1 com deal)
create table if not exists public.deal_ads_attribution (
  deal_id uuid primary key references public.deals(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source text,        -- google_ads, meta_ads, organic, ...
  campaign text,
  medium text,        -- cpc, organic, ...
  landing_page text,
  gclid text,
  fbclid text,
  attributed_at timestamptz default now()
);
alter table public.deal_ads_attribution enable row level security;
drop policy if exists "deal_ads_rw" on public.deal_ads_attribution;
create policy "deal_ads_rw" on public.deal_ads_attribution for all to authenticated
  using (public.is_ws_member(workspace_id)) with check (public.is_ws_member(workspace_id));
