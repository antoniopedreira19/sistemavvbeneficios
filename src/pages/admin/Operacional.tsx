import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Building2, Clock, AlertTriangle, RefreshCw, CheckCircle2 } from "lucide-react";
import { LotesTable, LoteOperacional } from "@/components/admin/operacional/LotesTable";
import { ProcessarRetornoDialog } from "@/components/admin/operacional/ProcessarRetornoDialog";

const ITEMS_PER_PAGE = 10;

export default function Operacional() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("entrada");
  const [currentPages, setCurrentPages] = useState<Record<string, number>>({
    entrada: 1,
    seguradora: 1,
    pendencias: 1,
    reanalise: 1,
    prontos: 1,
  });
  const [enviarLoading, setEnviarLoading] = useState<string | null>(null);
  const [processarDialogOpen, setProcessarDialogOpen] = useState(false);
  const [selectedLote, setSelectedLote] = useState<LoteOperacional | null>(null);

  // Query para buscar lotes por status
  const { data: lotes, isLoading } = useQuery({
    queryKey: ["lotes-operacional"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lotes_mensais")
        .select(`
          id,
          competencia,
          total_colaboradores,
          total_reprovados,
          valor_total,
          created_at,
          status,
          empresa:empresas(nome),
          obra:obras(nome)
        `)
        .in("status", ["aguardando_processamento", "em_analise_seguradora", "com_pendencia", "concluido"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as LoteOperacional[];
    },
  });

  // Filtrar lotes por tab
  const getLotesByTab = (tab: string) => {
    if (!lotes) return [];
    switch (tab) {
      case "entrada":
        return lotes.filter((l) => l.status === "aguardando_processamento");
      case "seguradora":
        // Novos envios: em_analise_seguradora SEM reprovações anteriores
        return lotes.filter((l) => l.status === "em_analise_seguradora" && (l.total_reprovados ?? 0) === 0);
      case "reanalise":
        // Correções reenviadas: em_analise_seguradora COM reprovações anteriores
        return lotes.filter((l) => l.status === "em_analise_seguradora" && (l.total_reprovados ?? 0) > 0);
      case "pendencias":
        return lotes.filter((l) => l.status === "com_pendencia");
      case "prontos":
        return lotes.filter((l) => l.status === "concluido");
      default:
        return [];
    }
  };

  // Paginação
  const getPaginatedLotes = (tab: string) => {
    const filtered = getLotesByTab(tab);
    const page = currentPages[tab] || 1;
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  };

  const getTotalPages = (tab: string) => {
    return Math.ceil(getLotesByTab(tab).length / ITEMS_PER_PAGE);
  };

  // Enviar para seguradora
  const enviarParaSeguradora = async (lote: LoteOperacional) => {
    setEnviarLoading(lote.id);
    try {
      // Atualizar colaboradores para "enviado"
      const { error: colabError } = await supabase
        .from("colaboradores_lote")
        .update({
          status_seguradora: "enviado",
          data_tentativa: new Date().toISOString(),
        })
        .eq("lote_id", lote.id)
        .eq("status_seguradora", "pendente");

      if (colabError) throw colabError;

      // Atualizar status do lote
      const { error: loteError } = await supabase
        .from("lotes_mensais")
        .update({
          status: "em_analise_seguradora",
          enviado_seguradora_em: new Date().toISOString(),
        })
        .eq("id", lote.id);

      if (loteError) throw loteError;

      queryClient.invalidateQueries({ queryKey: ["lotes-operacional"] });
      toast.success("Lote enviado para seguradora");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao enviar para seguradora");
    } finally {
      setEnviarLoading(null);
    }
  };

  // Abrir dialog de processar retorno
  const abrirProcessarRetorno = (lote: LoteOperacional) => {
    setSelectedLote(lote);
    setProcessarDialogOpen(true);
  };

  // Handler de ação baseado na tab
  const handleAction = (lote: LoteOperacional, tab: string) => {
    switch (tab) {
      case "entrada":
        enviarParaSeguradora(lote);
        break;
      case "seguradora":
      case "reanalise":
        abrirProcessarRetorno(lote);
        break;
      case "pendencias":
        toast.info("Cobrança enviada ao cliente");
        break;
      case "prontos":
        toast.info("Função de faturamento em desenvolvimento");
        break;
    }
  };

  const tabs = [
    { id: "entrada", label: "Entrada", icon: Building2, action: "enviar" as const },
    { id: "seguradora", label: "Seguradora", icon: Clock, action: "processar" as const },
    { id: "pendencias", label: "Pendências", icon: AlertTriangle, action: "pendencia" as const },
    { id: "reanalise", label: "Reanálise", icon: RefreshCw, action: "processar" as const },
    { id: "prontos", label: "Prontos", icon: CheckCircle2, action: "faturar" as const },
  ];

  const getTabTitle = (tabId: string) => {
    switch (tabId) {
      case "entrada":
        return "Novos Lotes para Processar";
      case "seguradora":
        return "Novos em Análise na Seguradora";
      case "reanalise":
        return "Correções em Reanálise";
      case "pendencias":
        return "Aguardando Correção do Cliente";
      case "prontos":
        return "Prontos para Faturamento";
      default:
        return "";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Building2 className="h-8 w-8" />
          Operacional
        </h1>
        <p className="text-muted-foreground">Gestão de Fluxo de Lotes</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          {tabs.map((tab) => {
            const count = getLotesByTab(tab.id).length;
            const Icon = tab.icon;
            return (
              <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {tab.label}
                <span
                  className={`ml-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                    count > 0
                      ? tab.id === "pendencias"
                        ? "bg-destructive text-destructive-foreground"
                        : "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {count}
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {tabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <tab.icon className="h-5 w-5 text-muted-foreground" />
                  {getTabTitle(tab.id)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <LotesTable
                  lotes={getPaginatedLotes(tab.id)}
                  isLoading={isLoading}
                  currentPage={currentPages[tab.id] || 1}
                  totalPages={getTotalPages(tab.id)}
                  onPageChange={(page) => setCurrentPages((prev) => ({ ...prev, [tab.id]: page }))}
                  actionType={tab.action}
                  onAction={(lote) => handleAction(lote, tab.id)}
                  actionLoading={enviarLoading}
                />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

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
