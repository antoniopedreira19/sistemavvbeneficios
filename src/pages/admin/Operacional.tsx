import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Briefcase, Inbox, Clock, AlertTriangle, CheckCircle, RotateCcw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { toast } from "sonner";
import { LotesTable, LoteOperacional } from "@/components/admin/operacional/LotesTable";
import { ProcessarRetornoDialog } from "@/components/admin/operacional/ProcessarRetornoDialog";

const ITEMS_PER_PAGE = 10;

type TabType = "entrada" | "seguradora" | "pendencia" | "reanalise" | "concluido";

const Operacional = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>("entrada");
  const [pages, setPages] = useState<Record<TabType, number>>({
    entrada: 1,
    seguradora: 1,
    pendencia: 1,
    reanalise: 1,
    concluido: 1,
  });

  const [confirmEnviarDialog, setConfirmEnviarDialog] = useState<LoteOperacional | null>(null);
  const [confirmFaturarDialog, setConfirmFaturarDialog] = useState<LoteOperacional | null>(null);
  const [processarRetornoDialog, setProcessarRetornoDialog] = useState<LoteOperacional | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // --- QUERY INTELIGENTE ---
  const fetchLotes = async (tab: TabType) => {
    let query = supabase.from("lotes_mensais").select(
      `
        id, competencia, total_colaboradores, total_reprovados, valor_total, created_at, status, 
        empresa:empresas(nome),
        obra:obras(nome)
      `,
      { count: "exact" },
    );

    switch (tab) {
      case "entrada":
        // Filtra APENAS novos (aguardando_processamento).
        // Lotes corrigidos agora usam outro status, então não se misturam.
        query = query.eq("status", "aguardando_processamento");
        break;
      case "seguradora":
        // Filtra APENAS novos na seguradora
        query = query.eq("status", "em_analise_seguradora");
        break;
      case "pendencia":
        query = query.eq("status", "com_pendencia");
        break;
      case "reanalise":
        // Pega o ciclo de reanálise inteiro (Chegada do Cliente + Envio 2ª via)
        query = query.in("status", ["aguardando_reanalise", "em_reanalise"]);
        break;
      case "concluido":
        query = query.eq("status", "concluido");
        break;
    }

    query = query
      .order("created_at", { ascending: false })
      .range((pages[tab] - 1) * ITEMS_PER_PAGE, pages[tab] * ITEMS_PER_PAGE - 1);

    const { data, error, count } = await query;
    if (error) throw error;
    // Cast forçado para aceitar os novos status do TS se ainda não tiverem atualizados no type global
    return { data: data as unknown as LoteOperacional[], count: count || 0 };
  };

  // Queries
  const tabs: TabType[] = ["entrada", "seguradora", "pendencia", "reanalise", "concluido"];
  const queries = tabs.reduce(
    (acc, tab) => {
      acc[tab] = useQuery({
        queryKey: ["lotes", tab, pages[tab]],
        queryFn: () => fetchLotes(tab),
      });
      return acc;
    },
    {} as Record<TabType, any>,
  );

  // --- MUTATIONS ---

  // 1. Enviar Lote Novo (Entrada -> Seguradora)
  const enviarNovoMutation = useMutation({
    mutationFn: async (loteId: string) => {
      setActionLoading(loteId);
      const { error } = await supabase
        .from("lotes_mensais")
        .update({ status: "em_analise_seguradora", enviado_seguradora_em: new Date().toISOString() })
        .eq("id", loteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lotes"] });
      toast.success("Lote enviado para seguradora!");
      setConfirmEnviarDialog(null);
      setActionLoading(null);
    },
    onError: (e: any) => {
      toast.error("Erro: " + e.message);
      setActionLoading(null);
    },
  });

  // 2. Reenviar Lote Corrigido (Reanálise -> Em Reanálise)
  const reenviarReanaliseMutation = useMutation({
    mutationFn: async (loteId: string) => {
      setActionLoading(loteId);
      const { error } = await supabase
        .from("lotes_mensais")
        .update({ status: "em_reanalise", enviado_seguradora_em: new Date().toISOString() })
        .eq("id", loteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lotes"] });
      toast.success("Lote reenviado para análise (2ª via)!");
      setConfirmEnviarDialog(null);
      setActionLoading(null);
    },
    onError: (e: any) => {
      toast.error("Erro: " + e.message);
      setActionLoading(null);
    },
  });

  const liberarFaturamentoMutation = useMutation({
    mutationFn: async (loteId: string) => {
      setActionLoading(loteId);
      const { error } = await supabase.from("lotes_mensais").update({ status: "faturado" }).eq("id", loteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lotes"] });
      toast.success("Liberado para faturamento!");
      setConfirmFaturarDialog(null);
      setActionLoading(null);
    },
    onError: (e: any) => {
      toast.error("Erro: " + e.message);
      setActionLoading(null);
    },
  });

  const handleAction = (lote: LoteOperacional, tab: string) => {
    if (tab === "entrada") setConfirmEnviarDialog(lote); // Vai usar enviarNovo

    // Na reanálise, depende do status interno
    if (tab === "reanalise") {
      if (lote.status === "aguardando_reanalise")
        setConfirmEnviarDialog(lote); // Vai usar reenviarReanalise
      else if (lote.status === "em_reanalise") setProcessarRetornoDialog(lote);
    }

    if (tab === "seguradora") setProcessarRetornoDialog(lote);
    if (tab === "concluido") setConfirmFaturarDialog(lote);
    if (tab === "pendencia") toast.info("Cobrança em breve");
  };

  // Função Wrapper para decidir qual envio usar
  const handleConfirmarEnvio = () => {
    if (!confirmEnviarDialog) return;

    if (confirmEnviarDialog.status === "aguardando_reanalise") {
      reenviarReanaliseMutation.mutate(confirmEnviarDialog.id);
    } else {
      enviarNovoMutation.mutate(confirmEnviarDialog.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Briefcase className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Operacional</h1>
          <p className="text-muted-foreground">Gestão de Fluxo de Lotes</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="entrada" className="gap-2">
            <Inbox className="h-4 w-4" /> Entrada
            <Badge variant="secondary" className="ml-1">
              {queries.entrada.data?.count || 0}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="seguradora" className="gap-2">
            <Clock className="h-4 w-4" /> Seguradora
            <Badge variant="secondary" className="ml-1">
              {queries.seguradora.data?.count || 0}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="pendencia" className="gap-2">
            <AlertTriangle className="h-4 w-4" /> Pendências
            <Badge variant="destructive" className="ml-1">
              {queries.pendencia.data?.count || 0}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="reanalise" className="gap-2">
            <RotateCcw className="h-4 w-4" /> Reanálise
            <Badge variant="outline" className="ml-1 bg-orange-100 text-orange-700 border-orange-200">
              {queries.reanalise.data?.count || 0}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="concluido" className="gap-2">
            <CheckCircle className="h-4 w-4" /> Prontos
            <Badge variant="default" className="ml-1">
              {queries.concluido.data?.count || 0}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* Renderiza as abas */}
        {renderTabContent(
          "entrada",
          "Entrada de Novos Lotes",
          <Inbox className="text-blue-500" />,
          queries,
          pages,
          setPages,
          handleAction,
          actionLoading,
          "enviar",
        )}
        {renderTabContent(
          "seguradora",
          "Novos em Análise",
          <Clock className="text-yellow-500" />,
          queries,
          pages,
          setPages,
          handleAction,
          actionLoading,
          "processar",
        )}
        {renderTabContent(
          "pendencia",
          "Aguardando Cliente",
          <AlertTriangle className="text-red-500" />,
          queries,
          pages,
          setPages,
          handleAction,
          actionLoading,
          "pendencia",
        )}
        {renderTabContent(
          "reanalise",
          "Ciclo de Correção",
          <RotateCcw className="text-orange-500" />,
          queries,
          pages,
          setPages,
          handleAction,
          actionLoading,
          "reanalise",
        )}
        {renderTabContent(
          "concluido",
          "Prontos para Faturamento",
          <CheckCircle className="text-green-500" />,
          queries,
          pages,
          setPages,
          handleAction,
          actionLoading,
          "faturar",
        )}
      </Tabs>

      {/* DIALOG DE ENVIO INTELIGENTE */}
      <AlertDialog open={!!confirmEnviarDialog} onOpenChange={() => setConfirmEnviarDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmEnviarDialog?.status === "aguardando_reanalise"
                ? "Reenviar para Seguradora?"
                : "Enviar Novo Lote?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmEnviarDialog?.status === "aguardando_reanalise"
                ? "Este lote contém correções. O status será atualizado para 'Em Reanálise'."
                : "O lote será enviado para a fila 'Em Análise da Seguradora'."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmarEnvio}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmFaturarDialog} onOpenChange={() => setConfirmFaturarDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Liberar Faturamento?</AlertDialogTitle>
            <AlertDialogDescription>O lote irá para o setor financeiro.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmFaturarDialog && liberarFaturamentoMutation.mutate(confirmFaturarDialog.id)}
            >
              Liberar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {processarRetornoDialog && (
        <ProcessarRetornoDialog
          open={!!processarRetornoDialog}
          onOpenChange={(open) => !open && setProcessarRetornoDialog(null)}
          loteId={processarRetornoDialog.id}
          empresaNome={processarRetornoDialog.empresa?.nome || ""}
          competencia={processarRetornoDialog.competencia}
        />
      )}
    </div>
  );
};

// Helper para reduzir repetição no JSX
function renderTabContent(
  value: TabType,
  title: string,
  icon: any,
  queries: any,
  pages: any,
  setPages: any,
  handleAction: any,
  actionLoading: any,
  actionType: any,
) {
  return (
    <TabsContent value={value} className="mt-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            {icon} {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LotesTable
            lotes={queries[value].data?.data || []}
            isLoading={queries[value].isLoading}
            currentPage={pages[value]}
            totalPages={Math.ceil((queries[value].data?.count || 0) / ITEMS_PER_PAGE)}
            onPageChange={(p) => setPages((prev: any) => ({ ...prev, [value]: p }))}
            actionType={actionType}
            onAction={(l) => handleAction(l, value)}
            actionLoading={actionLoading}
          />
        </CardContent>
      </Card>
    </TabsContent>
  );
}

export default Operacional;
