import { useState } from "react";
import { 
  History, 
  Search, 
  Filter, 
  FileText, 
  Loader2,
  ChevronLeft,
  ChevronRight,
  Building2,
  Calendar
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const ITEMS_PER_PAGE = 10;

const Historico = () => {
  const { profile, loading: profileLoading } = useUserRole();
  const empresaId = profile?.empresa_id;

  const [selectedObra, setSelectedObra] = useState("all");
  const [selectedCompetencia, setSelectedCompetencia] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Buscar obras da empresa
  const { data: obras, isLoading: obrasLoading } = useQuery({
    queryKey: ["obras-historico", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data, error } = await supabase
        .from("obras")
        .select("id, nome")
        .eq("empresa_id", empresaId)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaId,
  });

  // Buscar competências disponíveis
  const { data: competencias } = useQuery({
    queryKey: ["competencias-historico", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data, error } = await supabase
        .from("lotes_mensais")
        .select("competencia")
        .eq("empresa_id", empresaId)
        .neq("status", "rascunho")
        .order("competencia", { ascending: false });
      if (error) throw error;
      // Remover duplicatas
      const uniqueCompetencias = [...new Set(data?.map(d => d.competencia) || [])];
      return uniqueCompetencias;
    },
    enabled: !!empresaId,
  });

  // Buscar lotes (histórico) com filtros e paginação
  const { data: lotesData, isLoading: lotesLoading } = useQuery({
    queryKey: ["historico-lotes", empresaId, selectedObra, selectedCompetencia, currentPage],
    queryFn: async () => {
      if (!empresaId) return { data: [], count: 0 };

      let query = supabase
        .from("lotes_mensais")
        .select("*, obras(nome)", { count: "exact" })
        .eq("empresa_id", empresaId)
        .neq("status", "rascunho");

      // Filtro por obra
      if (selectedObra !== "all") {
        query = query.eq("obra_id", selectedObra);
      }

      // Filtro por competência
      if (selectedCompetencia !== "all") {
        query = query.eq("competencia", selectedCompetencia);
      }

      // Paginação
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
    enabled: !!empresaId,
  });

  const lotes = lotesData?.data || [];
  const totalCount = lotesData?.count || 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "concluido":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Concluído</Badge>;
      case "faturado":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Faturado</Badge>;
      case "aguardando_processamento":
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Aguardando Processamento</Badge>;
      case "em_analise_seguradora":
        return <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20">Em Análise</Badge>;
      case "com_pendencia":
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Com Pendência</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "R$ 0,00";
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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
      <div className="flex items-center gap-3">
        <History className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Histórico</h1>
          <p className="text-muted-foreground">Listas enviadas e faturas anteriores</p>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="sm:w-64">
              <Select 
                value={selectedCompetencia} 
                onValueChange={(value) => {
                  setSelectedCompetencia(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger>
                  <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Filtrar por competência" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Competências</SelectItem>
                  {competencias?.map((comp) => (
                    <SelectItem key={comp} value={comp}>
                      {comp}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
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
        <CardHeader>
          <CardTitle className="text-lg">Listas Enviadas</CardTitle>
          <CardDescription>
            {totalCount} {totalCount === 1 ? "registro encontrado" : "registros encontrados"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {lotesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Competência</TableHead>
                    <TableHead>Obra</TableHead>
                    <TableHead>Vidas</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead>Enviado em</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lotes.length > 0 ? (
                    lotes.map((lote: any) => (
                      <TableRow key={lote.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell className="font-medium">{lote.competencia}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            {lote.obras?.nome || "-"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{lote.total_colaboradores || 0} vidas</Badge>
                        </TableCell>
                        <TableCell>{formatCurrency(lote.valor_total)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {lote.created_at ? format(new Date(lote.created_at), "dd/MM/yyyy HH:mm") : "-"}
                        </TableCell>
                        <TableCell>{getStatusBadge(lote.status)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        Nenhuma lista enviada encontrada.
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
    </div>
  );
};

export default Historico;
