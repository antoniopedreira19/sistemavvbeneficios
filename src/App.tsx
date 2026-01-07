import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";

// Admin Pages
import Dashboard from "./pages/admin/Dashboard";
import Operacional from "./pages/admin/Operacional";
import NotasFiscais from "./pages/admin/NotasFiscais";
import HistoricoAdmin from "./pages/admin/HistoricoAdmin";
import AdminEmpresas from "./pages/admin/AdminEmpresas";
import Configuracoes from "./pages/admin/Configuracoes";

// Cliente Pages
import ClienteDashboard from "./pages/cliente/ClienteDashboard";
import MinhaEquipe from "./pages/cliente/MinhaEquipe";
import Historico from "./pages/cliente/Historico";

const queryClient = new QueryClient();

const DashboardLayout = ({ children }: { children: React.ReactNode }) => (
  <SidebarProvider>
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <div className="flex-1 flex flex-col">
        <header className="h-14 border-b border-border flex items-center px-4 bg-card">
          <SidebarTrigger />
          <h1 className="ml-4 font-semibold">VV Benefícios</h1>
        </header>
        <main className="flex-1 p-6 bg-background">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  </SidebarProvider>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Index />
            </ProtectedRoute>
          }
        />

        {/* Admin Routes */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute requireAdmin>
              <DashboardLayout>
                <Dashboard />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/operacional"
          element={
            <ProtectedRoute requireAdmin>
              <DashboardLayout>
                <Operacional />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/financeiro"
          element={
            <ProtectedRoute requireAdminOrFinanceiro>
              <DashboardLayout>
                <NotasFiscais />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/empresas"
          element={
            <ProtectedRoute requireAdmin>
              <DashboardLayout>
                <AdminEmpresas />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/historico"
          element={
            <ProtectedRoute requireAdmin>
              <DashboardLayout>
                <HistoricoAdmin />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/configuracoes"
          element={
            <ProtectedRoute requireAdminOnly>
              <DashboardLayout>
                <Configuracoes />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        {/* Cliente Routes */}
        <Route
          path="/cliente/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <ClienteDashboard />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/cliente/minha-equipe"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <MinhaEquipe />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/cliente/historico"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Historico />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
