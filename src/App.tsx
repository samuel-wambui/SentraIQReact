import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./components/auth/AuthProvider";
import { useAuth } from "./components/auth/AuthProvider";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleBasedRoute from "./components/RoleBasedRoute";
import { Layout } from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import SuperUserDashboard from "./pages/SuperUserDashboard";
import NotFound from "./pages/NotFound";
import { useUserRole } from "./hooks/useUserRole";
const Messages = lazy(() => import("./pages/Messages"));
const Reports = lazy(() => import("./pages/Reports"));

const RoleBasedRedirect = () => {
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();

  if (authLoading || roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <Navigate to={role === "super_user" ? "/super-user" : "/dashboard"} replace />;
};

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="flex min-h-[320px] items-center justify-center">
    <p className="text-muted-foreground">Loading...</p>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true }}>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout>
                  </Layout>
                </ProtectedRoute>
              }
            >
              <Route index element={<RoleBasedRedirect />} />
              <Route
                path="dashboard"
                element={
                  <RoleBasedRoute allowedRoles={["agent", "admin", "super_user"]}>
                    <Dashboard />
                  </RoleBasedRoute>
                }
              />
              <Route
                path="admin"
                element={
                  <RoleBasedRoute allowedRoles={["admin", "super_user"]}>
                    <Admin />
                  </RoleBasedRoute>
                }
              />
              <Route
                path="super-user"
                element={
                  <RoleBasedRoute allowedRoles={["super_user"]}>
                    <SuperUserDashboard />
                  </RoleBasedRoute>
                }
              />
              <Route
                path="messages"
                element={
                  <RoleBasedRoute allowedRoles={["admin", "agent", "super_user"]}>
                    <Suspense fallback={<RouteFallback />}>
                      <Messages />
                    </Suspense>
                  </RoleBasedRoute>
                }
              />
              <Route
                path="reports"
                element={
                  <RoleBasedRoute allowedRoles={["admin", "agent", "super_user"]}>
                    <Suspense fallback={<RouteFallback />}>
                      <Reports />
                    </Suspense>
                  </RoleBasedRoute>
                }
              />
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
