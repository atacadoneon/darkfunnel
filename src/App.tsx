import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AuthProvider } from "@/features/auth/AuthProvider";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { WorkspaceProvider } from "@/features/workspace/WorkspaceProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { VoiceProvider } from "@/features/voice/VoiceProvider";
import { Dialer as VoiceDialer } from "@/components/voice/Dialer";
import { InsufficientBalanceModal } from "@/features/voice/InsufficientBalanceModal";

import Login from "@/pages/auth/Login";
import Signup from "@/pages/auth/Signup";
import ForgotPassword from "@/pages/auth/ForgotPassword";
import ResetPassword from "@/pages/auth/ResetPassword";
import AppLayout from "@/layouts/AppLayout";
import Inbox from "@/pages/app/Inbox";
import Settings from "@/pages/app/Settings";
import Pipeline from "@/pages/app/Pipeline";
import Dashboard from "@/pages/app/Dashboard";
import Tasks from "@/pages/app/Tasks";
import AutomacoesPage from "@/pages/AutomacoesPage";
import AutomacaoEditorPage from "@/pages/AutomacaoEditorPage";
import Cadence from "@/pages/app/Cadence";
import Goals from "@/pages/app/Goals";
import AdminFeatures from "@/pages/admin/Features";
import EmailMarketing from "@/pages/app/EmailMarketing";
import Wallet from "@/pages/app/Wallet";
import Calls from "@/pages/app/Calls";
import Agenda from "@/pages/app/Agenda";
import Dialer from "@/pages/app/Dialer";
import DialerRun from "@/pages/app/DialerRun";
import Prospeccao from "@/pages/app/Prospeccao";
import EquipeOnline from "@/pages/app/EquipeOnline";
import Payments from "@/pages/app/Payments";
import Produtos from "@/pages/app/Produtos";
import ProdutoEditor from "@/pages/app/ProdutoEditor";
import Propostas from "@/pages/app/Propostas";
import PropostaEditor from "@/pages/app/PropostaEditor";
import MCPServerSettingsPage from "@/pages/MCPServerSettingsPage";
import CustomFieldsSettingsPage from "@/pages/CustomFieldsSettingsPage";
import Trackeamento from "@/pages/Trackeamento";
import InboundWebhooksPage from "@/pages/config/InboundWebhooksPage";
import Admin from "@/pages/admin/Admin";
import GoogleCallback from "@/pages/auth/GoogleCallback";
import SettingsRodizio from "@/pages/SettingsRodizio";
import CompanyRegister from "@/pages/company/CompanyRegister";
import PreparingAccount from "@/pages/company/PreparingAccount";
import SetupWizard from "@/pages/company/SetupWizard";
import NotFound from "@/pages/NotFound";
import SettingsShell from "@/components/layout/SettingsShell";
import SettingsPlaceholder from "@/pages/settings/SettingsPlaceholder";
import { useUserPresence } from "@/hooks/useUserPresence";


function PresenceMount() {
  useUserPresence();
  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 1000 * 60 * 60 * 24,
      refetchOnWindowFocus: false,
      refetchOnMount: "always",
      refetchOnReconnect: true,
    },
  },
});

const persister = createSyncStoragePersister({
  storage: typeof window !== "undefined" ? window.localStorage : undefined as any,
  key: "rq-cache-v1",
  throttleTime: 1000,
});

const App = () => (
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24, buster: "v1" }}
  >
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <WorkspaceProvider>
              <PresenceMount />
              <VoiceProvider>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/auth/google/callback" element={<GoogleCallback />} />

                  <Route path="/app/*" element={<Navigate to="/dashboard" replace />} />

                  <Route path="/company-register" element={<RequireAuth><CompanyRegister /></RequireAuth>} />
                  <Route path="/company-register/preparing" element={<RequireAuth><PreparingAccount /></RequireAuth>} />
                  <Route path="/company-register/setup" element={<RequireAuth><SetupWizard /></RequireAuth>} />


                  <Route
                    path="/"
                    element={
                      <RequireAuth>
                        <AppLayout />
                      </RequireAuth>
                    }
                  >
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="chats" element={<Inbox />} />
                    <Route path="whatsapp/chat" element={<Navigate to="/chats" replace />} />
                    <Route path="funildevendas" element={<Pipeline />} />
                    <Route path="leads" element={<Pipeline />} />
                    <Route path="negocios" element={<Navigate to="/funildevendas" replace />} />
                    <Route path="emailmarketing" element={<EmailMarketing />} />
                    <Route path="email-marketing" element={<Navigate to="/emailmarketing" replace />} />
                    <Route path="metas" element={<Goals />} />
                    <Route path="tarefas" element={<Tasks />} />
                    <Route path="tasks" element={<Tasks />} />
                    <Route path="reunioes" element={<Navigate to="/agenda" replace />} />
                    <Route path="agenda" element={<Agenda />} />
                    <Route path="calls" element={<Calls />} />
                    <Route path="discador" element={<Dialer />} />
                    <Route path="discador/:id" element={<DialerRun />} />
                    <Route path="cadencia" element={<Cadence />} />
                    <Route path="outreach-flows" element={<Cadence />} />
                    <Route path="automacoes" element={<AutomacoesPage />} />
                    <Route path="automacoes/:id" element={<AutomacaoEditorPage />} />
                    <Route path="automations" element={<AutomacoesPage />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="prospeccao" element={<Prospeccao />} />
                    <Route path="equipe-online" element={<EquipeOnline />} />
                    <Route path="pagamentos" element={<Payments />} />
                    <Route path="produtos" element={<Produtos />} />
                    <Route path="produtos/novo" element={<ProdutoEditor />} />
                    <Route path="produtos/:id" element={<ProdutoEditor />} />
                    <Route path="propostas" element={<Propostas />} />
                    <Route path="propostas/novo" element={<PropostaEditor />} />
                    <Route path="propostas/:id" element={<PropostaEditor />} />
                    <Route path="trackeamento" element={<Trackeamento />} />

                    {/* Settings Shell — segunda sidebar lateral */}
                    <Route element={<SettingsShell />}>
                      <Route path="settings" element={<Navigate to="/settings/perfil" replace />} />
                      <Route path="settings/perfil" element={<SettingsPlaceholder title="Meu perfil" />} />
                      <Route path="settings/planos" element={<SettingsPlaceholder title="Planos e uso" />} />
                      <Route path="settings/empresa" element={<SettingsPlaceholder title="Empresa" />} />
                      <Route path="settings/tags" element={<SettingsPlaceholder title="Tags" />} />
                      <Route path="settings/motivos-perda" element={<SettingsPlaceholder title="Motivos de perda" />} />
                      <Route path="settings/listas" element={<SettingsPlaceholder title="Listas" />} />
                      <Route path="settings/departamentos" element={<SettingsPlaceholder title="Departamentos" />} />
                      <Route path="settings/horarios" element={<SettingsPlaceholder title="Horários de trabalho" />} />
                      <Route path="settings/tipos-atividade" element={<SettingsPlaceholder title="Tipos de atividades" />} />
                      <Route path="settings/integracoes" element={<SettingsPlaceholder title="Integrações" />} />
                      <Route path="settings/canais" element={<Settings />} />
                      <Route path="settings/armazenamento" element={<SettingsPlaceholder title="Armazenamento" />} />
                      <Route path="settings/wallet" element={<Wallet />} />
                      <Route path="settings/rodizio" element={<SettingsRodizio />} />
                      <Route path="config/mcp-server" element={<MCPServerSettingsPage />} />
                      <Route path="config/custom-fields" element={<CustomFieldsSettingsPage />} />
                      <Route path="config/inbound-webhooks" element={<InboundWebhooksPage />} />
                      <Route path="admin" element={<Admin />} />
                      <Route path="admin/features" element={<AdminFeatures />} />
                    </Route>
                    <Route path="inbox" element={<Navigate to="/chats" replace />} />
                    <Route path="pipeline" element={<Navigate to="/funildevendas" replace />} />
                    <Route path="deals" element={<Navigate to="/funildevendas" replace />} />
                    <Route path="contacts" element={<Navigate to="/funildevendas?tab=banco" replace />} />
                    <Route path="email" element={<Navigate to="/emailmarketing" replace />} />
                    <Route path="goals" element={<Navigate to="/metas" replace />} />
                    <Route path="meetings" element={<Navigate to="/agenda" replace />} />

                    <Route path="cadence" element={<Navigate to="/cadencia" replace />} />
                    <Route path="channels" element={<Navigate to="/settings?tab=channels" replace />} />
                  </Route>

                  <Route path="*" element={<NotFound />} />
                </Routes>
                <VoiceDialer />
                <InsufficientBalanceModal />
              </VoiceProvider>
            </WorkspaceProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </PersistQueryClientProvider>
);

export default App;
