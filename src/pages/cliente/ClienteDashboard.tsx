import { useState } from "react";
import { 
  Upload, 
  Users, 
  FileText, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  ArrowRight,
  Calendar,
  Loader2
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ImportarColaboradoresDialog } from "@/components/cliente/ImportarColaboradoresDialog";
import { useImportarColaboradores } from "@/hooks/useImportarColaboradores";
import { toast } from "sonner";

const ClienteDashboard = () => {
  const { profile, loading: profileLoading } = useUserRole();
  const empresaId = profile?.empresa_id;
  const queryClient = useQueryClient();

  // Estados para o dialog de importação
  const [isSelectObraOpen, setIsSelectObraOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [selectedObraId, setSelectedObraId] = useState<string | null>(null);
  const [loteIdParaImportacao, setLoteIdParaImportacao] = useState<string | null>(null);
  const [preparingImport, setPreparingImport] = useState(false);

  const { criarOuBuscarLote } = useImportarColaboradores();

  // Competência atual (mês/ano)
  const now = new Date();
  const currentDay = now.getDate();
  const competenciaAtual = format(now, "MMMM/yyyy", { locale: ptBR });
  const competenciaAtualCapitalized = competenciaAtual.charAt(0).toUpperCase() + competenciaAtual.slice(1);
  const isJanelaAberta = currentDay <= 20;

  // Buscar obras da empresa
  const { data: obras } = useQuery({
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

  // Buscar dados da empresa
  const { data: empresa } = useQuery({
    queryKey: ["empresa", empresaId],
    queryFn: async () => {
      if (!empresaId) return null;
      const { data, error } = await supabase
        .from("empresas")
        .select("nome")
        .eq("id", empresaId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  // Handler para abrir seleção de obra
  const handleEnviarLista = () => {
    if (!obras || obras.length === 0) {
      toast.error("Você precisa cadastrar pelo menos uma obra antes de enviar a lista");
      return;
    }
    
    if (obras.length === 1) {
      // Se só tem uma obra, usa ela diretamente
      handleConfirmObra(obras[0].id);
    } else {
      // Se tem múltiplas obras, abre o dialog de seleção
      setIsSelectObraOpen(true);
    }
  };

  // Handler para confirmar obra e abrir importação
  const handleConfirmObra = async (obraId: string) => {
    if (!empresaId) {
      toast.error("Empresa não identificada");
      return;
    }
    
    setPreparingImport(true);
    
    try {
      const loteId = await criarOuBuscarLote(empresaId, obraId, competenciaAtualCapitalized);
      if (loteId) {
        setSelectedObraId(obraId);
        setLoteIdParaImportacao(loteId);
        setIsSelectObraOpen(false);
        setIsImportDialogOpen(true);
      } else {
        toast.error("Não foi possível criar o lote. Tente novamente.");
      }
    } catch (error: any) {
      console.error("Erro ao criar/buscar lote:", error);
      toast.error(error?.message || "Erro ao preparar importação. Verifique suas permissões.");
    } finally {
      setPreparingImport(false);
    }
  };

  // Handler de sucesso da importação
  const handleImportSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["lote-atual"] });
    queryClient.invalidateQueries({ queryKey: ["historico-lotes"] });
    queryClient.invalidateQueries({ queryKey: ["total-colaboradores"] });
  };

  // Buscar lote do mês atual
  const { data: loteAtual, isLoading: loteLoading } = useQuery({
    queryKey: ["lote-atual", empresaId, competenciaAtualCapitalized],
    queryFn: async () => {
      if (!empresaId) return null;
      const { data, error } = await supabase
        .from("lotes_mensais")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("competencia", competenciaAtualCapitalized)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  // Buscar histórico (últimos 3 lotes)
  const { data: historico, isLoading: historicoLoading } = useQuery({
    queryKey: ["historico-lotes", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data, error } = await supabase
        .from("lotes_mensais")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false })
        .limit(3);
      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaId,
  });

  // Buscar total de colaboradores ativos
  const { data: totalColaboradores } = useQuery({
    queryKey: ["total-colaboradores", empresaId],
    queryFn: async () => {
      if (!empresaId) return 0;
      const { count, error } = await supabase
        .from("colaboradores")
        .select("*", { count: "exact", head: true })
        .eq("empresa_id", empresaId)
        .eq("status", "ativo");
      if (error) throw error;
      return count || 0;
    },
    enabled: !!empresaId,
  });

  // Buscar última nota fiscal
  const { data: ultimaFatura } = useQuery({
    queryKey: ["ultima-fatura", empresaId],
    queryFn: async () => {
      if (!empresaId) return null;
      const { data, error } = await supabase
        .from("notas_fiscais")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

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
      case "rascunho":
        return <Badge className="bg-gray-500/10 text-gray-600 border-gray-500/20">Rascunho</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "R$ 0,00";
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const getStatusGeral = () => {
    if (!loteAtual) return "Pendente";
    if (loteAtual.status === "concluido" || loteAtual.status === "faturado") return "Em dia";
    if (loteAtual.status === "com_pendencia") return "Pendente";
    return "Em andamento";
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
      <div>
        <h1 className="text-2xl font-bold">Bem-vindo, {empresa?.nome || "Carregando..."}</h1>
        <p className="text-muted-foreground">Central de ações e acompanhamento</p>
      </div>

      {/* Card Principal - Status do Mês */}
      {loteLoading ? (
        <Card className="border-muted">
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : loteAtual ? (
        <Card className="border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-indigo-500/10">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-blue-700">Lista de {competenciaAtualCapitalized}</CardTitle>
            </div>
            <CardDescription>
              Status atual do envio mensal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex items-center gap-3">
                {getStatusBadge(loteAtual.status)}
                <span className="text-sm text-muted-foreground">
                  {loteAtual.total_colaboradores} colaboradores
                </span>
              </div>
              {loteAtual.status === "com_pendencia" && (
                <Button size="lg" variant="destructive" className="gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Resolver Pendências
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : isJanelaAberta ? (
        <Card className="border-green-500/30 bg-gradient-to-br from-green-500/5 to-emerald-500/10">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <CardTitle className="text-green-700">Janela de Movimentação Aberta</CardTitle>
            </div>
            <CardDescription>
              Você tem até o dia 20 para enviar a lista de {competenciaAtualCapitalized}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Dias restantes: {20 - currentDay}</span>
              </div>
              <Button size="lg" className="gap-2" onClick={handleEnviarLista}>
                <Upload className="h-4 w-4" />
                Enviar Lista de {competenciaAtualCapitalized.split("/")[0]}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-yellow-500/30 bg-gradient-to-br from-yellow-500/5 to-orange-500/10">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <CardTitle className="text-yellow-700">Envio em Atraso</CardTitle>
            </div>
            <CardDescription>
              A janela de movimentação para {competenciaAtualCapitalized} encerrou no dia 20
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Entre em contato com o suporte para regularizar</span>
              </div>
              <Button size="lg" variant="outline" className="gap-2 border-yellow-500/50 text-yellow-700 hover:bg-yellow-500/10" onClick={handleEnviarLista}>
                <Upload className="h-4 w-4" />
                Enviar Lista (Atrasado)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cards de Resumo */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Vidas Ativas</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalColaboradores ?? 0}</div>
            <p className="text-xs text-muted-foreground">colaboradores cadastrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Última Fatura</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(ultimaFatura?.valor_total ?? null)}</div>
            <p className="text-xs text-muted-foreground">{ultimaFatura?.competencia || "Sem faturas"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status Atual</CardTitle>
            <CheckCircle2 className={`h-4 w-4 ${getStatusGeral() === "Em dia" ? "text-green-500" : getStatusGeral() === "Pendente" ? "text-yellow-500" : "text-blue-500"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getStatusGeral() === "Em dia" ? "text-green-600" : getStatusGeral() === "Pendente" ? "text-yellow-600" : "text-blue-600"}`}>
              {getStatusGeral()}
            </div>
            <p className="text-xs text-muted-foreground">
              {getStatusGeral() === "Em dia" ? "sem pendências" : getStatusGeral() === "Pendente" ? "ação necessária" : "em processamento"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Histórico Recente */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Histórico Recente</CardTitle>
          <CardDescription>Últimos envios realizados</CardDescription>
        </CardHeader>
        <CardContent>
          {historicoLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : historico && historico.length > 0 ? (
            <div className="space-y-4">
              {historico.map((item) => (
                <div 
                  key={item.id} 
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{item.competencia}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.created_at ? format(new Date(item.created_at), "dd/MM/yyyy") : "-"} • {item.total_colaboradores || 0} vidas
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(item.status)}
                    <Button variant="ghost" size="sm">
                      Ver detalhes
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum envio encontrado.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Seleção de Obra */}
      <Dialog open={isSelectObraOpen} onOpenChange={setIsSelectObraOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Selecione a Obra</DialogTitle>
            <DialogDescription>
              Escolha a obra para a qual deseja enviar a lista de {competenciaAtualCapitalized}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {obras?.map((obra) => (
              <Button
                key={obra.id}
                variant="outline"
                className="w-full justify-start"
                onClick={() => handleConfirmObra(obra.id)}
                disabled={preparingImport}
              >
                {preparingImport ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Preparando...
                  </>
                ) : (
                  obra.nome
                )}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Importação */}
      {loteIdParaImportacao && empresaId && selectedObraId && (
        <ImportarColaboradoresDialog
          open={isImportDialogOpen}
          onOpenChange={setIsImportDialogOpen}
          empresaId={empresaId}
          obraId={selectedObraId}
          loteId={loteIdParaImportacao}
          competencia={competenciaAtualCapitalized}
          onSuccess={handleImportSuccess}
        />
      )}
    </div>
  );
};

export default ClienteDashboard;
