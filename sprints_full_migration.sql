-- =====================================================================
-- DarkFunnel — Migration completa (Sprints A→F)
-- Cole TUDO no SQL Editor do Supabase e rode.
-- Idempotente: pode rodar várias vezes sem dar erro.
-- =====================================================================

-- ---------- 0) PROFILES (display_name + avatar para mostrar nos popovers)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  email text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read" on public.profiles for select to authenticated using (true);

drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "profiles self insert" on public.profiles;
create policy "profiles self insert" on public.profiles for insert to authenticated
  with check (id = auth.uid());

-- trigger para popular profiles ao criar usuário
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1))
  )
  on conflict (id) do nothing;
  return new;
end$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- backfill para usuários existentes
insert into public.profiles (id, email, display_name)
select u.id, u.email,
       coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email,'@',1))
from auth.users u
on conflict (id) do nothing;

-- ---------- A) NADA SQL precisa para "responsável" (já existe assigned_user_id e RPC assign_conversation)

-- ---------- A) MOVER ETAPA — adicionar campo opcional de cor/ícone na pipeline_stages
alter table public.pipeline_stages add column if not exists color text default '#94a3b8';
alter table public.pipeline_stages add column if not exists is_won boolean default false;
alter table public.pipeline_stages add column if not exists is_lost boolean default false;

-- ---------- B) OBSERVAÇÕES INTERNAS no contato (texto livre)
alter table public.contacts add column if not exists internal_notes text;
alter table public.contacts add column if not exists internal_notes_updated_at timestamptz;
alter table public.contacts add column if not exists internal_notes_updated_by uuid references auth.users(id);

-- ---------- B) BUSCA EM MENSAGENS — index trigram para acelerar ILIKE
create extension if not exists pg_trgm;
create index if not exists messages_body_trgm_idx
  on public.messages using gin ((payload->>'body') gin_trgm_ops);

-- ---------- C) QUICK REPLIES (mensagens rápidas)
create table if not exists public.quick_replies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  shortcut text,                       -- ex: /preco
  title text not null,
  message_type text not null default 'text',
  payload jsonb not null,              -- { body, mediaUrl, caption, fileName, ... }
  created_by uuid references auth.users(id),
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists quick_replies_ws_idx on public.quick_replies(workspace_id) where archived_at is null;
alter table public.quick_replies enable row level security;
drop policy if exists "ws rw quick_replies" on public.quick_replies;
create policy "ws rw quick_replies" on public.quick_replies for all to authenticated
  using (exists (select 1 from public.workspace_members m where m.workspace_id = quick_replies.workspace_id and m.user_id=auth.uid()))
  with check (exists (select 1 from public.workspace_members m where m.workspace_id = quick_replies.workspace_id and m.user_id=auth.uid()));

-- ---------- E) MESSAGE TEMPLATES (HSM da Cloud API)
create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  channel_id uuid references public.channels(id) on delete set null,
  name text not null,                       -- nome do template HSM aprovado
  language text not null default 'pt_BR',
  category text,                            -- MARKETING|UTILITY|AUTHENTICATION
  status text default 'pending',            -- pending|approved|rejected
  components jsonb,                         -- spec do template (header/body/footer/buttons)
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.message_templates enable row level security;
drop policy if exists "ws rw templates" on public.message_templates;
create policy "ws rw templates" on public.message_templates for all to authenticated
  using (exists (select 1 from public.workspace_members m where m.workspace_id = message_templates.workspace_id and m.user_id=auth.uid()))
  with check (exists (select 1 from public.workspace_members m where m.workspace_id = message_templates.workspace_id and m.user_id=auth.uid()));

-- ---------- E) BROADCASTS (disparo em massa)
create table if not exists public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  channel_id uuid references public.channels(id),
  template_id uuid references public.message_templates(id),
  payload jsonb,                            -- vars/preview
  audience jsonb,                           -- { tag_ids:[], filters:{} }
  scheduled_for timestamptz,
  status text not null default 'draft',     -- draft|scheduled|sending|done|cancelled
  total int default 0,
  sent int default 0,
  failed int default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.broadcasts enable row level security;
drop policy if exists "ws rw broadcasts" on public.broadcasts;
create policy "ws rw broadcasts" on public.broadcasts for all to authenticated
  using (exists (select 1 from public.workspace_members m where m.workspace_id = broadcasts.workspace_id and m.user_id=auth.uid()))
  with check (exists (select 1 from public.workspace_members m where m.workspace_id = broadcasts.workspace_id and m.user_id=auth.uid()));

create table if not exists public.broadcast_recipients (
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null references public.broadcasts(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  status text not null default 'pending',   -- pending|sent|failed
  sent_message_id uuid,
  error text,
  sent_at timestamptz
);
create index if not exists br_rcpt_idx on public.broadcast_recipients(broadcast_id, status);
alter table public.broadcast_recipients enable row level security;
drop policy if exists "ws rw br_rcpt" on public.broadcast_recipients;
create policy "ws rw br_rcpt" on public.broadcast_recipients for all to authenticated
  using (exists (
    select 1 from public.broadcasts b
    join public.workspace_members m on m.workspace_id = b.workspace_id and m.user_id = auth.uid()
    where b.id = broadcast_recipients.broadcast_id))
  with check (exists (
    select 1 from public.broadcasts b
    join public.workspace_members m on m.workspace_id = b.workspace_id and m.user_id = auth.uid()
    where b.id = broadcast_recipients.broadcast_id));

-- ---------- F) ASSINATURA por usuário (anexada às mensagens)
create table if not exists public.user_signatures (
  user_id uuid primary key references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  enabled boolean not null default true,
  body text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.user_signatures enable row level security;
drop policy if exists "self rw signature" on public.user_signatures;
create policy "self rw signature" on public.user_signatures for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =====================================================================
-- FIM
-- =====================================================================
