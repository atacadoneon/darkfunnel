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

import Login from "@/pages/auth/Login";
import Signup from "@/pages/auth/Signup";
import ForgotPassword from "@/pages/auth/ForgotPassword";
import ResetPassword from "@/pages/auth/ResetPassword";
import AppLayout from "@/layouts/AppLayout";
import Inbox from "@/pages/app/Inbox";
import Settings from "@/pages/app/Settings";
import Pipeline from "@/pages/app/Pipeline";
import Placeholder from "@/pages/app/Placeholder";
import Dashboard from "@/pages/app/Dashboard";
import Contacts from "@/pages/app/Contacts";
import Tasks from "@/pages/app/Tasks";
import Meetings from "@/pages/app/Meetings";
import AdminFeatures from "@/pages/admin/Features";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Show cached data instantly, refetch in background
      staleTime: 60_000,
      gcTime: 1000 * 60 * 60 * 24, // keep 24h in memory/storage
      refetchOnWindowFocus: false,
      refetchOnMount: "always", // always revalidate but show cache first
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
    persistOptions={{
      persister,
      maxAge: 1000 * 60 * 60 * 24, // 24h
      buster: "v1",
    }}
  >
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <WorkspaceProvider>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />

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
                  <Route path="funildevendas" element={<Pipeline />} />
                  <Route path="negocios" element={<Navigate to="/funildevendas" replace />} />
                  <Route path="emailmarketing" element={<Placeholder title="Email Marketing" />} />
                  <Route path="metas" element={<Placeholder title="Metas" />} />
                  <Route path="tarefas" element={<Tasks />} />
                  <Route path="reunioes" element={<Meetings />} />
                  <Route path="quiz" element={<Placeholder title="Quiz" />} />
                  <Route path="cadencia" element={<Placeholder title="Fluxo de Cadência" />} />
                  <Route path="automacoes" element={<Placeholder title="Automações" />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="admin/features" element={<AdminFeatures />} />

                  {/* Redirects de rotas antigas em inglês */}
                  <Route path="inbox" element={<Navigate to="/chats" replace />} />
                  <Route path="pipeline" element={<Navigate to="/funildevendas" replace />} />
                  <Route path="deals" element={<Navigate to="/funildevendas" replace />} />
                  <Route path="contacts" element={<Navigate to="/funildevendas?tab=banco" replace />} />
                  <Route path="email" element={<Navigate to="/emailmarketing" replace />} />
                  <Route path="goals" element={<Navigate to="/metas" replace />} />
                  <Route path="tasks" element={<Navigate to="/tarefas" replace />} />
                  <Route path="meetings" element={<Navigate to="/reunioes" replace />} />
                  <Route path="cadence" element={<Navigate to="/cadencia" replace />} />
                  <Route path="automations" element={<Navigate to="/automacoes" replace />} />
                  <Route path="channels" element={<Navigate to="/settings?tab=channels" replace />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </WorkspaceProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </PersistQueryClientProvider>
);

export default App;
