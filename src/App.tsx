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
import Meetings from "@/pages/app/Meetings";
import Automations from "@/pages/app/Automations";
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
import Admin from "@/pages/admin/Admin";
import GoogleCallback from "@/pages/auth/GoogleCallback";
import SettingsRodizio from "@/pages/SettingsRodizio";
import NotFound from "@/pages/NotFound";
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
                    <Route path="reunioes" element={<Meetings />} />
                    <Route path="agenda" element={<Agenda />} />
                    <Route path="calls" element={<Calls />} />
                    <Route path="discador" element={<Dialer />} />
                    <Route path="discador/:id" element={<DialerRun />} />
                    <Route path="cadencia" element={<Cadence />} />
                    <Route path="outreach-flows" element={<Cadence />} />
                    <Route path="automacoes" element={<Automations />} />
                    <Route path="automations" element={<Automations />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="prospeccao" element={<Prospeccao />} />
                    <Route path="equipe-online" element={<EquipeOnline />} />
                    <Route path="pagamentos" element={<Payments />} />
                    <Route path="settings/wallet" element={<Wallet />} />
                    <Route path="settings/rodizio" element={<SettingsRodizio />} />
                    <Route path="admin" element={<Admin />} />
                    <Route path="admin/features" element={<AdminFeatures />} />

                    {/* Redirects legados */}
                    <Route path="inbox" element={<Navigate to="/chats" replace />} />
                    <Route path="pipeline" element={<Navigate to="/funildevendas" replace />} />
                    <Route path="deals" element={<Navigate to="/funildevendas" replace />} />
                    <Route path="contacts" element={<Navigate to="/funildevendas?tab=banco" replace />} />
                    <Route path="email" element={<Navigate to="/emailmarketing" replace />} />
                    <Route path="goals" element={<Navigate to="/metas" replace />} />
                    <Route path="meetings" element={<Navigate to="/reunioes" replace />} />
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
