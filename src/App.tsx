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
import Pendencias from "./pages/admin/Pendencias";
import Envios from "./pages/admin/Envios";
import ValidarReprovados from "./pages/admin/ValidarReprovados";
import AdminRelatorios from "./pages/admin/Relatorios";
import Apolices from "./pages/admin/Apolices";
import Empresas from "./pages/admin/Empresas";
import Usuarios from "./pages/admin/Usuarios";
import NotasFiscais from "./pages/admin/NotasFiscais";
import CRM from "./pages/admin/CRM";
import VisaoGeral from "./pages/admin/VisaoGeral";

// Cliente Pages
import Colaboradores from "./pages/cliente/Colaboradores";
import Aprovacao from "./pages/cliente/Aprovacao";
import ClienteRelatorios from "./pages/cliente/Relatorios";
import Reprovacoes from "./pages/cliente/Reprovacoes";
import Obras from "./pages/cliente/Obras";
const queryClient = new QueryClient();
const DashboardLayout = ({
  children
}: {
  children: React.ReactNode;
}) => <SidebarProvider>
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
  </SidebarProvider>;
const App = () => <QueryClientProvider client={queryClient}>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/" element={<ProtectedRoute>
              <Index />
            </ProtectedRoute>} />
          
          {/* Admin Routes */}
          <Route path="/admin/pendencias" element={<ProtectedRoute requireAdmin>
                <DashboardLayout>
                  <Pendencias />
                </DashboardLayout>
              </ProtectedRoute>} />
          <Route path="/admin/envios" element={<ProtectedRoute requireAdmin>
                <DashboardLayout>
                  <Envios />
                </DashboardLayout>
              </ProtectedRoute>} />
          <Route path="/admin/cotacoes" element={<ProtectedRoute requireAdmin>
                <DashboardLayout>
                  <Envios />
                </DashboardLayout>
              </ProtectedRoute>} />
          <Route path="/admin/aprovacoes" element={<ProtectedRoute requireAdmin>
                <DashboardLayout>
                  <Envios />
                </DashboardLayout>
              </ProtectedRoute>} />
          <Route path="/admin/validar-reprovados" element={<ProtectedRoute requireAdmin>
                <DashboardLayout>
                  <ValidarReprovados />
                </DashboardLayout>
              </ProtectedRoute>} />
          <Route path="/admin/relatorios" element={<ProtectedRoute requireAdmin>
                <DashboardLayout>
                  <AdminRelatorios />
                </DashboardLayout>
              </ProtectedRoute>} />
          <Route path="/admin/apolices" element={<ProtectedRoute requireAdmin>
                <DashboardLayout>
                  <Apolices />
                </DashboardLayout>
              </ProtectedRoute>} />
          <Route path="/admin/empresas" element={<ProtectedRoute requireAdmin>
                <DashboardLayout>
                  <Empresas />
                </DashboardLayout>
              </ProtectedRoute>} />
          <Route path="/admin/usuarios" element={<ProtectedRoute requireAdmin>
                <DashboardLayout>
                  <Usuarios />
                </DashboardLayout>
              </ProtectedRoute>} />
          <Route path="/admin/crm" element={<ProtectedRoute requireAdmin>
                <DashboardLayout>
                  <CRM />
                </DashboardLayout>
              </ProtectedRoute>} />
          <Route path="/admin/notas-fiscais" element={<ProtectedRoute requireAdminOrFinanceiro>
                <DashboardLayout>
                  <NotasFiscais />
                </DashboardLayout>
              </ProtectedRoute>} />
          <Route path="/admin/visao-geral" element={<ProtectedRoute requireAdmin>
                <DashboardLayout>
                  <VisaoGeral />
                </DashboardLayout>
              </ProtectedRoute>} />

          {/* Cliente Routes */}
          <Route path="/cliente/obras" element={<ProtectedRoute>
                <DashboardLayout>
                  <Obras />
                </DashboardLayout>
              </ProtectedRoute>} />
          <Route path="/cliente/colaboradores" element={<ProtectedRoute>
                <DashboardLayout>
                  <Colaboradores />
                </DashboardLayout>
              </ProtectedRoute>} />
          <Route path="/cliente/aprovacao" element={<ProtectedRoute>
                <DashboardLayout>
                  <Aprovacao />
                </DashboardLayout>
              </ProtectedRoute>} />
          <Route path="/cliente/relatorios" element={<ProtectedRoute>
                <DashboardLayout>
                  <ClienteRelatorios />
                </DashboardLayout>
              </ProtectedRoute>} />
          <Route path="/cliente/reprovacoes" element={<ProtectedRoute>
                <DashboardLayout>
                  <Reprovacoes />
                </DashboardLayout>
              </ProtectedRoute>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
  </QueryClientProvider>;
export default App;