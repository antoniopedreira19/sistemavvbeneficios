import { useState } from "react";
import {
  Users,
  Search,
  Plus,
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Upload,
  Info,
  Pencil,
  Building, // Ícone para Nova Obra
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"; // Mantido apenas para o Select de Obra (Importação)

import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Componentes Dialogs
import { ImportarColaboradoresDialog } from "@/components/cliente/ImportarColaboradoresDialog";
import { EditarColaboradorDialog } from "@/components/cliente/EditarColaboradorDialog";
import { NovaObraDialog } from "@/components/cliente/NovaObraDialog";
import { NovoColaboradorDialog } from "@/components/cliente/NovoColaboradorDialog";

const ITEMS_PER_PAGE = 10;

const MinhaEquipe = () => {
  const { profile, loading: profileLoading } = useUserRole();
  const empresaId = profile?.empresa_id;
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedObra, setSelectedObra] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Estados dos Modais
  const [isNovaObraOpen, setIsNovaObraOpen] = useState(false);
  const [isNovoColaboradorOpen, setIsNovoColaboradorOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isSelectObraDialogOpen, setIsSelectObraDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Estados de Seleção
  const [obraParaImportar, setObraParaImportar] = useState<string | null>(null);
  const [colaboradorParaEditar, setColaboradorParaEditar] = useState<any>(null);

  // Competência atual
  const now = new Date();
  const competenciaAtual = format(now, "MMMM/yyyy", { locale: ptBR });
  const competenciaAtualCapitalized = competenciaAtual.charAt(0).toUpperCase() + competenciaAtual.slice(1);

  // Buscar obras da empresa
  const { data: obras, isLoading: obrasLoading } = useQuery({
    queryKey: ["obras", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data, error } = await supabase
        .from("obras")
        .select("id, nome")
        .eq("empresa_id", empresaId)
        .eq("status", "ativa")
        .order("nome");
      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaId,
  });

  // Buscar colaboradores com filtros e paginação
  const { data: colaboradoresData, isLoading: colaboradoresLoading } = useQuery({
    queryKey: ["colaboradores", empresaId, selectedObra, searchTerm, currentPage],
    queryFn: async () => {
      if (!empresaId) return { data: [], count: 0 };

      let query = supabase
        .from("colaboradores")
        .select("*, obras(nome)", { count: "exact" })
        .eq("empresa_id", empresaId);

      // Filtro por obra
      if (selectedObra !== "all") {
        query = query.eq("obra_id", selectedObra);
      }

      // Filtro por busca (nome ou CPF)
      if (searchTerm) {
        query = query.or(`nome.ilike.%${searchTerm}%,cpf.ilike.%${searchTerm}%`);
      }

      // Paginação
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const { data, error, count } = await query.order("nome").range(from, to);

      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
    enabled: !!empresaId,
  });

  // Estatísticas
  const { data: stats } = useQuery({
    queryKey: ["colaboradores-stats", empresaId],
    queryFn: async () => {
      if (!empresaId) return { total: 0, ativos: 0, afastados: 0 };

      const { count: total } = await supabase
        .from("colaboradores")
        .select("*", { count: "exact", head: true })
        .eq("empresa_id", empresaId);

      const { count: ativos } = await supabase
        .from("colaboradores")
        .select("*", { count: "exact", head: true })
        .eq("empresa_id", empresaId)
        .eq("status", "ativo")
        .eq("afastado", false);

      const { count: afastados } = await supabase
        .from("colaboradores")
        .select("*", { count: "exact", head: true })
        .eq("empresa_id", empresaId)
        .eq("afastado", true);

      return {
        total: total || 0,
        ativos: ativos || 0,
        afastados: afastados || 0,
      };
    },
    enabled: !!empresaId,
  });

  const colaboradores = colaboradoresData?.data || [];
  const totalCount = colaboradoresData?.count || 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const formatCurrency = (value: number | null) => {
    if (!value) return "-";
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const getStatusBadge = (colaborador: any) => {
    if (colaborador.afastado) {
      return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Afastado</Badge>;
    }
    if (colaborador.status === "ativo") {
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Ativo</Badge>;
    }
    return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Desligado</Badge>;
  };

  // Handlers
  const handleOpenImport = () => {
    setIsSelectObraDialogOpen(true);
  };

  const handleSelectObraParaImportar = (obraId: string) => {
    setObraParaImportar(obraId);
    setIsSelectObraDialogOpen(false);
    setIsImportDialogOpen(true);
  };

  const handleImportSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["colaboradores"] });
    queryClient.invalidateQueries({ queryKey: ["colaboradores-stats"] });
  };

  const handleEditColaborador = (colaborador: any) => {
    setColaboradorParaEditar(colaborador);
    setIsEditDialogOpen(true);
  };

  const handleEditSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["colaboradores"] });
    queryClient.invalidateQueries({ queryKey: ["colaboradores-stats"] });
  };

  const handleNovaObraSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["obras"] });
  };

  const handleNovoColaboradorSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["colaboradores"] });
    queryClient.invalidateQueries({ queryKey: ["colaboradores-stats"] });
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Minha Equipe</h1>
            <p className="text-muted-foreground">Gestão de obras e colaboradores</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Botão Nova Obra */}
          <Button variant="outline" className="gap-2" onClick={() => setIsNovaObraOpen(true)}>
            <Building className="h-4 w-4" />
            Nova Obra
          </Button>

          {/* Botão Importar */}
          <Button onClick={handleOpenImport} variant="outline" className="gap-2">
            <Upload className="h-4 w-4" />
            Importar Lista
          </Button>

          {/* Botão Novo Colaborador */}
          <Button className="gap-2" onClick={() => setIsNovoColaboradorOpen(true)}>
            <Plus className="h-4 w-4" />
            Novo Colaborador
          </Button>
        </div>
      </div>

      {/* Alerta informativo */}
      <Alert className="bg-blue-500/5 border-blue-500/20">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-sm">
          <strong>Como enviar a lista mensal:</strong> Clique em "Importar Lista" para carregar a planilha de
          colaboradores. Depois, vá ao <strong>Painel</strong> para enviar a lista para processamento.
        </AlertDescription>
      </Alert>

      {/* Resumo Estatístico */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Colaboradores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.ativos || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Afastados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats?.afastados || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou CPF..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="sm:w-64">
              <Select
                value={selectedObra}
                onValueChange={(value) => {
                  setSelectedObra(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Filtrar por obra" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Obras</SelectItem>
                  {obrasLoading ? (
                    <SelectItem value="loading" disabled>
                      Carregando...
                    </SelectItem>
                  ) : (
                    obras?.map((obra) => (
                      <SelectItem key={obra.id} value={obra.id}>
                        {obra.nome}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="pt-6">
          {colaboradoresLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Salário</TableHead>
                    <TableHead>Obra</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {colaboradores.length > 0 ? (
                    colaboradores.map((colab: any) => (
                      <TableRow
                        key={colab.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleEditColaborador(colab)}
                      >
                        <TableCell className="font-medium">{colab.nome}</TableCell>
                        <TableCell className="text-muted-foreground">{colab.cpf}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{colab.cargo || "-"}</Badge>
                        </TableCell>
                        <TableCell>{formatCurrency(colab.salario)}</TableCell>
                        <TableCell className="text-muted-foreground">{colab.obras?.nome || "-"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(colab)}
                            <Pencil className="h-3 w-3 text-muted-foreground" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        Nenhum colaborador encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* Paginação */}
              {totalCount > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1}-
                    {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} de {totalCount}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Página {currentPage} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* --- DIALOGS --- */}

      {/* 1. Seleção de Obra para Importar */}
      <Dialog open={isSelectObraDialogOpen} onOpenChange={setIsSelectObraDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Selecionar Obra</DialogTitle>
            <DialogDescription>Escolha a obra para importar a lista de colaboradores</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {obrasLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : obras && obras.length > 0 ? (
              obras.map((obra) => (
                <Button
                  key={obra.id}
                  variant="outline"
                  className="w-full justify-start h-auto py-3"
                  onClick={() => handleSelectObraParaImportar(obra.id)}
                >
                  <div className="flex items-center gap-3">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{obra.nome}</span>
                  </div>
                </Button>
              ))
            ) : (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>Nenhuma obra cadastrada. Cadastre uma obra primeiro.</AlertDescription>
              </Alert>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 2. Importação */}
      {empresaId && obraParaImportar && (
        <ImportarColaboradoresDialog
          open={isImportDialogOpen}
          onOpenChange={setIsImportDialogOpen}
          empresaId={empresaId}
          obraId={obraParaImportar}
          competencia={competenciaAtualCapitalized}
          onSuccess={handleImportSuccess}
        />
      )}

      {/* 3. Edição */}
      {colaboradorParaEditar && (
        <EditarColaboradorDialog
          colaborador={colaboradorParaEditar}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* 4. Nova Obra (NOVO) */}
      {empresaId && (
        <NovaObraDialog
          open={isNovaObraOpen}
          onOpenChange={setIsNovaObraOpen}
          empresaId={empresaId}
          onSuccess={handleNovaObraSuccess}
        />
      )}

      {/* 5. Novo Colaborador (NOVO) */}
      {empresaId && (
        <NovoColaboradorDialog
          open={isNovoColaboradorOpen}
          onOpenChange={setIsNovoColaboradorOpen}
          empresaId={empresaId}
          obras={obras}
          onSuccess={handleNovoColaboradorSuccess}
        />
      )}
    </div>
  );
};

export default MinhaEquipe;
