-- ============================================================
-- DarkFunnel — Permissões por papel (admin / gerente / vendedor)
-- Rode no SQL Editor do Supabase
--
-- Mapeamento workspace_members.role:
--   owner / admin           => acesso total (admin)
--   manager                 => vê tudo do workspace, não mexe em cadastros
--   member                  => vendedor (vê só dele + colaborações + conversas dele/sem dono)
-- ============================================================

-- 1) garantir que a coluna role aceita 'manager'
do $$
begin
  -- remove constraint antiga se existir
  if exists (
    select 1 from pg_constraint
    where conname = 'workspace_members_role_check'
  ) then
    alter table public.workspace_members drop constraint workspace_members_role_check;
  end if;
end $$;

alter table public.workspace_members
  add constraint workspace_members_role_check
  check (role in ('owner','admin','manager','member'));

-- 2) helpers (security definer)
create or replace function public.is_ws_admin(_ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = _ws and user_id = auth.uid()
      and role in ('owner','admin')
  );
$$;

create or replace function public.is_ws_admin_or_manager(_ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = _ws and user_id = auth.uid()
      and role in ('owner','admin','manager')
  );
$$;

create or replace function public.my_ws_role(_ws uuid)
returns text language sql stable security definer set search_path = public as $$
  select role::text from public.workspace_members
  where workspace_id = _ws and user_id = auth.uid()
  limit 1;
$$;

-- 3) garantir colunas usadas (idempotente)
alter table public.contacts       add column if not exists owner_id uuid references auth.users(id) on delete set null;
alter table public.conversations  add column if not exists assigned_user_id uuid references auth.users(id) on delete set null;

-- 4) helper: o usuário pode ver este contato?
create or replace function public.can_see_contact(_ws uuid, _contact uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.is_ws_admin_or_manager(_ws)
    or exists (
      select 1 from public.contacts c
      where c.id = _contact and c.owner_id = auth.uid()
    )
    or exists (
      -- vendedor convidado em algum deal deste contato
      select 1 from public.deal_collaborators dc
      join public.deals d on d.id = dc.deal_id
      where d.contact_id = _contact and dc.user_id = auth.uid()
    )
    or exists (
      -- contato sem dono → fica visível para todos do workspace (pool)
      select 1 from public.contacts c
      where c.id = _contact and c.owner_id is null
    );
$$;

-- ============================================================
-- 5) RLS — CONTACTS
-- ============================================================
drop policy if exists "contacts_select" on public.contacts;
create policy "contacts_select" on public.contacts for select
using (
  public.is_ws_member(workspace_id) and (
    public.is_ws_admin_or_manager(workspace_id)
    or owner_id = auth.uid()
    or owner_id is null
    or exists (
      select 1 from public.deal_collaborators dc
      join public.deals d on d.id = dc.deal_id
      where d.contact_id = contacts.id and dc.user_id = auth.uid()
    )
  )
);

drop policy if exists "contacts_insert" on public.contacts;
create policy "contacts_insert" on public.contacts for insert
with check (public.is_ws_member(workspace_id));

drop policy if exists "contacts_update" on public.contacts;
create policy "contacts_update" on public.contacts for update
using (
  public.is_ws_member(workspace_id) and (
    public.is_ws_admin_or_manager(workspace_id)
    or owner_id = auth.uid()
    or owner_id is null
  )
);

-- contatos NUNCA são deletados (constraint via memória do projeto)
drop policy if exists "contacts_delete" on public.contacts;

-- ============================================================
-- 6) RLS — CONTACT_IDENTITIES (segue visibilidade do contato)
-- ============================================================
drop policy if exists "ci_select" on public.contact_identities;
create policy "ci_select" on public.contact_identities for select
using (public.is_ws_member(workspace_id) and public.can_see_contact(workspace_id, contact_id));

drop policy if exists "ci_insert" on public.contact_identities;
create policy "ci_insert" on public.contact_identities for insert
with check (public.is_ws_member(workspace_id) and public.can_see_contact(workspace_id, contact_id));

drop policy if exists "ci_update" on public.contact_identities;
create policy "ci_update" on public.contact_identities for update
using (public.is_ws_member(workspace_id) and public.can_see_contact(workspace_id, contact_id));

drop policy if exists "ci_delete" on public.contact_identities;
create policy "ci_delete" on public.contact_identities for delete
using (public.is_ws_member(workspace_id) and public.can_see_contact(workspace_id, contact_id));

-- ============================================================
-- 7) RLS — CONTACT_TAGS (segue visibilidade do contato)
-- ============================================================
drop policy if exists "ct_select" on public.contact_tags;
create policy "ct_select" on public.contact_tags for select
using (public.is_ws_member(workspace_id) and public.can_see_contact(workspace_id, contact_id));

drop policy if exists "ct_insert" on public.contact_tags;
create policy "ct_insert" on public.contact_tags for insert
with check (public.is_ws_member(workspace_id) and public.can_see_contact(workspace_id, contact_id));

drop policy if exists "ct_delete" on public.contact_tags;
create policy "ct_delete" on public.contact_tags for delete
using (public.is_ws_member(workspace_id) and public.can_see_contact(workspace_id, contact_id));

-- ============================================================
-- 8) RLS — DEALS
--   Vendedor vê: deals em que é assigned_to OU é colaborador
--   Admin/Gerente: vê tudo do workspace
-- ============================================================
drop policy if exists "deals_select" on public.deals;
create policy "deals_select" on public.deals for select
using (
  public.is_ws_member(workspace_id) and (
    public.is_ws_admin_or_manager(workspace_id)
    or assigned_to = auth.uid()
    or assigned_to is null
    or exists (
      select 1 from public.deal_collaborators dc
      where dc.deal_id = deals.id and dc.user_id = auth.uid()
    )
  )
);

drop policy if exists "deals_insert" on public.deals;
create policy "deals_insert" on public.deals for insert
with check (public.is_ws_member(workspace_id));

drop policy if exists "deals_update" on public.deals;
create policy "deals_update" on public.deals for update
using (
  public.is_ws_member(workspace_id) and (
    public.is_ws_admin_or_manager(workspace_id)
    or assigned_to = auth.uid()
    or exists (
      select 1 from public.deal_collaborators dc
      where dc.deal_id = deals.id and dc.user_id = auth.uid()
    )
  )
);

-- deals nunca são deletados; remover policy se existir
drop policy if exists "deals_delete" on public.deals;

-- ============================================================
-- 9) RLS — DEAL_COLLABORATORS
--   Admin/Gerente OU dono do deal pode convidar/remover
--   Convidado pode ver
-- ============================================================
drop policy if exists "dc_select" on public.deal_collaborators;
create policy "dc_select" on public.deal_collaborators for select
using (
  public.is_ws_member(workspace_id) and (
    public.is_ws_admin_or_manager(workspace_id)
    or user_id = auth.uid()
    or exists (select 1 from public.deals d where d.id = deal_collaborators.deal_id and d.assigned_to = auth.uid())
  )
);

drop policy if exists "dc_insert" on public.deal_collaborators;
create policy "dc_insert" on public.deal_collaborators for insert
with check (
  public.is_ws_member(workspace_id) and (
    public.is_ws_admin_or_manager(workspace_id)
    or exists (select 1 from public.deals d where d.id = deal_collaborators.deal_id and d.assigned_to = auth.uid())
  )
);

drop policy if exists "dc_delete" on public.deal_collaborators;
create policy "dc_delete" on public.deal_collaborators for delete
using (
  public.is_ws_member(workspace_id) and (
    public.is_ws_admin_or_manager(workspace_id)
    or exists (select 1 from public.deals d where d.id = deal_collaborators.deal_id and d.assigned_to = auth.uid())
  )
);

-- ============================================================
-- 10) RLS — CONVERSATIONS
--   Vendedor vê: assigned_user_id = ele OU sem responsável (pool)
--                OU contato pertence a ele
-- ============================================================
drop policy if exists "conv_select" on public.conversations;
create policy "conv_select" on public.conversations for select
using (
  public.is_ws_member(workspace_id) and (
    public.is_ws_admin_or_manager(workspace_id)
    or assigned_user_id = auth.uid()
    or assigned_user_id is null
    or exists (
      select 1 from public.contacts c
      where c.id = conversations.contact_id and c.owner_id = auth.uid()
    )
  )
);

drop policy if exists "conv_insert" on public.conversations;
create policy "conv_insert" on public.conversations for insert
with check (public.is_ws_member(workspace_id));

drop policy if exists "conv_update" on public.conversations;
create policy "conv_update" on public.conversations for update
using (
  public.is_ws_member(workspace_id) and (
    public.is_ws_admin_or_manager(workspace_id)
    or assigned_user_id = auth.uid()
    or assigned_user_id is null
    or exists (
      select 1 from public.contacts c
      where c.id = conversations.contact_id and c.owner_id = auth.uid()
    )
  )
);

-- ============================================================
-- 11) RLS — MESSAGES (segue visibilidade da conversa)
-- ============================================================
create or replace function public.can_see_conversation(_conv uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversations c
    where c.id = _conv
      and public.is_ws_member(c.workspace_id)
      and (
        public.is_ws_admin_or_manager(c.workspace_id)
        or c.assigned_user_id = auth.uid()
        or c.assigned_user_id is null
        or exists (
          select 1 from public.contacts ct
          where ct.id = c.contact_id and ct.owner_id = auth.uid()
        )
      )
  );
$$;

drop policy if exists "msg_select" on public.messages;
create policy "msg_select" on public.messages for select
using (public.can_see_conversation(conversation_id));

drop policy if exists "msg_insert" on public.messages;
create policy "msg_insert" on public.messages for insert
with check (public.can_see_conversation(conversation_id));

drop policy if exists "msg_update" on public.messages;
create policy "msg_update" on public.messages for update
using (public.can_see_conversation(conversation_id));
