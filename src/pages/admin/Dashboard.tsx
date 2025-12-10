import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Building2,
  Clock,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Inbox,
  Upload,
  Users,
  DollarSign,
} from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { LotesTable, LoteOperacional } from "@/components/admin/operacional/LotesTable";
import { ProcessarRetornoDialog } from "@/components/admin/operacional/ProcessarRetornoDialog";
import { AdminImportarLoteDialog } from "@/components/admin/operacional/AdminImportarLoteDialog";
import { EditarLoteDialog } from "@/components/admin/operacional/EditarLoteDialog";
import ExcelJS from "exceljs";
import { formatCNPJ, formatCPF } from "@/lib/validators";

const ITEMS_PER_PAGE = 10;

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
  const [selectedLote, setSelectedLote] = useState<LoteOperacional | null>(null);
  const [loteParaEditar, setLoteParaEditar] = useState<LoteOperacional | null>(null);

  const [confirmEnviarDialog, setConfirmEnviarDialog] = useState(false);
  const [confirmFaturarDialog, setConfirmFaturarDialog] = useState(false);
  const [processarDialogOpen, setProcessarDialogOpen] = useState(false);
  const [importarDialogOpen, setImportarDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // --- QUERY ---
  const { data: lotes = [], isLoading } = useQuery({
    queryKey: ["lotes-operacional"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lotes_mensais")
        .select(
          `
          id, competencia, total_colaboradores, total_reprovados, total_aprovados, valor_total, created_at, status, empresa_id,
          empresa:empresas(nome, cnpj),
          obra:obras(id, nome)
        `,
        )
        .in("status", [
          "aguardando_processamento",
          "em_analise_seguradora",
          "com_pendencia",
          "aguardando_reanalise",
          "em_reanalise",
          "concluido",
          "faturado",
        ])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as unknown as LoteOperacional[];
    },
  });

  const getLotesByTab = (tab: TabType) => {
    switch (tab) {
      case "entrada":
        return lotes.filter((l) => l.status === "aguardando_processamento");
      case "seguradora":
        return lotes.filter((l) => l.status === "em_analise_seguradora");
      case "pendencia":
        return lotes.filter((l) => l.status === "com_pendencia");
      case "reanalise":
        return lotes.filter((l) => ["aguardando_reanalise", "em_reanalise"].includes(l.status));
      case "concluido":
        return lotes.filter((l) => ["concluido", "faturado"].includes(l.status));
      default:
        return [];
    }
  };

  // --- MUTAÇÕES ---
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
      toast.success("Enviado para Seguradora");
      setConfirmEnviarDialog(false);
      setActionLoading(null);
      setSelectedLote(null);
    },
    onError: (e: any) => {
      toast.error("Erro: " + e.message);
      setActionLoading(null);
    },
  });

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
      toast.success("Reenviado para análise");
      setConfirmEnviarDialog(false);
      setActionLoading(null);
      setSelectedLote(null);
    },
    onError: (e: any) => {
      toast.error("Erro: " + e.message);
      setActionLoading(null);
    },
  });

  const faturarMutation = useMutation({
    mutationFn: async (lote: LoteOperacional) => {
      setActionLoading(lote.id);
      const vidas = (lote.total_colaboradores || 0) - (lote.total_reprovados || 0);
      const valor = vidas * 50;
      const { error } = await supabase
        .from("lotes_mensais")
        .update({ status: "faturado", valor_total: valor })
        .eq("id", lote.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lotes-operacional"] });
      toast.success("Faturado com sucesso!");
      setConfirmFaturarDialog(false);
      setActionLoading(null);
      setSelectedLote(null);
    },
    onError: (e: any) => {
      toast.error("Erro: " + e.message);
      setActionLoading(null);
    },
  });

  // --- DOWNLOAD ---
  const handleDownloadLote = async (lote: LoteOperacional) => {
    try {
      toast.info("Preparando download...");
      const { data: itens, error } = await supabase
        .from("colaboradores_lote")
        .select("nome, sexo, cpf, data_nascimento, salario, classificacao_salario")
        .eq("lote_id", lote.id)
        .eq("status_seguradora", "aprovado")
        .order("nome");

      if (error) throw error;
      if (!itens || itens.length === 0) {
        toast.warning("Lote vazio.");
        return;
      }

      let cnpj = (lote.empresa as any)?.cnpj || "";
      if (!cnpj && lote.empresa_id) {
        const { data: emp } = await supabase.from("empresas").select("cnpj").eq("id", lote.empresa_id).single();
        if (emp) cnpj = emp.cnpj;
      }
      cnpj = cnpj.replace(/\D/g, "");

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Lista Seguradora");
      const headers = [
        "NOME COMPLETO",
        "SEXO",
        "CPF",
        "DATA NASCIMENTO",
        "SALARIO",
        "CLASSIFICACAO SALARIAL",
        "CNPJ DA EMPRESA",
      ];
      const headerRow = worksheet.addRow(headers);

      const COL_WIDTH = 37.11;
      worksheet.columns = headers.map(() => ({ width: COL_WIDTH }));

      headerRow.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF203455" } };
        cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
        cell.alignment = { horizontal: "center" };
      });

      itens.forEach((c) => {
        let dataNascDate = null;
        if (c.data_nascimento) {
          const parts = c.data_nascimento.split("-");
          if (parts.length === 3)
            dataNascDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        }

        const row = worksheet.addRow([
          c.nome.toUpperCase(),
          c.sexo,
          formatCPF(c.cpf),
          dataNascDate,
          Number(c.salario),
          c.classificacao_salario,
          formatCNPJ(cnpj),
        ]);
        if (dataNascDate) row.getCell(4).numFmt = "dd/mm/yyyy";
        row.getCell(5).numFmt = "#,##0.00";
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `SEGURADORA_${lote.empresa?.nome.replace(/[^a-zA-Z0-9]/g, "")}_${lote.competencia.replace("/", "-")}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Download concluído.");
    } catch (e: any) {
      console.error(e);
      toast.error("Erro: " + e.message);
    }
  };

  const handleAction = (lote: LoteOperacional, tab: string) => {
    setSelectedLote(lote);
    if (tab === "entrada") setConfirmEnviarDialog(true);
    else if (tab === "reanalise") {
      if (lote.status === "aguardando_reanalise") setConfirmEnviarDialog(true);
      else setProcessarDialogOpen(true);
    } else if (tab === "seguradora") setProcessarDialogOpen(true);
    else if (tab === "concluido") setConfirmFaturarDialog(true);
    else if (tab === "pendencia") toast.success("Cobrança enviada.");
  };

  const handleConfirmarEnvio = () => {
    if (!selectedLote) return;
    if (selectedLote.status === "aguardando_reanalise") reenviarReanaliseMutation.mutate(selectedLote.id);
    else enviarNovoMutation.mutate(selectedLote.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Operacional</h1>
            <p className="text-muted-foreground">Gestão de Fluxo de Lotes</p>
          </div>
        </div>
        <Button onClick={() => setImportarDialogOpen(true)} variant="outline">
          <Upload className="mr-2 h-4 w-4" /> Importar Lote Pronto
        </Button>
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

        {/* RENDERIZAR ABAS COM OS NOVOS ARGUMENTOS */}
        {renderTabContent(
          "entrada",
          "Entrada de Novos Lotes",
          <Inbox className="text-blue-500" />,
          getLotesByTab("entrada"),
          pages,
          setPages,
          handleAction,
          actionLoading,
          "enviar",
          handleDownloadLote,
          setLoteParaEditar,
        )}
        {renderTabContent(
          "seguradora",
          "Novos em Análise",
          <Clock className="text-yellow-500" />,
          getLotesByTab("seguradora"),
          pages,
          setPages,
          handleAction,
          actionLoading,
          "processar",
          handleDownloadLote,
          setLoteParaEditar,
        )}
        {renderTabContent(
          "pendencia",
          "Aguardando Cliente",
          <AlertTriangle className="text-red-500" />,
          getLotesByTab("pendencia"),
          pages,
          setPages,
          handleAction,
          actionLoading,
          "pendencia",
          handleDownloadLote,
          setLoteParaEditar,
        )}
        {renderTabContent(
          "reanalise",
          "Ciclo de Correção",
          <RefreshCw className="text-orange-500" />,
          getLotesByTab("reanalise"),
          pages,
          setPages,
          handleAction,
          actionLoading,
          "reanalise",
          handleDownloadLote,
          setLoteParaEditar,
        )}
        {renderTabContent(
          "concluido",
          "Prontos para Faturamento",
          <CheckCircle2 className="text-green-500" />,
          getLotesByTab("concluido"),
          pages,
          setPages,
          handleAction,
          actionLoading,
          "faturar",
          handleDownloadLote,
          setLoteParaEditar,
        )}
      </Tabs>

      <AlertDialog open={confirmEnviarDialog} onOpenChange={setConfirmEnviarDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedLote?.status === "aguardando_reanalise" ? "Reenviar Correção?" : "Enviar Novo Lote?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedLote?.status === "aguardando_reanalise"
                ? "O lote corrigido será enviado para seguradora."
                : "O lote será enviado para análise inicial da seguradora."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmarEnvio}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmFaturarDialog} onOpenChange={setConfirmFaturarDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Liberar Faturamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá gerar a NF para o lote de <strong>{selectedLote?.empresa?.nome}</strong>.<br />
              Valor estimado:{" "}
              <strong>R$ {((selectedLote?.total_colaboradores || 0) * 50).toLocaleString("pt-BR")}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => selectedLote && faturarMutation.mutate(selectedLote)}>
              Liberar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AdminImportarLoteDialog open={importarDialogOpen} onOpenChange={setImportarDialogOpen} />

      {selectedLote && (
        <ProcessarRetornoDialog
          open={processarDialogOpen}
          onOpenChange={setProcessarDialogOpen}
          loteId={selectedLote.id}
          empresaNome={selectedLote.empresa?.nome || ""}
          competencia={selectedLote.competencia}
        />
      )}

      {loteParaEditar && (
        <EditarLoteDialog
          lote={loteParaEditar}
          open={!!loteParaEditar}
          onOpenChange={(o) => !o && setLoteParaEditar(null)}
        />
      )}
    </div>
  );
}

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

// --- FUNÇÃO DE RENDERIZAÇÃO ATUALIZADA (COM TOTAIS) ---
function renderTabContent(
  value: TabType,
  title: string,
  icon: any,
  // Agora recebe a lista completa, não a função de get
  lotesDaAba: LoteOperacional[],
  pages: any,
  setPages: any,
  handleAction: any,
  actionLoading: any,
  actionType: any,
  onDownload: any,
  onEdit: any,
) {
  // 1. Cálculos de Totais (Baseados na lista completa da aba)
  const totalVidas = lotesDaAba.reduce((acc, l) => acc + (l.total_colaboradores || 0), 0);
  const totalFaturamento = lotesDaAba.reduce((acc, l) => {
    const val = Number(l.valor_total) || Number(l.total_colaboradores || 0) * 50;
    return acc + val;
  }, 0);

  // 2. Paginação Local
  const totalPages = Math.ceil(lotesDaAba.length / ITEMS_PER_PAGE);
  const currentPage = pages[value] || 1;
  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedLotes = lotesDaAba.slice(start, start + ITEMS_PER_PAGE);

  return (
    <TabsContent value={value} className="mt-6">
      <TabCard title={title} icon={icon.type} color={icon.props.className}>
        {/* --- TOTALIZADORES --- */}
        <div className="flex flex-wrap gap-4 mb-4 p-4 bg-muted/20 rounded-lg border border-muted/30">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 rounded-full text-blue-600">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase">Vidas na Etapa</p>
              <p className="text-lg font-bold text-slate-700">{totalVidas}</p>
            </div>
          </div>
          <div className="w-px h-10 bg-border mx-2 hidden sm:block"></div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-green-100 rounded-full text-green-600">
              <DollarSign className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase">Faturamento (Est.)</p>
              <p className="text-lg font-bold text-slate-700">
                {totalFaturamento.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            </div>
          </div>
        </div>
        {/* ------------------- */}

        <LotesTable
          lotes={paginatedLotes}
          isLoading={false}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={(p: number) => setPages((prev: any) => ({ ...prev, [value]: p }))}
          actionType={actionType}
          onAction={(l: any) => handleAction(l, value)}
          actionLoading={actionLoading}
          onDownload={onDownload}
          onEdit={onEdit}
        />
      </TabCard>
    </TabsContent>
  );
}
