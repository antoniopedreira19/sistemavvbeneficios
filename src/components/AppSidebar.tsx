import { LayoutDashboard, Briefcase, Receipt, Building2, Settings, Upload, Users, History, LogOut, UserCog, ShieldCheck } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import EditarPerfilDialog from "@/components/cliente/EditarPerfilDialog";

const adminItems = [
  { title: "Visão Geral", url: "/admin/dashboard", icon: LayoutDashboard },
  { title: "Operacional", url: "/admin/operacional", icon: Briefcase },
  { title: "Financeiro", url: "/admin/financeiro", icon: Receipt, adminOrFinanceiro: true },
  { title: "Histórico", url: "/admin/historico", icon: History },
  { title: "Empresas", url: "/admin/empresas", icon: Building2 },
  { title: "Configurações", url: "/admin/configuracoes", icon: Settings, adminOnly: true },
];

const financeiroItems = [
  { title: "Financeiro", url: "/admin/financeiro", icon: Receipt },
];

const clienteItems = [
  { title: "Painel", url: "/cliente/dashboard", icon: Upload },
  { title: "Minha Equipe", url: "/cliente/minha-equipe", icon: Users },
  { title: "Histórico", url: "/cliente/historico", icon: History },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { isAdmin, isOperacional, isCliente, isFinanceiro, isAdminOrOperacional } = useUserRole();
  const { signOut } = useAuth();
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";
  const [editarPerfilOpen, setEditarPerfilOpen] = useState(false);

  const items = isFinanceiro
    ? financeiroItems
    : isAdminOrOperacional 
    ? adminItems.filter(item => {
        if (item.adminOnly) {
          return isAdmin;
        }
        if (item.adminOrFinanceiro) {
          return isAdmin || isFinanceiro;
        }
        return true;
      })
    : clienteItems;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <div className="shrink-0">
            <ShieldCheck 
              className={`text-sidebar-foreground ${collapsed ? 'h-6 w-6' : 'h-10 w-10'}`} 
              strokeWidth={1.5} 
            />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-sidebar-foreground">VV Benefícios</h2>
              <p className="text-xs text-sidebar-foreground/70 truncate">
                {isAdmin ? "Administrador" : isOperacional ? "Operacional" : isFinanceiro ? "Financeiro" : "Cliente"}
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{isAdminOrOperacional ? "Admin" : isFinanceiro ? "Financeiro" : "Menu"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="space-y-2">
          {isCliente && (
            <Button
              variant="ghost"
              size={collapsed ? "icon" : "default"}
              onClick={() => setEditarPerfilOpen(true)}
              className="w-full justify-start"
            >
              <UserCog className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="ml-2">Editar Perfil</span>}
            </Button>
          )}
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "default"}
            onClick={signOut}
            className="w-full justify-start"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="ml-2">Sair</span>}
          </Button>
        </div>
      </SidebarFooter>

      {isCliente && (
        <EditarPerfilDialog 
          open={editarPerfilOpen} 
          onOpenChange={setEditarPerfilOpen} 
        />
      )}
    </Sidebar>
  );
}
