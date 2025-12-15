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
  Building,
  Eye,
  EyeOff,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

// Imports dos Dialogs
import { ImportarColaboradoresDialog } from "@/components/cliente/ImportarColaboradoresDialog";
import { EditarColaboradorDialog } from "@/components/cliente/EditarColaboradorDialog";
import { NovoColaboradorDialog } from "@/components/cliente/NovoColaboradorDialog";
import { GerenciarObrasDialog } from "@/components/cliente/GerenciarObrasDialog";

const ITEMS_PER_PAGE = 10;

const MinhaEquipe = () => {
  const { profile, loading: profileLoading } = useUserRole();
  const empresaId = profile?.empresa_id;
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedObra, setSelectedObra] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [mostrarDesligados, setMostrarDesligados] = useState(false);

  // Estados dos Modais
  const [isNovoColaboradorOpen, setIsNovoColaboradorOpen] = useState(false);
  const [isGerenciarObrasOpen, setIsGerenciarObrasOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isSelectObraDialogOpen, setIsSelectObraDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const [obraParaImportar, setObraParaImportar] = useState<string | null>(null);
  const [colaboradorParaEditar, setColaboradorParaEditar] = useState<any>(null);

  // Competência
  const now = new Date();
  const competenciaAtual = now.toLocaleString("pt-BR", { month: "long", year: "numeric" });
  const competenciaCapitalized = competenciaAtual.charAt(0).toUpperCase() + competenciaAtual.slice(1);

  // 1. Buscar Obras
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

  // 2. Buscar Colaboradores (filtra por mostrarDesligados)
  const { data: colaboradoresData, isLoading: colaboradoresLoading } = useQuery({
    queryKey: ["colaboradores", empresaId, selectedObra, searchTerm, currentPage, mostrarDesligados],
    queryFn: async () => {
      if (!empresaId) return { data: [], count: 0 };
      let query = supabase
        .from("colaboradores")
        .select("*, obras(nome)", { count: "exact" })
        .eq("empresa_id", empresaId);

      // Filtrar por status baseado no toggle
      if (!mostrarDesligados) {
        query = query.eq("status", "ativo");
      }

      if (selectedObra !== "all") query = query.eq("obra_id", selectedObra);
      if (searchTerm) query = query.or(`nome.ilike.%${searchTerm}%,cpf.ilike.%${searchTerm}%`);

      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const { data, error, count } = await query.order("nome").range(from, to);
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
    enabled: !!empresaId,
  });

  // 3. Stats
  const { data: stats } = useQuery({
    queryKey: ["colaboradores-stats", empresaId],
    queryFn: async () => {
      if (!empresaId) return { ativos: 0, afastados: 0, desligados: 0 };

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

      const { count: desligados } = await supabase
        .from("colaboradores")
        .select("*", { count: "exact", head: true })
        .eq("empresa_id", empresaId)
        .eq("status", "desligado");

      return { ativos: ativos || 0, afastados: afastados || 0, desligados: desligados || 0 };
    },
    enabled: !!empresaId,
  });

  const colaboradores = colaboradoresData?.data || [];
  const totalCount = colaboradoresData?.count || 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const formatCurrency = (val: number) => val?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "-";

  const getStatusBadge = (colaborador: any) => {
    if (colaborador.afastado)
      return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200">Afastado</Badge>;
    if (colaborador.status === "ativo")
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-200">Ativo</Badge>;
    return <Badge className="bg-red-100 text-red-700 hover:bg-red-200">Desligado</Badge>;
  };

  const handleImportSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["colaboradores"] });
    queryClient.invalidateQueries({ queryKey: ["colaboradores-stats"] });
  };

  if (profileLoading)
    return (
      <div className="flex justify-center h-64 items-center">
        <Loader2 className="animate-spin" />
      </div>
    );

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Minha Equipe</h1>
            <p className="text-muted-foreground">Gestão de colaboradores e obras</p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {/* BOTÃO GERENCIAR OBRAS */}
          <Button variant="outline" onClick={() => setIsGerenciarObrasOpen(true)} className="gap-2">
            <Building className="h-4 w-4" /> Obras
          </Button>

          <Button variant="outline" onClick={() => setIsSelectObraDialogOpen(true)} className="gap-2">
            <Upload className="h-4 w-4" /> Importar Lista
          </Button>

          <Button onClick={() => setIsNovoColaboradorOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Colaborador
          </Button>
        </div>
      </div>

      {/* Info Alert */}
      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          Para enviar a movimentação do mês, clique em <strong>Importar Lista</strong>. Isso atualizará sua base e
          desligará automaticamente quem não estiver no arquivo.
        </AlertDescription>
      </Alert>

      {/* Resumo Estatístico */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.ativos}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Afastados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats?.afastados}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Desligados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats?.desligados}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou CPF..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <div className="sm:w-64">
              <Select
                value={selectedObra}
                onValueChange={(v) => {
                  setSelectedObra(v);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filtrar por obra" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Obras</SelectItem>
                  {obras?.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant={mostrarDesligados ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setMostrarDesligados(!mostrarDesligados);
                setCurrentPage(1);
              }}
              className="gap-2"
            >
              {mostrarDesligados ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {mostrarDesligados ? "Ocultar Desligados" : "Mostrar Desligados"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="pt-6">
          {colaboradoresLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin" />
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
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {colaboradores.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {mostrarDesligados ? "Nenhum colaborador encontrado." : "Nenhum colaborador ativo encontrado."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    colaboradores.map((colab: any) => (
                      <TableRow key={colab.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">{colab.nome}</TableCell>
                        <TableCell className="text-muted-foreground">{colab.cpf}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{colab.cargo || "-"}</Badge>
                        </TableCell>
                        <TableCell>{formatCurrency(colab.salario)}</TableCell>
                        <TableCell className="text-muted-foreground">{colab.obras?.nome || "-"}</TableCell>
                        <TableCell>{getStatusBadge(colab)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setColaboradorParaEditar(colab);
                              setIsEditDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {totalCount > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <span className="text-sm text-muted-foreground">
                    Página {currentPage} de {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
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

      {/* --- MODAIS --- */}

      {/* 1. Gerenciar Obras (Criar/Remover) */}
      {empresaId && (
        <GerenciarObrasDialog
          open={isGerenciarObrasOpen}
          onOpenChange={setIsGerenciarObrasOpen}
          empresaId={empresaId}
        />
      )}

      {/* 2. Novo Colaborador */}
      {empresaId && (
        <NovoColaboradorDialog
          open={isNovoColaboradorOpen}
          onOpenChange={setIsNovoColaboradorOpen}
          empresaId={empresaId}
          obras={obras || []}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["colaboradores"] });
            queryClient.invalidateQueries({ queryKey: ["colaboradores-stats"] });
          }}
        />
      )}

      {/* 3. Seleção de Obra para Importar */}
      <Dialog open={isSelectObraDialogOpen} onOpenChange={setIsSelectObraDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Selecionar Obra</DialogTitle>
            <DialogDescription>Para qual obra você vai importar a lista?</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {obras && obras.length > 0 ? (
              obras.map((o) => (
                <Button
                  key={o.id}
                  variant="outline"
                  className="w-full justify-start h-auto py-3"
                  onClick={() => {
                    setObraParaImportar(o.id);
                    setIsSelectObraDialogOpen(false);
                    setIsImportDialogOpen(true);
                  }}
                >
                  <Users className="h-4 w-4 mr-2" /> {o.nome}
                </Button>
              ))
            ) : (
              <div className="text-center text-muted-foreground">Nenhuma obra encontrada.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 4. Importar Excel */}
      {empresaId && obraParaImportar && (
        <ImportarColaboradoresDialog
          open={isImportDialogOpen}
          onOpenChange={setIsImportDialogOpen}
          empresaId={empresaId}
          obraId={obraParaImportar}
          competencia={competenciaCapitalized}
          onSuccess={handleImportSuccess}
        />
      )}

      {/* 5. Editar Colaborador */}
      {colaboradorParaEditar && (
        <EditarColaboradorDialog
          colaborador={colaboradorParaEditar}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["colaboradores"] });
            setIsEditDialogOpen(false);
          }}
        />
      )}
    </div>
  );
};

export default MinhaEquipe;
