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
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <WorkspaceProvider>
              <Routes>
                <Route path="/" element={<Navigate to="/app" replace />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />

                <Route
                  path="/app"
                  element={
                    <RequireAuth>
                      <AppLayout />
                    </RequireAuth>
                  }
                >
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="inbox" element={<Inbox />} />
                  <Route path="contacts" element={<Navigate to="/app/pipeline?tab=banco" replace />} />
                  <Route path="pipeline" element={<Pipeline />} />
                  <Route path="deals" element={<Navigate to="/app/pipeline" replace />} />
                  <Route path="email" element={<Placeholder title="Email Marketing" />} />
                  <Route path="goals" element={<Placeholder title="Metas" />} />
                  <Route path="tasks" element={<Placeholder title="Tarefas" />} />
                  <Route path="meetings" element={<Placeholder title="Reuniões" />} />
                  <Route path="quiz" element={<Placeholder title="Quiz" />} />
                  <Route path="cadence" element={<Placeholder title="Fluxo de Cadência" />} />
                  <Route path="automations" element={<Placeholder title="Automações" />} />
                  <Route path="channels" element={<Navigate to="/app/settings?tab=channels" replace />} />
                  <Route path="settings" element={<Settings />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </WorkspaceProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
