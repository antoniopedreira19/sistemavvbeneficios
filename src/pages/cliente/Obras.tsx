import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { NovaObraDialog } from "@/components/cliente/NovaObraDialog";
import { EditarObraDialog } from "@/components/cliente/EditarObraDialog";

interface Obra {
  id: string;
  empresa_id: string;
  nome: string;
  status: string;
  data_previsao_termino: string | null;
  created_at: string;
}

export default function Obras() {
  const { profile } = useUserRole();
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingObra, setEditingObra] = useState<Obra | null>(null);
  const [deletingObra, setDeletingObra] = useState<Obra | null>(null);
  const [showNovaObra, setShowNovaObra] = useState(false);

  const fetchObras = useCallback(async () => {
    if (!profile?.empresa_id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("obras")
        .select("*")
        .eq("empresa_id", profile.empresa_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setObras(data || []);
    } catch (error) {
      console.error("Erro ao buscar obras:", error);
      toast.error("Erro ao carregar obras");
    } finally {
      setLoading(false);
    }
  }, [profile?.empresa_id]);

  useEffect(() => {
    fetchObras();
  }, [fetchObras]);

  const handleDelete = useCallback(async (obra: Obra) => {
    try {
      const { error } = await supabase
        .from("obras")
        .delete()
        .eq("id", obra.id);

      if (error) throw error;

      toast.success("Obra excluída com sucesso");
      fetchObras();
    } catch (error) {
      console.error("Erro ao excluir obra:", error);
      toast.error("Erro ao excluir obra");
    } finally {
      setDeletingObra(null);
    }
  }, [fetchObras]);

  const obrasFiltradas = obras.filter((obra) =>
    obra.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const obrasAtivas = obrasFiltradas.filter((o) => o.status === "ativa").length;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Obras</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie as obras da sua empresa
          </p>
        </div>
        <Button onClick={() => setShowNovaObra(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Obra
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Obras</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{obras.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Obras Ativas</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{obrasAtivas}</div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Input
          placeholder="Buscar obra..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Previsão de Término</TableHead>
                <TableHead>Data de Criação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : obrasFiltradas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    Nenhuma obra encontrada
                  </TableCell>
                </TableRow>
              ) : (
                obrasFiltradas.map((obra) => (
                  <TableRow key={obra.id}>
                    <TableCell className="font-medium">{obra.nome}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          obra.status === "ativa"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {obra.status === "ativa" ? "Ativa" : "Inativa"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {obra.data_previsao_termino
                        ? new Date(obra.data_previsao_termino).toLocaleDateString("pt-BR")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {new Date(obra.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingObra(obra)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingObra(obra)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <NovaObraDialog
        open={showNovaObra}
        onOpenChange={setShowNovaObra}
        onSuccess={fetchObras}
      />

      {editingObra && (
        <EditarObraDialog
          open={!!editingObra}
          onOpenChange={(open) => !open && setEditingObra(null)}
          obra={editingObra}
          onSuccess={fetchObras}
        />
      )}

      <AlertDialog
        open={!!deletingObra}
        onOpenChange={(open) => !open && setDeletingObra(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a obra "{deletingObra?.nome}"? Esta
              ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingObra && handleDelete(deletingObra)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
