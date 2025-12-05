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
type TabType = "entrada" | "seguradora" | "pendencias" | "reanalise" | "prontos";

export default function Operacional() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>("entrada");
  const [currentPages, setCurrentPages] = useState<Record<string, number>>({
    entrada: 1,
    seguradora: 1,
    pendencias: 1,
    reanalise: 1,
    prontos: 1,
  });

  // Dialogs States
  const [selectedLote, setSelectedLote] = useState<LoteOperacional | null>(null);
  const [confirmEnviarDialog, setConfirmEnviarDialog] = useState(false);
  const [confirmFaturarDialog, setConfirmFaturarDialog] = useState(false);
  const [processarDialogOpen, setProcessarDialogOpen] = useState(false);
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
      return data as LoteOperacional[];
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

      case "pendencias":
        // Lotes travados com o cliente
        return lotes.filter((l) => l.status === "com_pendencia");

      case "reanalise":
        // O Ciclo de Correção:
        // 1. aguardando_reanalise (Cliente mandou)
        // 2. em_reanalise (Admin mandou pra seguradora de novo)
        return lotes.filter((l) => ["aguardando_reanalise", "em_reanalise"].includes(l.status));

      case "prontos":
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
      setConfirmEnviarDialog(false);
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
      toast.success("Enviado para 2ª Análise (Reenvio)");
      setConfirmEnviarDialog(false);
      setActionLoading(null);
    },
    onError: (e: any) => {
      toast.error("Erro: " + e.message);
      setActionLoading(null);
    },
  });

  // 3. Faturar
  const faturarMutation = useMutation({
    mutationFn: async (loteId: string) => {
      setActionLoading(loteId);
      const { error } = await supabase.from("lotes_mensais").update({ status: "faturado" }).eq("id", loteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lotes-operacional"] });
      toast.success("Lote faturado!");
      setConfirmFaturarDialog(false);
      setActionLoading(null);
    },
    onError: (e: any) => {
      toast.error("Erro: " + e.message);
      setActionLoading(null);
    },
  });

  // --- HANDLERS ---

  const handleAction = (lote: LoteOperacional, tab: string) => {
    setSelectedLote(lote);

    if (tab === "entrada") {
      setConfirmEnviarDialog(true); // Vai usar enviarNovo
    } else if (tab === "reanalise") {
      if (lote.status === "aguardando_reanalise")
        setConfirmEnviarDialog(true); // Vai usar reenviarReanalise
      else if (lote.status === "em_reanalise") setProcessarDialogOpen(true);
    } else if (tab === "seguradora") {
      setProcessarDialogOpen(true);
    } else if (tab === "prontos") {
      setConfirmFaturarDialog(true);
    } else if (tab === "pendencias") {
      toast.info("Aguardando correção do cliente...");
    }
  };

  const handleConfirmarEnvio = () => {
    if (!selectedLote) return;

    if (selectedLote.status === "aguardando_reanalise") {
      reenviarReanaliseMutation.mutate(selectedLote.id);
    } else {
      enviarNovoMutation.mutate(selectedLote.id);
    }
  };

  // Helper de Paginação
  const getPaginatedLotes = (tab: TabType) => {
    const data = getLotesByTab(tab);
    const page = currentPages[tab] || 1;
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
            id="pendencias"
            label="Pendências"
            icon={AlertTriangle}
            count={getLotesByTab("pendencias").length}
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
            id="prontos"
            label="Prontos"
            icon={CheckCircle2}
            count={getLotesByTab("prontos").length}
            variant="default"
          />
        </TabsList>

        <TabsContent value="entrada" className="mt-6">
          <TabCard title="Novos Lotes (Aguardando)" icon={Inbox} color="text-blue-500">
            <LotesTable
              lotes={getPaginatedLotes("entrada")}
              isLoading={isLoading}
              currentPage={currentPages.entrada}
              totalPages={getTotalPages("entrada")}
              onPageChange={(p) => setCurrentPages((prev) => ({ ...prev, entrada: p }))}
              actionType="enviar"
              onAction={(l) => handleAction(l, "entrada")}
              actionLoading={actionLoading}
            />
          </TabCard>
        </TabsContent>

        <TabsContent value="seguradora" className="mt-6">
          <TabCard title="Novos na Seguradora" icon={Clock} color="text-yellow-500">
            <LotesTable
              lotes={getPaginatedLotes("seguradora")}
              isLoading={isLoading}
              currentPage={currentPages.seguradora}
              totalPages={getTotalPages("seguradora")}
              onPageChange={(p) => setCurrentPages((prev) => ({ ...prev, seguradora: p }))}
              actionType="processar"
              onAction={(l) => handleAction(l, "seguradora")}
              actionLoading={actionLoading}
            />
          </TabCard>
        </TabsContent>

        <TabsContent value="pendencias" className="mt-6">
          <TabCard title="Aguardando Correção do Cliente" icon={AlertTriangle} color="text-red-500">
            <LotesTable
              lotes={getPaginatedLotes("pendencias")}
              isLoading={isLoading}
              currentPage={currentPages.pendencias}
              totalPages={getTotalPages("pendencias")}
              onPageChange={(p) => setCurrentPages((prev) => ({ ...prev, pendencias: p }))}
              actionType="pendencia"
              onAction={(l) => handleAction(l, "pendencias")}
              actionLoading={actionLoading}
            />
          </TabCard>
        </TabsContent>

        <TabsContent value="reanalise" className="mt-6">
          <TabCard title="Ciclo de Reanálise" icon={RefreshCw} color="text-orange-500">
            <LotesTable
              lotes={getPaginatedLotes("reanalise")}
              isLoading={isLoading}
              currentPage={currentPages.reanalise}
              totalPages={getTotalPages("reanalise")}
              onPageChange={(p) => setCurrentPages((prev) => ({ ...prev, reanalise: p }))}
              // A tabela vai receber o tipo "reanalise" e decidir se mostra "Reenviar" ou "Processar"
              actionType="reanalise"
              onAction={(l) => handleAction(l, "reanalise")}
              actionLoading={actionLoading}
            />
          </TabCard>
        </TabsContent>

        <TabsContent value="prontos" className="mt-6">
          <TabCard title="Prontos para Faturamento" icon={CheckCircle2} color="text-green-500">
            <LotesTable
              lotes={getPaginatedLotes("prontos")}
              isLoading={isLoading}
              currentPage={currentPages.prontos}
              totalPages={getTotalPages("prontos")}
              onPageChange={(p) => setCurrentPages((prev) => ({ ...prev, prontos: p }))}
              actionType="faturar"
              onAction={(l) => handleAction(l, "prontos")}
              actionLoading={actionLoading}
            />
          </TabCard>
        </TabsContent>
      </Tabs>

      {/* DIALOG DE CONFIRMAÇÃO DE ENVIO */}
      <AlertDialog open={confirmEnviarDialog} onOpenChange={setConfirmEnviarDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedLote?.status === "aguardando_reanalise" ? "Reenviar Correção?" : "Enviar Novo Lote?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedLote?.status === "aguardando_reanalise"
                ? "O lote corrigido será enviado para a fila de 'Em Reanálise'."
                : "O lote será enviado para análise inicial da seguradora."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmarEnvio}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* DIALOG DE FATURAMENTO */}
      <AlertDialog open={confirmFaturarDialog} onOpenChange={setConfirmFaturarDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Liberar Faturamento?</AlertDialogTitle>
            <AlertDialogDescription>O status será alterado para faturado.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => selectedLote && faturarMutation.mutate(selectedLote.id)}>
              Liberar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* DIALOG DE PROCESSAMENTO DE RETORNO */}
      {selectedLote && (
        <ProcessarRetornoDialog
          open={processarDialogOpen}
          onOpenChange={setProcessarDialogOpen}
          loteId={selectedLote.id}
          empresaNome={selectedLote.empresa?.nome || ""}
          competencia={selectedLote.competencia}
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
