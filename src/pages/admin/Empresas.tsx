import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Plus, Pencil, Trash2, Search } from "lucide-react";
import { formatTelefone, formatEmail } from "@/lib/validators";
import { NovaEmpresaDialog } from "@/components/admin/NovaEmpresaDialog";
import { EditarEmpresaDialog } from "@/components/admin/EditarEmpresaDialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

interface Empresa {
  id: string;
  nome: string;
  nome_responsavel: string | null;
  cnpj: string;
  email_contato: string | null;
  telefone_contato: string | null;
  status: 'ativa' | 'em_implementacao';
  created_at: string;
}

const Empresas = () => {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingEmpresa, setEditingEmpresa] = useState<Empresa | null>(null);
  const [deletingEmpresa, setDeletingEmpresa] = useState<Empresa | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();

  const fetchEmpresas = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("empresas")
      .select("*")
      .order("nome", { ascending: true });

    if (!error) {
      setEmpresas(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEmpresas();

    // Realtime subscription
    const channel = supabase
      .channel('empresas-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'empresas'
        },
        () => {
          fetchEmpresas();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const empresasThisMonth = empresas.filter(e => {
    const created = new Date(e.created_at);
    const now = new Date();
    return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
  }).length;

  // Filtrar empresas por busca e status
  const empresasFiltradas = empresas.filter(e => {
    const matchesSearch = e.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.cnpj.includes(searchTerm);
    const matchesStatus = statusFilter === "all" || e.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleDelete = useCallback(async () => {
    if (!deletingEmpresa) return;

    try {
      const { error } = await supabase
        .from("empresas")
        .delete()
        .eq("id", deletingEmpresa.id);

      if (error) throw error;

      toast({
        title: "Empresa excluída!",
        description: "A empresa foi excluída com sucesso.",
      });

      setDeletingEmpresa(null);
      fetchEmpresas();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir empresa",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [deletingEmpresa, fetchEmpresas]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Empresas</h1>
          <p className="text-muted-foreground">Gerencie as empresas clientes</p>
        </div>
        <NovaEmpresaDialog onSuccess={fetchEmpresas} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Empresas</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{empresas.length}</div>
            <p className="text-xs text-muted-foreground">empresas ativas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Novas este Mês</CardTitle>
            <Plus className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{empresasThisMonth}</div>
            <p className="text-xs text-muted-foreground">cadastros recentes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Vidas</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">colaboradores no total</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Empresas</CardTitle>
          <CardDescription>Todas as empresas cadastradas no sistema</CardDescription>
          <div className="flex gap-4 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou CNPJ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="ativa">Ativa</SelectItem>
                <SelectItem value="em_implementacao">Em Implementação</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : empresasFiltradas.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>{searchTerm ? "Nenhuma empresa encontrada" : "Nenhuma empresa cadastrada"}</p>
              <p className="text-sm mt-2">Clique em "Nova Empresa" para adicionar a primeira</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Nome</TableHead>
                  <TableHead className="w-[150px]">CNPJ</TableHead>
                  <TableHead className="max-w-[250px]">Email</TableHead>
                  <TableHead className="w-[140px]">Telefone</TableHead>
                  <TableHead className="w-[130px]">Status</TableHead>
                  <TableHead className="text-right w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {empresasFiltradas.map((empresa) => (
                  <TableRow key={empresa.id}>
                    <TableCell className="font-medium">{empresa.nome}</TableCell>
                    <TableCell>{empresa.cnpj}</TableCell>
                    <TableCell className="max-w-[250px] truncate">{formatEmail(empresa.email_contato || "")}</TableCell>
                    <TableCell>{formatTelefone(empresa.telefone_contato || "")}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        empresa.status === 'ativa' 
                          ? 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20' 
                          : 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20'
                      }`}>
                        {empresa.status === 'ativa' ? 'Ativa' : 'Em Implementação'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingEmpresa(empresa)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingEmpresa(empresa)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {editingEmpresa && (
        <EditarEmpresaDialog
          empresa={editingEmpresa}
          open={!!editingEmpresa}
          onOpenChange={(open) => !open && setEditingEmpresa(null)}
          onSuccess={fetchEmpresas}
        />
      )}

      <AlertDialog open={!!deletingEmpresa} onOpenChange={(open) => !open && setDeletingEmpresa(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a empresa "{deletingEmpresa?.nome}"? Esta ação não pode ser desfeita.
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

export default Empresas;
