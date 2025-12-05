import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Building2, Clock, AlertTriangle, RefreshCw, CheckCircle2, Inbox } from "lucide-react";
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
import { LotesTable, LoteOperacional } from "@/components/admin/operacional/LotesTable";
import { ProcessarRetornoDialog } from "@/components/admin/operacional/ProcessarRetornoDialog";

const ITEMS_PER_PAGE = 10;

// Tipagem exata das abas visuais
type TabType = "entrada" | "seguradora" | "pendencia" | "reanalise" | "concluido";

export default function Operacional() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>("entrada");
  const [pages, setPages] = useState<Record<TabType, number>>({
    entrada: 1,
    seguradora: 1,
    pendencia: 1,
    reanalise: 1,
    concluido: 1,
  });

  // Dialogs States
  const [confirmEnviarDialog, setConfirmEnviarDialog] = useState<LoteOperacional | null>(null);
  const [confirmFaturarDialog, setConfirmFaturarDialog] = useState<LoteOperacional | null>(null);
  const [processarRetornoDialog, setProcessarRetornoDialog] = useState<LoteOperacional | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // --- QUERY INTELIGENTE ---
  const { data: lotes = [], isLoading } = useQuery({
    queryKey: ["lotes-operacional"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lotes_mensais")
        .select(
          `
          id, competencia, total_colaboradores, total_reprovados, valor_total, created_at, status, 
          empresa:empresas(nome),
          obra:obras(nome)
        `,
        )
        // Buscamos todos os status relevantes para o dashboard
        .in("status", [
          "aguardando_processamento",
          "em_analise_seguradora",
          "com_pendencia",
          "aguardando_reanalise",
          "em_reanalise",
          "concluido",
        ])
        .order("created_at", { ascending: false });

      if (error) throw error;
      // Cast forçado para aceitar os novos status do TS se ainda não tiverem atualizados no type global
      return data as unknown as LoteOperacional[];
    },
  });

  // --- FILTRAGEM RÍGIDA (A Lógica do Túnel) ---
  const getLotesByTab = (tab: TabType) => {
    switch (tab) {
      case "entrada":
        // Apenas Lotes Novos (Nunca passaram por reprovação ou reanálise)
        return lotes.filter((l) => l.status === "aguardando_processamento");

      case "seguradora":
        // Apenas Lotes Novos na Seguradora
        return lotes.filter((l) => l.status === "em_analise_seguradora");

      case "pendencia":
        // Lotes travados com o cliente
        return lotes.filter((l) => l.status === "com_pendencia");

      case "reanalise":
        // O Ciclo de Correção:
        // 1. aguardando_reanalise (Cliente mandou)
        // 2. em_reanalise (Admin mandou pra seguradora de novo)
        return lotes.filter((l) => ["aguardando_reanalise", "em_reanalise"].includes(l.status));

      case "concluido":
        return lotes.filter((l) => l.status === "concluido");

      default:
        return [];
    }
  };

  // --- MUTAÇÕES ---

  // 1. Enviar Lote NOVO (Entrada -> Seguradora)
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
      queryClient.invalidateQueries({ queryKey: ["lotes-operacional"] });
      toast.success("Enviado para Seguradora (Novo)");
      setConfirmEnviarDialog(null);
      setActionLoading(null);
    },
    onError: (e: any) => {
      toast.error("Erro: " + e.message);
      setActionLoading(null);
    },
  });

  // 2. Reenviar Lote CORRIGIDO (Reanálise -> Em Reanálise)
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
      queryClient.invalidateQueries({ queryKey: ["lotes-operacional"] });
      toast.success("Lote reenviado para a Seguradora!");
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
      queryClient.invalidateQueries({ queryKey: ["lotes-operacional"] });
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
    if (tab === "entrada") {
      setConfirmEnviarDialog(lote); // Vai usar enviarNovo
    } else if (tab === "reanalise") {
      if (lote.status === "aguardando_reanalise")
        setConfirmEnviarDialog(lote); // Vai usar reenviarReanalise
      else if (lote.status === "em_reanalise") setProcessarRetornoDialog(lote);
    } else if (tab === "seguradora") {
      setProcessarRetornoDialog(lote);
    } else if (tab === "concluido") {
      setConfirmFaturarDialog(lote);
    } else if (tab === "pendencia") {
      toast.info("Aguardando correção do cliente...");
    }
  };

  const handleConfirmarEnvio = () => {
    if (!confirmEnviarDialog) return;

    if (confirmEnviarDialog.status === "aguardando_reanalise") {
      reenviarReanaliseMutation.mutate(confirmEnviarDialog.id);
    } else {
      enviarNovoMutation.mutate(confirmEnviarDialog.id);
    }
  };

  // Helper de Paginação
  const getPaginatedLotes = (tab: TabType) => {
    const data = getLotesByTab(tab);
    const page = pages[tab] || 1;
    const start = (page - 1) * ITEMS_PER_PAGE;
    return data.slice(start, start + ITEMS_PER_PAGE);
  };

  const getTotalPages = (tab: TabType) => Math.ceil(getLotesByTab(tab).length / ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Building2 className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Operacional</h1>
          <p className="text-muted-foreground">Gestão de Fluxo de Lotes</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
        <TabsList className="grid w-full grid-cols-5">
          <TabTriggerItem id="entrada" label="Entrada" icon={Inbox} count={getLotesByTab("entrada").length} />
          <TabTriggerItem id="seguradora" label="Seguradora" icon={Clock} count={getLotesByTab("seguradora").length} />
          <TabTriggerItem
            id="pendencia"
            label="Pendências"
            icon={AlertTriangle}
            count={getLotesByTab("pendencia").length}
            variant="destructive"
          />
          <TabTriggerItem
            id="reanalise"
            label="Reanálise"
            icon={RefreshCw}
            count={getLotesByTab("reanalise").length}
            variant="outline"
          />
          <TabTriggerItem
            id="concluido"
            label="Prontos"
            icon={CheckCircle2}
            count={getLotesByTab("concluido").length}
            variant="default"
          />
        </TabsList>

        {/* Renderiza as abas */}
        {renderTabContent(
          "entrada",
          "Entrada de Novos Lotes",
          <Inbox className="text-blue-500" />,
          getPaginatedLotes,
          pages,
          setPages,
          handleAction,
          actionLoading,
          "enviar",
          getTotalPages,
        )}
        {renderTabContent(
          "seguradora",
          "Novos em Análise",
          <Clock className="text-yellow-500" />,
          getPaginatedLotes,
          pages,
          setPages,
          handleAction,
          actionLoading,
          "processar",
          getTotalPages,
        )}
        {renderTabContent(
          "pendencia",
          "Aguardando Cliente",
          <AlertTriangle className="text-red-500" />,
          getPaginatedLotes,
          pages,
          setPages,
          handleAction,
          actionLoading,
          "pendencia",
          getTotalPages,
        )}
        {renderTabContent(
          "reanalise",
          "Ciclo de Correção",
          <RefreshCw className="text-orange-500" />,
          getPaginatedLotes,
          pages,
          setPages,
          handleAction,
          actionLoading,
          "reanalise",
          getTotalPages,
        )}
        {renderTabContent(
          "concluido",
          "Prontos para Faturamento",
          <CheckCircle2 className="text-green-500" />,
          getPaginatedLotes,
          pages,
          setPages,
          handleAction,
          actionLoading,
          "faturar",
          getTotalPages,
        )}
      </Tabs>

      {/* DIALOG DE CONFIRMAÇÃO DE ENVIO */}
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
                ? "O lote corrigido será enviado novamente para análise da seguradora."
                : "O lote será enviado para análise inicial da seguradora."}
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
}

// Helpers Visuais
const TabTriggerItem = ({ id, label, icon: Icon, count, variant = "secondary" }: any) => (
  <TabsTrigger value={id} className="flex items-center gap-2">
    <Icon className="h-4 w-4" /> {label}
    <Badge variant={variant} className="ml-1">
      {count}
    </Badge>
  </TabsTrigger>
);

const TabCard = ({ title, icon: Icon, color, children }: any) => (
  <Card>
    <CardHeader className="pb-3">
      <CardTitle className="flex items-center gap-2 text-lg">
        <Icon className={`h-5 w-5 ${color}`} /> {title}
      </CardTitle>
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);

function renderTabContent(
  value: TabType,
  title: string,
  icon: any,
  getLotes: any,
  pages: any,
  setPages: any,
  handleAction: any,
  actionLoading: any,
  actionType: any,
  getTotal: any,
) {
  return (
    <TabsContent value={value} className="mt-6">
      <TabCard title={title} icon={icon.type} color={icon.props.className}>
        <LotesTable
          lotes={getLotes(value)}
          isLoading={false} // Loading handled by parent query
          currentPage={pages[value]}
          totalPages={getTotal(value)}
          onPageChange={(p) => setPages((prev: any) => ({ ...prev, [value]: p }))}
          actionType={actionType}
          onAction={(l) => handleAction(l, value)}
          actionLoading={actionLoading}
        />
      </TabCard>
    </TabsContent>
  );
}
