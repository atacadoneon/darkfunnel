-- ============================================================
-- DarkFunnel — Inbox Features (rode tudo no SQL Editor)
-- conversation_notes | scheduled_messages | playbooks | cadences
-- ============================================================

-- Helper de permissão por workspace, usado nas policies abaixo.
-- Evita depender de public.has_role(), que pode não existir no seu banco.
create or replace function public.is_ws_admin_or_manager(_ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = _ws
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin', 'manager')
  );
$$;

-- 1) NOTAS INTERNAS (visíveis só para o time)
create table if not exists public.conversation_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists conv_notes_conv_idx on public.conversation_notes(conversation_id, created_at desc);
alter table public.conversation_notes enable row level security;

drop policy if exists "ws members read notes" on public.conversation_notes;
create policy "ws members read notes" on public.conversation_notes
  for select to authenticated
  using (exists (
    select 1 from public.workspace_members m
    where m.workspace_id = conversation_notes.workspace_id and m.user_id = auth.uid()
  ));

drop policy if exists "ws members write notes" on public.conversation_notes;
create policy "ws members write notes" on public.conversation_notes
  for insert to authenticated
  with check (
    author_id = auth.uid() and exists (
      select 1 from public.workspace_members m
      where m.workspace_id = conversation_notes.workspace_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "author delete notes" on public.conversation_notes;
create policy "author delete notes" on public.conversation_notes
  for delete to authenticated using (author_id = auth.uid());

-- 2) MENSAGENS AGENDADAS
create table if not exists public.scheduled_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  message_type text not null default 'text',
  payload jsonb not null,
  scheduled_for timestamptz not null,
  status text not null default 'pending', -- pending|sent|cancelled|failed
  sent_message_id uuid,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists sched_msg_conv_idx on public.scheduled_messages(conversation_id, scheduled_for);
create index if not exists sched_msg_due_idx on public.scheduled_messages(status, scheduled_for) where status='pending';
alter table public.scheduled_messages enable row level security;

drop policy if exists "ws members rw sched" on public.scheduled_messages;
create policy "ws members rw sched" on public.scheduled_messages
  for all to authenticated
  using (exists (
    select 1 from public.workspace_members m
    where m.workspace_id = scheduled_messages.workspace_id and m.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.workspace_members m
    where m.workspace_id = scheduled_messages.workspace_id and m.user_id = auth.uid()
  ));

-- 3) PLAYBOOKS (roteiros / scripts)
create table if not exists public.playbooks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  created_by uuid references auth.users(id),
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.playbook_steps (
  id uuid primary key default gen_random_uuid(),
  playbook_id uuid not null references public.playbooks(id) on delete cascade,
  position int not null default 0,
  message_type text not null default 'text',
  payload jsonb not null,                  -- { body: "Olá {{nome}}" }
  delay_minutes int not null default 0     -- delay relativo ao passo anterior
);
create index if not exists playbook_steps_idx on public.playbook_steps(playbook_id, position);

alter table public.playbooks enable row level security;
alter table public.playbook_steps enable row level security;

drop policy if exists "ws read playbooks" on public.playbooks;
create policy "ws read playbooks" on public.playbooks for select to authenticated
  using (exists (select 1 from public.workspace_members m where m.workspace_id = playbooks.workspace_id and m.user_id=auth.uid()));
drop policy if exists "ws write playbooks" on public.playbooks;
create policy "ws write playbooks" on public.playbooks for all to authenticated
  using (public.is_ws_admin_or_manager(playbooks.workspace_id))
  with check (public.is_ws_admin_or_manager(playbooks.workspace_id));

drop policy if exists "ws read steps" on public.playbook_steps;
create policy "ws read steps" on public.playbook_steps for select to authenticated
  using (exists (select 1 from public.playbooks p
    join public.workspace_members m on m.workspace_id = p.workspace_id and m.user_id = auth.uid()
    where p.id = playbook_steps.playbook_id));
drop policy if exists "ws write steps" on public.playbook_steps;
create policy "ws write steps" on public.playbook_steps for all to authenticated
  using (exists (
    select 1 from public.playbooks p
    where p.id = playbook_steps.playbook_id
      and public.is_ws_admin_or_manager(p.workspace_id)
  ))
  with check (exists (
    select 1 from public.playbooks p
    where p.id = playbook_steps.playbook_id
      and public.is_ws_admin_or_manager(p.workspace_id)
  ));

-- 4) CADÊNCIAS (execução de playbook em uma conversa)
create table if not exists public.cadence_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  playbook_id uuid not null references public.playbooks(id) on delete cascade,
  started_by uuid not null references auth.users(id),
  status text not null default 'running', -- running|completed|cancelled
  current_step int not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists cadence_runs_conv_idx on public.cadence_runs(conversation_id);
alter table public.cadence_runs enable row level security;
drop policy if exists "ws rw cadence" on public.cadence_runs;
create policy "ws rw cadence" on public.cadence_runs for all to authenticated
  using (exists (select 1 from public.workspace_members m where m.workspace_id = cadence_runs.workspace_id and m.user_id=auth.uid()))
  with check (exists (select 1 from public.workspace_members m where m.workspace_id = cadence_runs.workspace_id and m.user_id=auth.uid()));

-- 5) ANÁLISES IA da conversa
create table if not exists public.conversation_ai_analyses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  requested_by uuid not null references auth.users(id),
  summary text,
  score int,                  -- 0-100
  strengths jsonb,            -- array of strings
  improvements jsonb,         -- array of strings
  next_actions jsonb,         -- array of strings
  raw jsonb,
  created_at timestamptz not null default now()
);
create index if not exists ai_an_conv_idx on public.conversation_ai_analyses(conversation_id, created_at desc);
alter table public.conversation_ai_analyses enable row level security;
drop policy if exists "ws rw analyses" on public.conversation_ai_analyses;
create policy "ws rw analyses" on public.conversation_ai_analyses for all to authenticated
  using (exists (select 1 from public.workspace_members m where m.workspace_id = conversation_ai_analyses.workspace_id and m.user_id=auth.uid()))
  with check (exists (select 1 from public.workspace_members m where m.workspace_id = conversation_ai_analyses.workspace_id and m.user_id=auth.uid()));

-- 6) RPC: reatribuir conversa (mantendo regra de permissão)
create or replace function public.assign_conversation(p_conversation uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_ws uuid; v_owner uuid;
begin
  select c.workspace_id, c.assigned_user_id into v_ws, v_owner
  from public.conversations c where c.id = p_conversation;
  if v_ws is null then raise exception 'conversation not found'; end if;

  -- só admin, manager, ou dono atual podem reatribuir
  if not (
    public.is_ws_admin_or_manager(v_ws) or
    v_owner = auth.uid() or v_owner is null
  ) then
    raise exception 'forbidden';
  end if;

  -- destinatário precisa ser membro do workspace
  if p_user is not null and not exists (
    select 1 from public.workspace_members m where m.workspace_id = v_ws and m.user_id = p_user
  ) then raise exception 'user not in workspace'; end if;

  update public.conversations set assigned_user_id = p_user, updated_at = now()
  where id = p_conversation;
end$$;
grant execute on function public.assign_conversation(uuid, uuid) to authenticated;
