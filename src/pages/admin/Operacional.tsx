import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Briefcase, Inbox, Clock, AlertTriangle, CheckCircle, RotateCcw } from "lucide-react";
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

// Adicionamos 'reanalise' como um estado visual (não do banco)
type TabType = "entrada" | "seguradora" | "pendencia" | "reanalise" | "concluido";

const Operacional = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>("entrada");

  // Estado de paginação para cada aba
  const [pages, setPages] = useState<Record<TabType, number>>({
    entrada: 1,
    seguradora: 1,
    pendencia: 1,
    reanalise: 1,
    concluido: 1,
  });

  // Dialogs state
  const [confirmEnviarDialog, setConfirmEnviarDialog] = useState<LoteOperacional | null>(null);
  const [confirmFaturarDialog, setConfirmFaturarDialog] = useState<LoteOperacional | null>(null);
  const [processarRetornoDialog, setProcessarRetornoDialog] = useState<LoteOperacional | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // --- QUERY INTELIGENTE: Filtra baseado na aba ---
  const fetchLotes = async (tab: TabType) => {
    let query = supabase.from("lotes_mensais").select(
      `
        id, competencia, total_colaboradores, total_reprovados, valor_total, created_at, status, enviado_seguradora_em,
        empresa:empresas(nome),
        obra:obras(nome)
      `,
      { count: "exact" },
    );

    // A Mágica dos Filtros
    switch (tab) {
      case "entrada":
        // Apenas novos (sem histórico de reprovação)
        query = query.eq("status", "aguardando_processamento").eq("total_reprovados", 0);
        break;
      case "seguradora":
        // Apenas novos na seguradora
        query = query.eq("status", "em_analise_seguradora").eq("total_reprovados", 0);
        break;
      case "pendencia":
        // Parados com o cliente
        query = query.eq("status", "com_pendencia");
        break;
      case "reanalise":
        // O Pulo do Gato: Traz os corrigidos (aguardando envio) E os re-enviados (em analise)
        // Identificamos pelo histórico de reprovação > 0
        query = query.in("status", ["aguardando_processamento", "em_analise_seguradora"]).gt("total_reprovados", 0);
        break;
      case "concluido":
        query = query.eq("status", "concluido");
        break;
    }

    // Ordenação e Paginação
    query = query
      .order("created_at", { ascending: false })
      .range((pages[tab] - 1) * ITEMS_PER_PAGE, pages[tab] * ITEMS_PER_PAGE - 1);

    const { data, error, count } = await query;
    if (error) throw error;
    return { data: data as LoteOperacional[], count: count || 0 };
  };

  // Queries (Hooks do Tanstack)
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

  // Mutations (Ações)
  const enviarMutation = useMutation({
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
      toast.success("Enviado para Seguradora com sucesso!");
      setConfirmEnviarDialog(null);
      setActionLoading(null);
    },
    onError: (e) => {
      console.error(e);
      toast.error("Erro ao enviar.");
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
    onError: (e) => {
      toast.error("Erro ao liberar.");
      setActionLoading(null);
    },
  });

  // Função centralizadora de ações
  const handleAction = (lote: LoteOperacional, action: string) => {
    if (action === "enviar") setConfirmEnviarDialog(lote);
    if (action === "processar") setProcessarRetornoDialog(lote);
    if (action === "faturar") setConfirmFaturarDialog(lote);
    if (action === "pendencia") toast.info("Funcionalidade de cobrança em breve");
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

        {/* --- CONTEÚDO DAS ABAS --- */}

        {/* 1. Entrada (Novos) */}
        <TabsContent value="entrada" className="mt-6">
          <TabContainer title="Entrada de Novos Lotes" icon={<Inbox className="text-blue-500" />}>
            <LotesTable
              lotes={queries.entrada.data?.data || []}
              isLoading={queries.entrada.isLoading}
              currentPage={pages.entrada}
              totalPages={Math.ceil((queries.entrada.data?.count || 0) / ITEMS_PER_PAGE)}
              onPageChange={(p) => setPages((prev) => ({ ...prev, entrada: p }))}
              actionType="enviar"
              onAction={(l) => handleAction(l, "enviar")}
              actionLoading={actionLoading}
            />
          </TabContainer>
        </TabsContent>

        {/* 2. Seguradora (Novos) */}
        <TabsContent value="seguradora" className="mt-6">
          <TabContainer title="Novos em Análise na Seguradora" icon={<Clock className="text-yellow-500" />}>
            <LotesTable
              lotes={queries.seguradora.data?.data || []}
              isLoading={queries.seguradora.isLoading}
              currentPage={pages.seguradora}
              totalPages={Math.ceil((queries.seguradora.data?.count || 0) / ITEMS_PER_PAGE)}
              onPageChange={(p) => setPages((prev) => ({ ...prev, seguradora: p }))}
              actionType="processar"
              onAction={(l) => handleAction(l, "processar")}
              actionLoading={actionLoading}
            />
          </TabContainer>
        </TabsContent>

        {/* 3. Pendências (Travados) */}
        <TabsContent value="pendencia" className="mt-6">
          <TabContainer title="Aguardando Correção do Cliente" icon={<AlertTriangle className="text-red-500" />}>
            <LotesTable
              lotes={queries.pendencia.data?.data || []}
              isLoading={queries.pendencia.isLoading}
              currentPage={pages.pendencia}
              totalPages={Math.ceil((queries.pendencia.data?.count || 0) / ITEMS_PER_PAGE)}
              onPageChange={(p) => setPages((prev) => ({ ...prev, pendencia: p }))}
              actionType="pendencia"
              onAction={(l) => handleAction(l, "pendencia")}
              actionLoading={actionLoading}
            />
          </TabContainer>
        </TabsContent>

        {/* 4. Reanálise (Fluxo de Correção) */}
        <TabsContent value="reanalise" className="mt-6">
          <TabContainer title="Revisão de Correções e Retornos" icon={<RotateCcw className="text-orange-500" />}>
            <LotesTable
              lotes={queries.reanalise.data?.data || []}
              isLoading={queries.reanalise.isLoading}
              currentPage={pages.reanalise}
              totalPages={Math.ceil((queries.reanalise.data?.count || 0) / ITEMS_PER_PAGE)}
              onPageChange={(p) => setPages((prev) => ({ ...prev, reanalise: p }))}
              // AQUI A MÁGICA: Se já enviei (status analise), exibe botão Processar. Se só chegou (status aguardando), botão Enviar.
              actionType="dinamico"
              onAction={(l) => {
                if (l.status === "aguardando_processamento") handleAction(l, "enviar");
                else handleAction(l, "processar");
              }}
              actionLoading={actionLoading}
            />
          </TabContainer>
        </TabsContent>

        {/* 5. Concluídos */}
        <TabsContent value="concluido" className="mt-6">
          <TabContainer title="Prontos para Faturamento" icon={<CheckCircle className="text-green-500" />}>
            <LotesTable
              lotes={queries.concluido.data?.data || []}
              isLoading={queries.concluido.isLoading}
              currentPage={pages.concluido}
              totalPages={Math.ceil((queries.concluido.data?.count || 0) / ITEMS_PER_PAGE)}
              onPageChange={(p) => setPages((prev) => ({ ...prev, concluido: p }))}
              actionType="faturar"
              onAction={(l) => handleAction(l, "faturar")}
              actionLoading={actionLoading}
            />
          </TabContainer>
        </TabsContent>
      </Tabs>

      {/* DIALOGS (Confirm Enviar, Faturar, Processar) */}
      <AlertDialog open={!!confirmEnviarDialog} onOpenChange={() => setConfirmEnviarDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar para Seguradora?</AlertDialogTitle>
            <AlertDialogDescription>O status será atualizado para "Em Análise".</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmEnviarDialog && enviarMutation.mutate(confirmEnviarDialog.id)}>
              Confirmar Envio
            </AlertDialogAction>
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

// Componente visual simples para o card branco de cada aba
const TabContainer = ({ title, icon, children }: any) => (
  <div className="rounded-lg border bg-card p-4">
    <h3 className="font-semibold mb-4 flex items-center gap-2">
      {icon} {title}
    </h3>
    {children}
  </div>
);

export default Operacional;
