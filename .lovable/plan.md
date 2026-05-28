# Plano — 4 Frentes Frontend DarkFunnel

Escopo grande (4 frentes independentes, ~30 arquivos novos). Vou implementar tudo em `src/` apenas, sem tocar em `supabase/`.

## Frente 1 — Refinamento Editor Visual (`/automacoes/:id/editor`)

Trabalhar sobre os arquivos existentes (`src/components/automacoes/`), não criar pasta nova `flow-editor`:

- `nodes/MessageNode.tsx` — deixar de re-exportar GenericNode. Renderizar handles dinâmicos: `next` (azul), `error` (vermelho bottom-right) e um handle `button_<id>` para cada `config.interactive_buttons[]` na borda inferior com label.
- `NodeEditorDrawer.tsx` — para node_type=message, mostrar Tabs com 6 sub-tipos (text, user_input, typing_delay, audio, file_attachment, dynamic_url). Campos condicionais por sub-tipo. Select `channel_id` (Herdar | canais ativos). Section colapsável "Agendamento" com DateTimePicker → `config.schedule_at`. Botão `{}` em todo textarea abre VariablePickerDialog.
- `VariablePicker.tsx` (já existe) — expandir para Dialog com 10 categorias (Tabs vertical 200px). Buscar `flow_variable_catalog` + `custom_field_definitions` (lead/deal/workspace) + extrair `ai.output_var` / `input.user_input_var` dos nós anteriores do flow.
- Novo `InteractiveButtonsEditor.tsx` — lista até 3 botões `{id, title}` para sub-tipos text/dynamic_url.
- Novos hooks `useFlowVariables.ts`, `useChannelsForFlow.ts`.
- `FlowCanvas.tsx` — garantir que edges aceitam `source_handle` button_*/error.

## Frente 2 — Onboarding `/company-register`

Já existem `CompanyRegister.tsx`, `PreparingAccount.tsx`, `SetupWizard.tsx`, `CompanyWizardShell.tsx`. Vou refinar para corresponder ao spec:

- Refinar `CompanyRegister.tsx`: usar 7 nichos exatos, react-phone-number-input para telefone E.164, mask CEP, ViaCEP autofill já existe.
- Refinar `PreparingAccount.tsx`: 5 status messages rotacionando 1.3s, ProgressBar sincronizada 5-7s, navigate `/company-register/setup`.
- Refinar `SetupWizard.tsx`: 3 steps (Convidar, Conectar, Plano) com botão "Pular por enquanto", PlanCard com cálculo anual/semestral/mensal e badge "Economize", chamar `complete_setup_step` com `p_plan_slug` e `p_billing_cycle` no final.
- Novo `InviteMemberDialog.tsx`.
- Gating em `AppLayout.tsx`: respeitar platform_admin (não redirecionar).

## Frente 3 — `/trackeamento` (4 tabs)

Já existe `src/features/tracking/` com OverviewTab/MetaAdsTab/GoogleAdsTab/LandingPagesTab + `TrackingSection.tsx`. Vou:

- Criar nova rota `/trackeamento` e página `src/pages/Trackeamento.tsx` (Tabs Campanhas/Atribuição/Landing Pages/Fila Envios) — não reusar `/tracking` antigo (diferentes tabs).
- Criar `src/features/trackeamento/{CampanhasTab, AtribuicaoTab, LandingPagesTab, FilaEnviosTab, TrackingConfigDrawer, LandingPageDialog}.tsx`.
- Hooks: `useTrackingConfigs, useAdsAttribution, useLandingPages, useTrackingQueue`.
- Realtime no FilaEnviosTab via channel `tracking-${wsId}`.
- Filtros header (período 7d/30d/90d/custom, canal Meta/Google).
- Adicionar item "Trackeamento" na sidebar (ícone Target) após Automações.

## Frente 4 — `/config/inbound-webhooks`

- Nova rota gated proprietario|gerente.
- Página `src/pages/config/InboundWebhooksPage.tsx` com tabela `inbound_webhook_endpoints`.
- Modal criar/editar 3 tabs (Básico/Mapeamento/Teste) → `EndpointDialog`, `MappingEditor`, `MappingTester`.
- Drawer Logs com tabela `inbound_webhook_logs` + Realtime.
- Hooks `useInboundEndpoints, useInboundLogs`.
- Sub-item "Webhooks de entrada" na sidebar de Configurações.
- RPCs: `inbound_webhook_create_endpoint`, `inbound_webhook_test_mapping`, `inbound_webhook_rotate_secret`.

## Regras transversais

- Nenhuma edição em `supabase/**`.
- Roles em PT-BR via `permissions.ts` existente (`useIsManagerOrAdmin`).
- TanStack Query v5; shadcn/ui apenas; service_role nunca no frontend.
- Toast (sonner) em todo submit.
- Sidebar atualizada no mesmo PR para Frentes 3 e 4.

## Ordem de execução

1. Frente 4 (Inbound) — auto-contida, pouco acoplada.
2. Frente 3 (Trackeamento) — auto-contida.
3. Frente 2 (Onboarding refino) — refatorar arquivos existentes.
4. Frente 1 (Editor) — mais acoplada ao FlowCanvas/Nodes, deixar por último.

Confirmação final: "Pronto, 4 frentes deployadas. Falta validar smoke tests 1-4."
