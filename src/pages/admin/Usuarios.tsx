import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Plus, Shield, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { NovoUsuarioDialog } from "@/components/admin/NovoUsuarioDialog";
import { EditarUsuarioDialog } from "@/components/admin/EditarUsuarioDialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Usuario {
  id: string;
  nome: string;
  email: string;
  celular: string | null;
  empresa_id: string | null;
  empresas?: {
    nome: string;
  };
  user_roles: {
    role: string;
  }[];
  role: string | null;
}

interface Empresa {
  id: string;
  nome: string;
}

const Usuarios = () => {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUsuario, setEditingUsuario] = useState<Usuario | null>(null);
  const [deletingUsuario, setDeletingUsuario] = useState<Usuario | null>(null);
  const [empresaFilter, setEmpresaFilter] = useState<string>("all");
  const [showVVCSF, setShowVVCSF] = useState(false);
  const { toast } = useToast();
  const { isOperacional, isAdmin } = useUserRole();

  const fetchUsuarios = useCallback(async () => {
    setLoading(true);

    // Buscar profiles
    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("*, empresas:empresa_id(nome)")
      .order("created_at", { ascending: false });

    if (profilesError) {
      setLoading(false);
      return;
    }

    // Buscar roles separadamente
    const { data: rolesData } = await supabase.from("user_roles").select("user_id, role");

    // Combinar os dados
    const usuariosComRoles =
      profilesData?.map((profile) => ({
        ...profile,
        user_roles: rolesData?.filter((role) => role.user_id === profile.id) || [],
        role: rolesData?.find((role) => role.user_id === profile.id)?.role || null,
      })) || [];

    setUsuarios(usuariosComRoles as any);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsuarios();

    // Buscar empresas para o filtro
    const fetchEmpresas = async () => {
      const { data } = await supabase.from("empresas").select("id, nome").order("nome");

      if (data) {
        setEmpresas(data);
      }
    };

    fetchEmpresas();

    // Realtime subscription for profiles and user_roles
    const profilesChannel = supabase
      .channel("profiles-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
        },
        () => {
          fetchUsuarios();
        },
      )
      .subscribe();

    const rolesChannel = supabase
      .channel("roles-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_roles",
        },
        () => {
          fetchUsuarios();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(rolesChannel);
    };
  }, [fetchUsuarios]);

  const admins = usuarios.filter((u) => u.user_roles[0]?.role === "admin").length;
  const operacionais = usuarios.filter((u) => u.user_roles[0]?.role === "operacional").length;
  const financeiros = usuarios.filter((u) => u.user_roles[0]?.role === "financeiro").length;
  const clientes = usuarios.filter((u) => u.user_roles[0]?.role === "cliente").length;

  // Filtrar usuários baseado na visualização
  let usuariosFiltrados = usuarios;

  if (!showVVCSF) {
    // Mostrar apenas clientes
    usuariosFiltrados = usuariosFiltrados.filter((u) => u.user_roles[0]?.role === "cliente");
  } else {
    // Mostrar admin/operacional/financeiro baseado na role do usuário logado
    if (isOperacional) {
      // Operacional vê apenas operacionais e financeiros
      usuariosFiltrados = usuariosFiltrados.filter(
        (u) => u.user_roles[0]?.role === "operacional" || u.user_roles[0]?.role === "financeiro"
      );
    } else if (isAdmin) {
      // Admin vê admin, operacional e financeiro
      usuariosFiltrados = usuariosFiltrados.filter(
        (u) => u.user_roles[0]?.role === "admin" || 
               u.user_roles[0]?.role === "operacional" ||
               u.user_roles[0]?.role === "financeiro"
      );
    }
  }

  // Aplicar filtro de empresa
  if (empresaFilter !== "all") {
    usuariosFiltrados = usuariosFiltrados.filter((u) => u.empresa_id === empresaFilter);
  }

  const handleDelete = useCallback(async () => {
    if (!deletingUsuario) return;

    try {
      const { error } = await supabase.functions.invoke("delete-user", {
        body: { user_id: deletingUsuario.id },
      });

      if (error) throw error;

      toast({
        title: "Usuário excluído!",
        description: "O usuário foi excluído com sucesso.",
      });

      setDeletingUsuario(null);
      fetchUsuarios();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir usuário",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [deletingUsuario, fetchUsuarios]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Usuários</h1>
          <p className="text-muted-foreground">Gerencie os usuários e permissões do sistema</p>
        </div>
        <div className="flex gap-2">
          <Button variant={showVVCSF ? "default" : "outline"} size="sm" onClick={() => setShowVVCSF(!showVVCSF)}>
            {showVVCSF ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            Usuários VV
          </Button>
          <NovoUsuarioDialog onSuccess={fetchUsuarios} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{showVVCSF ? "Usuários VV" : "Total de Clientes"}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usuariosFiltrados.length}</div>
            <p className="text-xs text-muted-foreground">usuários {showVVCSF ? "VV" : "clientes"}</p>
          </CardContent>
        </Card>

        {showVVCSF && !isOperacional && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Administradores</CardTitle>
              <Shield className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{admins}</div>
              <p className="text-xs text-muted-foreground">usuários admin</p>
            </CardContent>
          </Card>
        )}

        {showVVCSF && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Operacionais</CardTitle>
              <Shield className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{operacionais}</div>
              <p className="text-xs text-muted-foreground">usuários operacionais</p>
            </CardContent>
          </Card>
        )}

        {!showVVCSF && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{clientes}</div>
              <p className="text-xs text-muted-foreground">usuários cliente</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuários</CardTitle>
          <CardDescription>Todos os usuários cadastrados no sistema</CardDescription>
          <div className="mt-4">
            <Select value={empresaFilter} onValueChange={setEmpresaFilter}>
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue placeholder="Filtrar por empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as empresas</SelectItem>
                {empresas.map((empresa) => (
                  <SelectItem key={empresa.id} value={empresa.id}>
                    {empresa.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : usuariosFiltrados.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>
                {empresaFilter !== "all" ? "Nenhum usuário encontrado para esta empresa" : "Nenhum usuário cadastrado"}
              </p>
              <p className="text-sm mt-2">Clique em "Novo Usuário" para adicionar o primeiro</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usuariosFiltrados.map((usuario) => {
                  const role = usuario.user_roles[0]?.role;
                  return (
                    <TableRow key={usuario.id}>
                      <TableCell className="font-medium">{usuario.nome}</TableCell>
                      <TableCell>{usuario.email}</TableCell>
                      <TableCell>
                        <Badge variant={
                          role === "admin" || role === "operacional" || role === "financeiro" 
                            ? "default" 
                            : "secondary"
                        }>
                          {role === "admin" 
                            ? "Administrador" 
                            : role === "operacional" 
                            ? "Operacional" 
                            : role === "financeiro"
                            ? "Financeiro"
                            : "Cliente"}
                        </Badge>
                      </TableCell>
                      <TableCell>{usuario.empresas?.nome || "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => setEditingUsuario(usuario)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeletingUsuario(usuario)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {editingUsuario && (
        <EditarUsuarioDialog
          usuario={editingUsuario}
          open={!!editingUsuario}
          onOpenChange={(open) => !open && setEditingUsuario(null)}
          onSuccess={fetchUsuarios}
        />
      )}

      <AlertDialog open={!!deletingUsuario} onOpenChange={(open) => !open && setDeletingUsuario(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o usuário "{deletingUsuario?.nome}"? Esta ação não pode ser desfeita e
              todos os dados associados serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Usuarios;
