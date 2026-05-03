## DarkFunnel — Setup + Sprint 2.1 (Inbox)

Conectar Supabase externo (você fornece URL/anon/service-role), aplicar as 6 migrations do zip, e construir o shell autenticado + inbox de conversas em tempo real.

---

## Etapa 0 — Conexão Supabase externo

1. Você cria projeto Supabase vazio e me envia:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (apenas para rodar as migrations; não vai pro frontend)
2. Aplico em sequência via SQL as 6 migrations do zip:
   - `0001_core.sql` (workspaces, members, plans, billing, audit)
   - `0002_channels.sql` (channels, credentials cifradas, throttle, routing)
   - `0003_messaging.sql` (contacts, conversations, messages, templates)
   - `0004_engine.sql` (outbound_queue, webhook_log, automations, pipeline)
   - `0005_rls.sql` (políticas RLS por workspace)
   - `0006_functions.sql` (helpers: enqueue, assign, window)
3. Crio cliente Supabase em `src/integrations/supabase/client.ts` usando apenas anon key + variáveis públicas Vite.
4. Configuro Auth no painel Supabase: Email/Senha + Google OAuth (te entrego o passo-a-passo de Client ID/Secret no Google Cloud + redirect URLs).

> Edge Functions (`webhook-uazapi`, `webhook-whatsapp-cloud`, `send-message`) e o worker Node ficam **fora** desta entrega — pertencem ao destravamento de Onda 1 que você já tem no zip e roda via `supabase functions deploy` + Render. Esta entrega cobre só o frontend do Sprint 2.1.

---

## Etapa 1 — Auth + Multi-tenant

- Páginas públicas: `/login`, `/signup`, `/forgot-password`, `/reset-password`.
- Login com Email/Senha e botão "Continuar com Google".
- Após signup: criar `workspace` + `workspace_member` (role `owner`) automaticamente via RPC.
- Hook `useAuth` com `onAuthStateChange` + sessão persistente.
- Hook `useWorkspace` com workspace ativo salvo em localStorage; switcher na topbar quando o usuário pertencer a mais de um.
- Guard de rota: tudo dentro de `/app/*` exige sessão + workspace ativo.

---

## Etapa 2 — Shell do app autenticado

Layout em `/app`:

```text
┌─ Topbar ─────────────────────────────────────┐
│ [≡] DarkFunnel  · Workspace ▾   🔔  👤 menu │
├─Sidebar──┬───────────────────────────────────┤
│ Inbox    │                                   │
│ Contatos │      Área principal (Outlet)      │
│ Canais   │                                   │
│ Config   │                                   │
└──────────┴───────────────────────────────────┘
```

- shadcn `Sidebar` com `collapsible="icon"` (mini-collapse).
- Toggle light/dark na topbar (persistido).
- Code split por rota (lazy + Suspense). Bundle inicial alvo < 200KB gzip.
- Menu do usuário: perfil, trocar workspace, sair.
- Mobile: sidebar offcanvas, topbar fixa.

Apenas a rota **Inbox** ganha conteúdo real neste sprint; as outras ficam como placeholders "em breve".

---

## Etapa 3 — Inbox (Sprint 2.1)

### 3.1 Lista de conversas (coluna esquerda da Inbox)
- Query Supabase: `conversations` JOIN `contacts` + última mensagem + contagem de não-lidas, filtrada por `workspace_id` (RLS já garante).
- Virtualização com `@tanstack/react-virtual` para suportar 1.000+ itens sem lag.
- Cache TanStack Query + persistência local (IndexedDB via Dexie) → reload mostra cache em < 100ms.
- Realtime: subscription em `messages` e `conversations` invalida queries em < 500ms.
- Filtros no topo: Todas / Não lidas / Atribuídas a mim. Busca por nome/telefone.
- Cada item: avatar, nome, prévia última mensagem, hora, badge de canal (UAZAPI/Cloud), badge de não-lidas.

### 3.2 Thread de mensagens (coluna central)
- Paginação por cursor (mais antigas ao rolar pra cima), 50 por página.
- Bubbles inbound/outbound com status `sent → delivered → read` (ícones tipo WhatsApp).
- Mensagens novas via Realtime aparecem ao vivo; auto-scroll só se já estiver no fim.
- Suporte a tipos: texto, imagem, áudio, documento (renderização básica; upload completo é Sprint 2.2).
- Header da thread: nome do contato, telefone, badge de canal, status `window_expires_at` (countdown da janela 24h Cloud).

### 3.3 Compositor
- Textarea auto-resize, Enter envia, Shift+Enter quebra linha.
- Botão de anexo (imagem/áudio/doc) — upload básico para Storage Supabase.
- **Optimistic UI**: mensagem aparece em < 50ms com status `pending`, atualiza quando o backend confirma.
- Envio chama RPC `send_message` (já existe na migration 0006) que enfileira em `outbound_queue`.
- **Janela 24h Cloud**: se canal é Cloud e `window_expires_at < now()`, bloqueia texto livre e abre modal "Selecionar template HSM" (UI mínima de seleção; gestão completa de templates é Sprint 2.4).
- Indicador de canal ativo + status (online / offline / qr_pending) ao lado do compositor.

### 3.4 Painel direito (contato)
- Card com dados do contato: nome, telefone, tags, atribuído a, criado em.
- Edição inline de nome e tags.
- Histórico resumido (últimas conversas, deals abertos — placeholder pra ondas seguintes).

---

## Métricas de aceite (DoD do Sprint 2.1)

| Métrica | Alvo |
|---|---|
| Abrir conversa (p95) | < 200ms |
| Enviar mensagem (UI optimistic) | < 50ms |
| Realtime invalida lista | < 500ms |
| 1.000 conversas mock sem lag | OK |
| Reload mostra cache | < 100ms |
| Lighthouse mobile | > 90 |

---

## Detalhes técnicos

- **Stack**: Vite + React 18 + TS strict, TanStack Query v5, shadcn/ui, Tailwind, Supabase JS v2, `@tanstack/react-virtual`, Dexie + `@tanstack/query-persist-client`, `react-router-dom`.
- **Estrutura**:
  - `src/integrations/supabase/{client.ts,types.ts}` — cliente + tipos gerados.
  - `src/features/auth/` — hooks, páginas, guard.
  - `src/features/workspace/` — provider, switcher, RPC.
  - `src/features/inbox/` — `ConversationList`, `MessageThread`, `Composer`, `ContactPanel`, hooks de query/realtime.
  - `src/layouts/AppLayout.tsx` — shell autenticado.
  - `src/pages/` — Login, Signup, ForgotPassword, ResetPassword, AppHome, Inbox, placeholders.
- **RLS**: o frontend usa apenas anon key; toda autorização vem das policies do `0005_rls.sql`. Service role nunca aparece no bundle.
- **Realtime**: canais por `workspace_id` para evitar leak entre tenants.
- **Tipos**: gerados a partir do schema Supabase após migrations aplicadas.

---

## Fora deste plano (próximas iterações)

- Sprint 2.2: mídia/áudio/transcrição Whisper.
- Sprint 2.3: atribuição automática, tags coloridas, macros, notas internas.
- Sprint 2.4: gestão completa de templates HSM, broadcasts, warm-up UAZAPI, health-check.
- Deploy de Edge Functions e do worker Node (você roda manualmente seguindo o README do zip).
