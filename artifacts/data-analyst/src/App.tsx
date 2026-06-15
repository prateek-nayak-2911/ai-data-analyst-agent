import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/contexts/auth-context";
import { Layout } from "@/components/layout";
import { ProtectedRoute } from "@/components/protected-route";
import NotFound from "@/pages/not-found";

import LoginPage from "@/pages/login";
import SignupPage from "@/pages/signup";
import DashboardPage from "@/pages/dashboard";
import UploadPage from "@/pages/upload";
import AnalysisPage from "@/pages/analysis";
import ChatPage from "@/pages/chat";
import ReportsPage from "@/pages/reports";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppRoutes() {
  return (
    <Switch>
      {/* Public auth routes */}
      <Route path="/login" component={LoginPage} />
      <Route path="/signup" component={SignupPage} />

      {/* Protected app routes wrapped in Layout */}
      <Route path="/dashboard">
        <ProtectedRoute>
          <Layout>
            <DashboardPage />
          </Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/">
        <ProtectedRoute>
          <Layout>
            <UploadPage />
          </Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/analysis/:id">
        {(params) => (
          <ProtectedRoute>
            <Layout>
              <AnalysisPage />
            </Layout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/chat/:id">
        {(params) => (
          <ProtectedRoute>
            <Layout>
              <ChatPage />
            </Layout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/reports">
        <ProtectedRoute>
          <Layout>
            <ReportsPage />
          </Layout>
        </ProtectedRoute>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="data-agent-theme">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <AppRoutes />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
