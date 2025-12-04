import { useState } from "react";
import { 
  Send, 
  Users, 
  FileText, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  ArrowRight,
  Calendar,
  Loader2,
  FileSpreadsheet,
  Building2,
  AlertCircle
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const ClienteDashboard = () => {
  const { profile, loading: profileLoading } = useUserRole();
  const empresaId = profile?.empresa_id;
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Estados
  const [isEnvioDialogOpen, setIsEnvioDialogOpen] = useState(false);
  const [enviando, setEnviando] = useState(false);

  // Competência atual (mês/ano)
  const now = new Date();
  const currentDay = now.getDate();
  const competenciaAtual = format(now, "MMMM/yyyy", { locale: ptBR });
  const competenciaAtualCapitalized = competenciaAtual.charAt(0).toUpperCase() + competenciaAtual.slice(1);
  const isJanelaAberta = currentDay <= 20;

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

  // Buscar lote do mês atual (pode ter múltiplos por obra)
  const { data: lotesAtuais, isLoading: loteLoading } = useQuery({
    queryKey: ["lotes-atuais", empresaId, competenciaAtualCapitalized],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data, error } = await supabase
        .from("lotes_mensais")
        .select("*, obras(nome)")
        .eq("empresa_id", empresaId)
        .eq("competencia", competenciaAtualCapitalized)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaId,
  });

  // Buscar histórico (últimos 5 lotes)
  const { data: historico, isLoading: historicoLoading } = useQuery({
    queryKey: ["historico-lotes", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data, error } = await supabase
        .from("lotes_mensais")
        .select("*, obras(nome)")
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false })
        .limit(5);
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

  // Buscar todas as obras da empresa com contagem de colaboradores
  const { data: obras } = useQuery({
    queryKey: ["obras-empresa-com-colaboradores", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      
      // Buscar obras ativas
      const { data: obrasData, error: obrasError } = await supabase
        .from("obras")
        .select("id, nome, status")
        .eq("empresa_id", empresaId)
        .eq("status", "ativa")
        .order("nome");
      if (obrasError) throw obrasError;
      
      // Para cada obra, contar colaboradores ativos
      const obrasComColaboradores = await Promise.all(
        (obrasData || []).map(async (obra) => {
          const { count, error } = await supabase
            .from("colaboradores")
            .select("*", { count: "exact", head: true })
            .eq("empresa_id", empresaId)
            .eq("obra_id", obra.id)
            .eq("status", "ativo");
          
          return {
            ...obra,
            totalColaboradores: count || 0
          };
        })
      );
      
      return obrasComColaboradores;
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

  // Verificar se existe lote em rascunho com colaboradores (pronto para enviar)
  const loteRascunhoComColaboradores = lotesAtuais?.find(
    l => l.status === "rascunho" && (l.total_colaboradores || 0) > 0
  );

  // Verificar se existe lote em rascunho vazio (precisa importar)
  const loteRascunhoVazio = lotesAtuais?.find(
    l => l.status === "rascunho" && (l.total_colaboradores || 0) === 0
  );

  // Verificar lote em andamento (não rascunho)
  const loteEmAndamento = lotesAtuais?.find(
    l => l.status !== "rascunho"
  );

  // Lote principal para exibição de status
  const loteAtual = loteEmAndamento || lotesAtuais?.[0];

  // Mapear obras com seus lotes do mês atual e colaboradores
  const obrasComStatus = obras?.map(obra => {
    const lote = lotesAtuais?.find(l => l.obra_id === obra.id);
    const jaEnviado = lote && lote.status !== "rascunho";
    
    return {
      ...obra,
      lote,
      totalVidas: obra.totalColaboradores || 0, // Colaboradores na tabela principal
      status: lote?.status || null,
      temLista: (obra.totalColaboradores || 0) > 0, // Tem colaboradores = pronto para enviar
      jaEnviado
    };
  }) || [];

  // Verificar se há alguma obra pronta para enviar (tem colaboradores e não foi enviado ainda)
  const obrasParaEnviar = obrasComStatus.filter(o => o.temLista && !o.jaEnviado);
  const obrasSemLista = obrasComStatus.filter(o => !o.temLista);

  // Handler para abrir dialog de envio
  const handleEnviarLista = () => {
    setIsEnvioDialogOpen(true);
  };

  // Handler para selecionar obra e enviar
  const handleSelecionarObra = async (obra: any) => {
    setEnviando(true);
    
    try {
      // 1. Criar ou buscar lote para esta competência/obra
      let loteId = obra.lote?.id;
      
      if (!loteId) {
        const { data: novoLote, error: loteError } = await supabase
          .from("lotes_mensais")
          .insert({
            empresa_id: empresaId,
            obra_id: obra.id,
            competencia: competenciaAtualCapitalized,
            status: "rascunho",
            total_colaboradores: obra.totalVidas
          })
          .select()
          .single();
        
        if (loteError) throw loteError;
        loteId = novoLote.id;
      }
      
      // 2. Buscar colaboradores ativos desta obra
      const { data: colaboradores, error: colabError } = await supabase
        .from("colaboradores")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("obra_id", obra.id)
        .eq("status", "ativo");
      
      if (colabError) throw colabError;
      
      // 3. Criar snapshots em colaboradores_lote (se ainda não existirem)
      if (colaboradores && colaboradores.length > 0) {
        // Deletar snapshots antigos do mesmo lote (caso esteja re-enviando)
        await supabase
          .from("colaboradores_lote")
          .delete()
          .eq("lote_id", loteId);
        
        // Criar novos snapshots
        const snapshots = colaboradores.map(c => ({
          lote_id: loteId,
          colaborador_id: c.id,
          nome: c.nome,
          cpf: c.cpf,
          data_nascimento: c.data_nascimento,
          sexo: c.sexo,
          salario: c.salario || 0,
          classificacao: c.classificacao,
          classificacao_salario: c.classificacao_salario,
          aposentado: c.aposentado || false,
          afastado: c.afastado || false,
          cid: c.cid,
          status_seguradora: "pendente",
          tipo_alteracao: "mantido"
        }));
        
        const { error: snapshotError } = await supabase
          .from("colaboradores_lote")
          .insert(snapshots);
        
        if (snapshotError) throw snapshotError;
      }
      
      // 4. Atualizar status do lote para aguardando_processamento
      const { error: updateError } = await supabase
        .from("lotes_mensais")
        .update({ 
          status: "aguardando_processamento",
          total_colaboradores: colaboradores?.length || 0,
          updated_at: new Date().toISOString()
        })
        .eq("id", loteId);

      if (updateError) throw updateError;

      toast.success(`Lista de ${obra.nome} enviada para processamento!`);
      setIsEnvioDialogOpen(false);
      
      // Atualizar dados
      queryClient.invalidateQueries({ queryKey: ["lotes-atuais"] });
      queryClient.invalidateQueries({ queryKey: ["historico-lotes"] });
      queryClient.invalidateQueries({ queryKey: ["obras-empresa-com-colaboradores"] });
    } catch (error: any) {
      console.error("Erro ao enviar lista:", error);
      toast.error(error?.message || "Erro ao enviar lista. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

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
    if (loteAtual.status === "rascunho") return "Pendente";
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
      ) : loteRascunhoComColaboradores ? (
        // Lote em rascunho com colaboradores - pronto para enviar
        <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-orange-500/10">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-amber-700">Lista Pronta para Envio</CardTitle>
            </div>
            <CardDescription>
              Você tem uma lista de {competenciaAtualCapitalized} aguardando envio
              {loteRascunhoComColaboradores.obras?.nome && ` - ${loteRascunhoComColaboradores.obras.nome}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex items-center gap-3">
                {getStatusBadge("rascunho")}
                <span className="text-sm text-muted-foreground">
                  {loteRascunhoComColaboradores.total_colaboradores || 0} colaboradores importados
                </span>
              </div>
              <Button size="lg" className="gap-2 bg-amber-600 hover:bg-amber-700" onClick={handleEnviarLista}>
                <Send className="h-4 w-4" />
                Enviar para Processamento
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : loteEmAndamento ? (
        // Lote já enviado (não é rascunho)
        <Card className="border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-indigo-500/10">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-blue-700">Lista de {competenciaAtualCapitalized}</CardTitle>
            </div>
            <CardDescription>
              Status atual do envio mensal
              {loteEmAndamento.obras?.nome && ` - ${loteEmAndamento.obras.nome}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex items-center gap-3">
                {getStatusBadge(loteEmAndamento.status)}
                <span className="text-sm text-muted-foreground">
                  {loteEmAndamento.total_colaboradores || 0} colaboradores
                </span>
              </div>
              {loteEmAndamento.status === "com_pendencia" && (
                <Button size="lg" variant="destructive" className="gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Resolver Pendências
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : loteRascunhoVazio && isJanelaAberta ? (
        // Lote em rascunho vazio - precisa importar
        <Card className="border-orange-500/30 bg-gradient-to-br from-orange-500/5 to-amber-500/10">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <CardTitle className="text-orange-700">Importação Pendente</CardTitle>
            </div>
            <CardDescription>
              Você precisa importar a lista de colaboradores para {loteRascunhoVazio.obras?.nome || "esta obra"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Dias restantes: {20 - currentDay}</span>
              </div>
              <Button 
                size="lg" 
                className="gap-2" 
                onClick={handleEnviarLista}
              >
                <Send className="h-4 w-4" />
                Enviar Lista do Mês
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : isJanelaAberta ? (
        // Janela aberta, sem nenhum lote - precisa começar
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
              <Button 
                size="lg" 
                className="gap-2" 
                onClick={handleEnviarLista}
              >
                <Send className="h-4 w-4" />
                Enviar Lista do Mês
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        // Janela fechada
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
              <Button 
                size="lg" 
                variant="outline" 
                className="gap-2 border-yellow-500/50 text-yellow-700 hover:bg-yellow-500/10" 
                onClick={handleEnviarLista}
              >
                <Send className="h-4 w-4" />
                Enviar Lista do Mês (Atrasado)
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
                      <p className="font-medium">
                        {item.competencia}
                        {item.obras?.nome && <span className="text-muted-foreground font-normal"> - {item.obras.nome}</span>}
                      </p>
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

      {/* Dialog de Seleção de Obra para Envio */}
      <Dialog open={isEnvioDialogOpen} onOpenChange={setIsEnvioDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Enviar Lista do Mês
            </DialogTitle>
            <DialogDescription>
              Competência: <span className="font-semibold text-foreground">{competenciaAtualCapitalized}</span>
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            {obrasComStatus.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Nenhuma obra cadastrada. Cadastre uma obra em "Minha Equipe" primeiro.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Selecione a obra para enviar a lista de colaboradores:
                </p>
                
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {obrasComStatus.map((obra) => (
                    <div 
                      key={obra.id}
                      className={`flex items-center justify-between p-4 rounded-lg border ${
                        obra.temLista && !obra.jaEnviado 
                          ? "border-green-500/30 bg-green-500/5" 
                          : obra.jaEnviado 
                            ? "border-blue-500/30 bg-blue-500/5"
                            : "border-orange-500/30 bg-orange-500/5"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                          obra.temLista && !obra.jaEnviado 
                            ? "bg-green-500/20" 
                            : obra.jaEnviado 
                              ? "bg-blue-500/20"
                              : "bg-orange-500/20"
                        }`}>
                          <Building2 className={`h-5 w-5 ${
                            obra.temLista && !obra.jaEnviado 
                              ? "text-green-600" 
                              : obra.jaEnviado 
                                ? "text-blue-600"
                                : "text-orange-600"
                          }`} />
                        </div>
                        <div>
                          <p className="font-medium">{obra.nome}</p>
                          <p className="text-sm text-muted-foreground">
                            {obra.jaEnviado ? (
                              <span className="text-blue-600">Já enviado</span>
                            ) : obra.temLista ? (
                              <span className="text-green-600">{obra.totalVidas} vidas importadas</span>
                            ) : (
                              <span className="text-orange-600 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Lista não importada
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      
                      <div>
                        {obra.jaEnviado ? (
                          getStatusBadge(obra.status!)
                        ) : obra.temLista ? (
                          <Button 
                            size="sm" 
                            className="gap-1"
                            onClick={() => handleSelecionarObra(obra)}
                            disabled={enviando}
                          >
                            {enviando ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Send className="h-3 w-3" />
                            )}
                            Enviar
                          </Button>
                        ) : (
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="gap-1 text-orange-600 border-orange-500/50 hover:bg-orange-500/10"
                            onClick={() => {
                              setIsEnvioDialogOpen(false);
                              navigate("/cliente/minha-equipe");
                            }}
                          >
                            <FileSpreadsheet className="h-3 w-3" />
                            Importar
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {obrasSemLista.length > 0 && (
                  <Alert className="border-orange-500/30 bg-orange-500/5">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <AlertDescription className="text-orange-700">
                      {obrasSemLista.length === 1 
                        ? `A obra "${obrasSemLista[0].nome}" ainda não possui lista importada.`
                        : `${obrasSemLista.length} obras ainda não possuem lista importada.`
                      }
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEnvioDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClienteDashboard;