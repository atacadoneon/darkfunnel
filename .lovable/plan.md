# ONDA D — Plano de implementação

Escopo gigante (≈ 25 arquivos novos + edits). Vou entregar **em 6 etapas commitadas em sequência**, todas em `src/` apenas. Backend (edge functions + tabelas) assumido pronto.

## Premissas de schema (confirme se algo divergir)
- `wallets(workspace_id, balance_cents, low_balance_alert_cents, auto_recharge, auto_recharge_threshold_cents, auto_recharge_amount_cents)`
- `wallet_transactions(id, workspace_id, type, description, amount_cents, balance_after_cents, created_at)`
- `calls(id, workspace_id, user_id, contact_id, conversation_id, deal_id, from_number, to_number, direction, channel, status, outcome, duration_seconds, cost_cents, consumes_credit, initiated_at, twilio_sid)`
- `call_recordings(id, call_id, storage_path, duration_seconds, status)`
- `call_transcripts(id, call_id, summary, sentiment, key_topics jsonb, action_items jsonb, segments jsonb, translated_text, status)`
- `phone_numbers(id, workspace_id, e164, uf, type, monthly_cost_cents, active)`
- `calendar_events(id, workspace_id, title, starts_at, ends_at, attendees jsonb, conference_url, contact_id, deal_id)`
- `voice_pricing(channel, destination, rate_per_min_cents)`

## Etapas

### 1) Sidebar + Header global (`src/components/layout/*`)
- Reordenar grupos do `AppSidebar.tsx` para: Principal, Comunicação, Gestão, Automação, Ferramentas. Adicionar Agenda (/agenda) e Ligações (/calls). Manter Painel do Parceiro, Ajuda, Tema, Sair no footer.
- Novo `AppTopbar.tsx` com slots: `<CallPill/>` `<WalletWidget/>` `<AiHelpButton/>` `<NotificationsBell/>` `<UserMenu/>`.
- Componentes em `src/features/voice/CallPill.tsx`, `src/features/wallet/WalletWidget.tsx`, `src/features/ai/AiHelpDrawer.tsx`.
- Rotas novas registradas em `App.tsx`: `/calls`, `/agenda`, `/settings/wallet`, aliases `/leads`, `/whatsapp/chat`, `/outreach-flows`, `/automations`, `/tasks`.

### 2) Dialer flutuante + Twilio SDK
- `index.html`: adicionar `<script src="https://sdk.twilio.com/js/client/v2.0/twilio.min.js">`.
- `src/hooks/useVoiceDevice.ts`: pega token via `voice-token`, instancia `Twilio.Device`, expõe `device`, `status`, `makeCall`, `hangup`, `sendDigit`, `mute`.
- `src/components/voice/Dialer.tsx` (montado no root): estados idle/dial/connecting/ringing/in_call/ended, draggable fixed bottom-right, popover 360x520, teclado, BINA dropdown, toggle VoIP/WhatsApp, integra `voice-outbound`.
- `src/components/voice/CallTimer.tsx` tabular-nums.
- Store global leve via Zustand ou Context (`VoiceProvider`) para abrir Dialer de qualquer lugar (`useDialer().openWith(contact)`).
- Modal recarga quando 402 `insufficient_balance`.

### 3) Click-to-call universal
- `src/components/voice/CallButton.tsx` dropdown VoIP / WhatsApp.
- Wire em:
  - `src/features/pipeline/DealCard.tsx` (hover icon)
  - `src/features/inbox/ContactPanel.tsx` QuickActions (5 ícones, Ligar primeiro)
  - `src/features/contacts/ContactDialog.tsx` header
  - `src/features/pipeline/LeadEditDialog.tsx` header
  - `src/features/tasks/TaskDrawer.tsx`
  - Agenda event modal

### 4) `/settings/wallet`
- Page `src/pages/app/Wallet.tsx`: header gradiente, 3 KPIs, grid de recargas (R$50/100/250/500/Outro → `stripe-checkout-wallet`).
- Tabs: Histórico (`wallet_transactions`), Configurações (auto-recharge form), Números (`phone_numbers` CRUD com modal Adquirir), Tarifas (`voice_pricing` read-only).
- Realtime via `supabase.channel` em wallets + wallet_transactions.
- Hooks em `src/features/wallet/hooks.ts`.

### 5) `/calls`
- Page `src/pages/app/Calls.tsx`: filtros (data/vendedor/outcome/direction/channel/duração), KPI row, tabela paginada.
- `src/features/voice/CallDrawer.tsx`: player áudio (signed URL bucket `call-recordings`), tabs Transcrição (segments clicáveis com seek), Sumário IA, Tradução, Detalhes.
- Botão Exportar XLSX (lazy import xlsx).
- Empty state com CTA abrir Dialer.
- Realtime calls/recordings/transcripts.

### 6) `/agenda` esqueleto
- Page `src/pages/app/Agenda.tsx`: calendário mensal/semanal simples (sem libs pesadas — grid CSS).
- Banner Google Calendar (botão "Em breve" via toast).
- Modal Nova Reunião gravando em `calendar_events`. Badge "Meet" quando `conference_url`.

## Regras gerais aplicadas
- Tudo via `supabase.functions.invoke` para edge functions.
- Skeleton no loading, EmptyState quando vazio, toast em erro.
- Cores via tokens semânticos (`bg-primary`, `text-destructive`, etc.) — sem hex hardcoded.
- Channel WhatsApp sempre rotulado "grátis", `consumes_credit=false`.
- Sem mocks; tudo do Supabase.

## Riscos / pontos a confirmar
1. **Twilio Device SDK** roda só com HTTPS + permissão de microfone — testarei em preview.
2. **Stripe checkout**: depende de a edge function devolver `{ url }` pronto.
3. **Bucket privado**: signed URL com 1h.
4. Se algum nome de coluna/tabela divergir do assumido acima, ajusto após primeiro erro 4xx.

Posso começar pela etapa 1 (Sidebar+Header+rotas) e seguir em ordem? Responda "vai" que executo tudo de ponta a ponta sem interromper, ou diga qual etapa priorizar.
