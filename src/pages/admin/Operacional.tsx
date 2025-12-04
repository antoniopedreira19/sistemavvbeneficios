import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Briefcase, Inbox, Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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

type LoteStatus = "aguardando_processamento" | "em_analise_seguradora" | "com_pendencia" | "concluido";

const Operacional = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<LoteStatus>("aguardando_processamento");
  const [pages, setPages] = useState<Record<LoteStatus, number>>({
    aguardando_processamento: 1,
    em_analise_seguradora: 1,
    com_pendencia: 1,
    concluido: 1,
  });

  // Dialogs state
  const [confirmEnviarDialog, setConfirmEnviarDialog] = useState<LoteOperacional | null>(null);
  const [confirmFaturarDialog, setConfirmFaturarDialog] = useState<LoteOperacional | null>(null);
  const [processarRetornoDialog, setProcessarRetornoDialog] = useState<LoteOperacional | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Fetch lotes for all statuses
  const fetchLotes = async (status: LoteStatus) => {
    const { data, error, count } = await supabase
      .from("lotes_mensais")
      .select(
        `
        id,
        competencia,
        total_colaboradores,
        total_reprovados,
        valor_total,
        created_at,
        status,
        empresa:empresas(nome),
        obra:obras(nome)
      `,
        { count: "exact" },
      )
      .eq("status", status)
      .order("created_at", { ascending: false })
      .range((pages[status] - 1) * ITEMS_PER_PAGE, pages[status] * ITEMS_PER_PAGE - 1);

    if (error) throw error;
    return { data: data as LoteOperacional[], count: count || 0 };
  };

  // Queries for each status
  const { data: entradaData, isLoading: entradaLoading } = useQuery({
    queryKey: ["lotes-operacional", "aguardando_processamento", pages.aguardando_processamento],
    queryFn: () => fetchLotes("aguardando_processamento"),
  });

  const { data: seguradoraData, isLoading: seguradoraLoading } = useQuery({
    queryKey: ["lotes-operacional", "em_analise_seguradora", pages.em_analise_seguradora],
    queryFn: () => fetchLotes("em_analise_seguradora"),
  });

  const { data: pendenciaData, isLoading: pendenciaLoading } = useQuery({
    queryKey: ["lotes-operacional", "com_pendencia", pages.com_pendencia],
    queryFn: () => fetchLotes("com_pendencia"),
  });

  const { data: concluidoData, isLoading: concluidoLoading } = useQuery({
    queryKey: ["lotes-operacional", "concluido", pages.concluido],
    queryFn: () => fetchLotes("concluido"),
  });

  // Mutations
  const enviarParaSeguradoraMutation = useMutation({
    mutationFn: async (loteId: string) => {
      setActionLoading(loteId);

      // CORREÇÃO: Removido o update em colaboradores_lote que causava erro.
      // Os colaboradores permanecem como 'pendente' até o retorno da seguradora.

      // Update lote status
      const { error } = await supabase
        .from("lotes_mensais")
        .update({
          status: "em_analise_seguradora",
          enviado_seguradora_em: new Date().toISOString(),
        })
        .eq("id", loteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lotes-operacional"] });
      toast.success("Lote enviado para seguradora!");
      setConfirmEnviarDialog(null);
      setActionLoading(null);
    },
    onError: (error: any) => {
      console.error(error);
      toast.error(`Erro ao enviar: ${error.message || "Erro desconhecido"}`);
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
      queryClient.invalidateQueries({ queryKey: ["lotes-operacional"] });
      toast.success("Lote liberado para faturamento!");
      setConfirmFaturarDialog(null);
      setActionLoading(null);
    },
    onError: (error) => {
      console.error(error);
      toast.error("Erro ao liberar para faturamento");
      setActionLoading(null);
    },
  });

  const enviarCobrancaMutation = useMutation({
    mutationFn: async (lote: LoteOperacional) => {
      setActionLoading(lote.id);
      // Por enquanto apenas simula o envio
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // TODO: Implementar envio de email de cobrança real
    },
    onSuccess: () => {
      toast.success("Email de cobrança enviado!");
      setActionLoading(null);
    },
    onError: () => {
      toast.error("Erro ao enviar cobrança");
      setActionLoading(null);
    },
  });

  const handleAction = (lote: LoteOperacional, actionType: string) => {
    switch (actionType) {
      case "enviar":
        setConfirmEnviarDialog(lote);
        break;
      case "processar":
        setProcessarRetornoDialog(lote);
        break;
      case "pendencia":
        enviarCobrancaMutation.mutate(lote);
        break;
      case "faturar":
        setConfirmFaturarDialog(lote);
        break;
    }
  };

  const handlePageChange = (status: LoteStatus, page: number) => {
    setPages((prev) => ({ ...prev, [status]: page }));
  };

  const getTabCount = (data: { count: number } | undefined) => data?.count || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Briefcase className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Operacional</h1>
          <p className="text-muted-foreground">Dashboard de operações - Gestão de lotes mensais</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as LoteStatus)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="aguardando_processamento" className="flex items-center gap-2">
            <Inbox className="h-4 w-4" />
            <span className="hidden sm:inline">Entrada</span>
            <Badge variant="secondary" className="ml-1">
              {getTabCount(entradaData)}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="em_analise_seguradora" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Na Seguradora</span>
            <Badge variant="secondary" className="ml-1">
              {getTabCount(seguradoraData)}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="com_pendencia" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="hidden sm:inline">Pendências</span>
            <Badge variant="destructive" className="ml-1">
              {getTabCount(pendenciaData)}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="concluido" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Prontos</span>
            <Badge variant="default" className="ml-1">
              {getTabCount(concluidoData)}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="aguardando_processamento" className="mt-6">
          <div className="rounded-lg border bg-card p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Inbox className="h-5 w-5 text-blue-500" />
              Lotes Aguardando Processamento
            </h3>
            <LotesTable
              lotes={[...(entradaData?.data || [])].sort((a, b) => {
                // Correções (total_reprovados > 0) aparecem primeiro
                const aIsCorrecao = (a.total_reprovados ?? 0) > 0 ? 1 : 0;
                const bIsCorrecao = (b.total_reprovados ?? 0) > 0 ? 1 : 0;
                return bIsCorrecao - aIsCorrecao;
              })}
              isLoading={entradaLoading}
              currentPage={pages.aguardando_processamento}
              totalPages={Math.ceil(getTabCount(entradaData) / ITEMS_PER_PAGE)}
              onPageChange={(page) => handlePageChange("aguardando_processamento", page)}
              actionType="enviar"
              onAction={(lote) => handleAction(lote, "enviar")}
              actionLoading={actionLoading}
            />
          </div>
        </TabsContent>

        <TabsContent value="em_analise_seguradora" className="mt-6">
          <div className="rounded-lg border bg-card p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              Lotes em Análise na Seguradora
            </h3>
            <LotesTable
              lotes={seguradoraData?.data || []}
              isLoading={seguradoraLoading}
              currentPage={pages.em_analise_seguradora}
              totalPages={Math.ceil(getTabCount(seguradoraData) / ITEMS_PER_PAGE)}
              onPageChange={(page) => handlePageChange("em_analise_seguradora", page)}
              actionType="processar"
              onAction={(lote) => handleAction(lote, "processar")}
              actionLoading={actionLoading}
            />
          </div>
        </TabsContent>

        <TabsContent value="com_pendencia" className="mt-6">
          <div className="rounded-lg border border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20 p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2 text-orange-700 dark:text-orange-400">
              <AlertTriangle className="h-5 w-5" />
              Lotes com Pendências (Aguardando Correção do Cliente)
            </h3>
            <LotesTable
              lotes={pendenciaData?.data || []}
              isLoading={pendenciaLoading}
              currentPage={pages.com_pendencia}
              totalPages={Math.ceil(getTabCount(pendenciaData) / ITEMS_PER_PAGE)}
              onPageChange={(page) => handlePageChange("com_pendencia", page)}
              actionType="pendencia"
              onAction={(lote) => handleAction(lote, "pendencia")}
              actionLoading={actionLoading}
            />
          </div>
        </TabsContent>

        <TabsContent value="concluido" className="mt-6">
          <div className="rounded-lg border border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20 p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle className="h-5 w-5" />
              Lotes Prontos para Faturamento
            </h3>
            <LotesTable
              lotes={concluidoData?.data || []}
              isLoading={concluidoLoading}
              currentPage={pages.concluido}
              totalPages={Math.ceil(getTabCount(concluidoData) / ITEMS_PER_PAGE)}
              onPageChange={(page) => handlePageChange("concluido", page)}
              actionType="faturar"
              onAction={(lote) => handleAction(lote, "faturar")}
              actionLoading={actionLoading}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Confirm Enviar Dialog */}
      <AlertDialog open={!!confirmEnviarDialog} onOpenChange={() => setConfirmEnviarDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar para Seguradora?</AlertDialogTitle>
            <AlertDialogDescription>
              O lote de <strong>{confirmEnviarDialog?.empresa?.nome}</strong> ({confirmEnviarDialog?.competencia}) com{" "}
              {confirmEnviarDialog?.total_colaboradores} colaboradores será enviado para análise da seguradora.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmEnviarDialog && enviarParaSeguradoraMutation.mutate(confirmEnviarDialog.id)}
            >
              Confirmar Envio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Faturar Dialog */}
      <AlertDialog open={!!confirmFaturarDialog} onOpenChange={() => setConfirmFaturarDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Liberar para Faturamento?</AlertDialogTitle>
            <AlertDialogDescription>
              O lote de <strong>{confirmFaturarDialog?.empresa?.nome}</strong> ({confirmFaturarDialog?.competencia})
              será liberado para o setor financeiro emitir a nota fiscal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmFaturarDialog && liberarFaturamentoMutation.mutate(confirmFaturarDialog.id)}
            >
              Liberar Faturamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Processar Retorno Dialog */}
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

export default Operacional;
