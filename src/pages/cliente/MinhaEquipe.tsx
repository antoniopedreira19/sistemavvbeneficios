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
  Info
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ImportarColaboradoresDialog } from "@/components/cliente/ImportarColaboradoresDialog";
import { useImportarColaboradores } from "@/hooks/useImportarColaboradores";

const ITEMS_PER_PAGE = 10;

const MinhaEquipe = () => {
  const { profile, loading: profileLoading } = useUserRole();
  const empresaId = profile?.empresa_id;
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedObra, setSelectedObra] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [loteIdParaImportacao, setLoteIdParaImportacao] = useState<string | null>(null);

  const { criarOuBuscarLote } = useImportarColaboradores();

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

      const { data, error, count } = await query
        .order("nome")
        .range(from, to);

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

  const handleOpenImport = async () => {
    if (!empresaId || selectedObra === "all") return;
    
    try {
      const loteId = await criarOuBuscarLote(empresaId, selectedObra, competenciaAtualCapitalized);
      if (loteId) {
        setLoteIdParaImportacao(loteId);
        setIsImportDialogOpen(true);
      }
    } catch (error) {
      console.error("Erro ao criar/buscar lote:", error);
    }
  };

  const handleImportSuccess = () => {
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
        
        <div className="flex gap-2">
          <Button 
            onClick={handleOpenImport} 
            variant="outline" 
            className="gap-2"
            disabled={selectedObra === "all"}
            title={selectedObra === "all" ? "Selecione uma obra para importar" : ""}
          >
            <Upload className="h-4 w-4" />
            Importar Lista
          </Button>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Colaborador
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Novo Colaborador</DialogTitle>
                <DialogDescription>
                  Preencha os dados do colaborador para adicioná-lo à equipe.
                </DialogDescription>
              </DialogHeader>
              <div className="py-6 text-center text-muted-foreground">
                Formulário em desenvolvimento...
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Alerta informativo */}
      <Alert className="bg-blue-500/5 border-blue-500/20">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-sm">
          <strong>Como enviar a lista mensal:</strong> Selecione uma obra no filtro abaixo, clique em "Importar Lista" para carregar a planilha de colaboradores. 
          Depois, vá ao <strong>Painel</strong> para enviar a lista para processamento.
        </AlertDescription>
      </Alert>

      {/* Resumo */}
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
                    <SelectItem value="loading" disabled>Carregando...</SelectItem>
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
                      <TableRow key={colab.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell className="font-medium">{colab.nome}</TableCell>
                        <TableCell className="text-muted-foreground">{colab.cpf}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{colab.cargo || "-"}</Badge>
                        </TableCell>
                        <TableCell>{formatCurrency(colab.salario)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {colab.obras?.nome || "-"}
                        </TableCell>
                        <TableCell>{getStatusBadge(colab)}</TableCell>
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
                    Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} de {totalCount}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
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
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
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

      {/* Dialog de Importação */}
      {loteIdParaImportacao && empresaId && selectedObra !== "all" && (
        <ImportarColaboradoresDialog
          open={isImportDialogOpen}
          onOpenChange={setIsImportDialogOpen}
          empresaId={empresaId}
          obraId={selectedObra}
          loteId={loteIdParaImportacao}
          competencia={competenciaAtualCapitalized}
          onSuccess={handleImportSuccess}
        />
      )}
    </div>
  );
};

export default MinhaEquipe;
