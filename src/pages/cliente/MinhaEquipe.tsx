import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Users, Search, UserPlus, Trash2, FileSpreadsheet, Pencil, UserX, RefreshCw } from "lucide-react";

import { NovoColaboradorDialog } from "@/components/cliente/NovoColaboradorDialog";
import { ImportarColaboradoresDialog } from "@/components/cliente/ImportarColaboradoresDialog";
import { EditarColaboradorDialog } from "@/components/cliente/EditarColaboradorDialog";
import { formatCPF, formatCurrency } from "@/lib/utils";

export default function MinhaEquipe() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [showDesligados, setShowDesligados] = useState(false);

  // Dialogs
  const [novoColaboradorOpen, setNovoColaboradorOpen] = useState(false);
  const [importarOpen, setImportarOpen] = useState(false);
  const [colaboradorParaEditar, setColaboradorParaEditar] = useState<any | null>(null);
  const [colaboradorParaDesligar, setColaboradorParaDesligar] = useState<any | null>(null);

  // --- QUERY ---
  const { data: colaboradores = [], isLoading } = useQuery({
    queryKey: ["minha-equipe", user?.id, showDesligados], // Recarrega quando muda o filtro
    enabled: !!user,
    queryFn: async () => {
      // 1. Pega ID da empresa do usuário
      const { data: perfil } = await supabase.from("perfis").select("empresa_id").eq("id", user!.id).single();

      if (!perfil?.empresa_id) return [];

      // 2. Monta a query
      let query = supabase.from("colaboradores").select("*").eq("empresa_id", perfil.empresa_id).order("nome");

      // 3. Aplica o filtro de status
      if (!showDesligados) {
        query = query.eq("status", "ativo");
      } else {
        // Se mostrar desligados, traz tudo, mas ordenamos ativos primeiro
        query = query.in("status", ["ativo", "desligado"]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // --- MUTATION: DESLIGAR (SOFT DELETE) ---
  const desligarMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("colaboradores")
        .update({
          status: "desligado",
          // Opcional: Se você tiver um campo data_desligamento no banco, descomente abaixo
          // data_desligamento: new Date().toISOString()
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Colaborador desligado com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["minha-equipe"] });
      setColaboradorParaDesligar(null);
    },
    onError: (e: any) => {
      toast.error("Erro ao desligar: " + e.message);
    },
  });

  // --- MUTATION: REATIVAR (BÔNUS) ---
  const reativarMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("colaboradores").update({ status: "ativo" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Colaborador reativado!");
      queryClient.invalidateQueries({ queryKey: ["minha-equipe"] });
    },
  });

  // Filtragem no Frontend (Busca por nome/CPF)
  const filteredColaboradores = colaboradores.filter(
    (c) => c.nome.toLowerCase().includes(searchTerm.toLowerCase()) || c.cpf.includes(searchTerm),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Minha Equipe</h1>
            <p className="text-muted-foreground">Gerencie seus colaboradores ativos e desligados</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => setImportarOpen(true)}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Importar Planilha
          </Button>
          <Button onClick={() => setNovoColaboradorOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" /> Novo Colaborador
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle>Colaboradores ({filteredColaboradores.length})</CardTitle>

            <div className="flex flex-col md:flex-row items-center gap-4">
              {/* Toggle Mostrar Desligados */}
              <div className="flex items-center space-x-2 bg-secondary/30 p-2 rounded-lg border">
                <Switch id="show-desligados" checked={showDesligados} onCheckedChange={setShowDesligados} />
                <Label htmlFor="show-desligados" className="cursor-pointer text-sm font-medium">
                  Mostrar Desligados
                </Label>
              </div>

              {/* Busca */}
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar nome ou CPF..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Cargo/Função</TableHead>
                  <TableHead>Salário</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Carregando equipe...
                    </TableCell>
                  </TableRow>
                ) : filteredColaboradores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum colaborador encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredColaboradores.map((colaborador) => (
                    <TableRow
                      key={colaborador.id}
                      className={colaborador.status === "desligado" ? "bg-muted/50 opacity-70" : ""}
                    >
                      <TableCell className="font-medium">{colaborador.nome}</TableCell>
                      <TableCell>{formatCPF(colaborador.cpf)}</TableCell>
                      <TableCell>{colaborador.funcao || "-"}</TableCell>
                      <TableCell>{colaborador.salario ? formatCurrency(colaborador.salario) : "-"}</TableCell>
                      <TableCell className="text-center">
                        {colaborador.status === "ativo" ? (
                          <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Desligado</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setColaboradorParaEditar(colaborador)}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4 text-blue-600" />
                          </Button>

                          {colaborador.status === "ativo" ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setColaboradorParaDesligar(colaborador)}
                              title="Desligar Colaborador"
                            >
                              <UserX className="h-4 w-4 text-red-600" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => reativarMutation.mutate(colaborador.id)}
                              title="Reativar Colaborador"
                            >
                              <RefreshCw className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <NovoColaboradorDialog
        open={novoColaboradorOpen}
        onOpenChange={setNovoColaboradorOpen}
        empresaId="" // O hook interno vai pegar
      />

      <ImportarColaboradoresDialog
        open={importarOpen}
        onOpenChange={setImportarOpen}
        empresaId="" // O hook vai resolver
        obraId=""
        competencia="Base"
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["minha-equipe"] })}
      />

      {colaboradorParaEditar && (
        <EditarColaboradorDialog
          colaborador={colaboradorParaEditar}
          open={!!colaboradorParaEditar}
          onOpenChange={(open) => !open && setColaboradorParaEditar(null)}
        />
      )}

      <AlertDialog open={!!colaboradorParaDesligar} onOpenChange={(o) => !o && setColaboradorParaDesligar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desligar Colaborador?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja desligar <strong>{colaboradorParaDesligar?.nome}</strong>?<br />
              Ele deixará de aparecer nas listas ativas e no faturamento futuro, mas o histórico será mantido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => colaboradorParaDesligar && desligarMutation.mutate(colaboradorParaDesligar.id)}
            >
              Confirmar Desligamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
