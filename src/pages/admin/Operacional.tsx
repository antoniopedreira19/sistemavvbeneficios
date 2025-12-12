import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Building2, Clock, AlertTriangle, RefreshCw, CheckCircle2, Inbox, Upload, Search } from "lucide-react";
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
import { Input } from "@/components/ui/input";
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
  const [searchTerm, setSearchTerm] = useState(""); // Novo estado de busca
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

  // --- FILTRO E ORDENAÇÃO ---
  const getLotesByTab = (tab: TabType) => {
    let filteredLotes = [];

    // 1. Filtrar por Status (Aba)
    switch (tab) {
      case "entrada":
        filteredLotes = lotes.filter((l) => l.status === "aguardando_processamento");
        break;
      case "seguradora":
        filteredLotes = lotes.filter((l) => l.status === "em_analise_seguradora");
        break;
      case "pendencia":
        filteredLotes = lotes.filter((l) => l.status === "com_pendencia");
        break;
      case "reanalise":
        filteredLotes = lotes.filter((l) => ["aguardando_reanalise", "em_reanalise"].includes(l.status));
        break;
      case "concluido":
        filteredLotes = lotes.filter((l) => ["concluido", "faturado"].includes(l.status));
        break;
      default:
        filteredLotes = [];
    }

    // 2. Filtrar por Busca (Nome da Empresa)
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      filteredLotes = filteredLotes.filter((l) => l.empresa?.nome?.toLowerCase().includes(lowerTerm));
    }

    // 3. Ordenar Alfabeticamente (Nome da Empresa)
    return filteredLotes.sort((a, b) => {
      const nomeA = a.empresa?.nome || "";
      const nomeB = b.empresa?.nome || "";
      return nomeA.localeCompare(nomeB);
    });
  };

  // ... (Resto das mutações: enviar, reenviar, faturar - MANTIDAS IGUAIS) ...
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
    else if (tab === "pendencia") {
      // Ação futura: enviar email ao cliente
      toast.success("Email de pendência enviado ao cliente (ação futura).");
    }
  };

  const handleConfirmarEnvio = () => {
    if (!selectedLote) return;
    if (selectedLote.status === "aguardando_reanalise") reenviarReanaliseMutation.mutate(selectedLote.id);
    else enviarNovoMutation.mutate(selectedLote.id);
  };

  const getPaginatedLotes = (tab: TabType) => {
    const data = getLotesByTab(tab);
    const page = pages[tab] || 1;
    const start = (page - 1) * ITEMS_PER_PAGE;
    return data.slice(start, start + ITEMS_PER_PAGE);
  };
  const getTotalPages = (tab: TabType) => Math.ceil(getLotesByTab(tab).length / ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Building2 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Operacional</h1>
            <p className="text-muted-foreground">Gestão de Fluxo de Lotes</p>
          </div>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar empresa..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button onClick={() => setImportarDialogOpen(true)} variant="outline">
            <Upload className="mr-2 h-4 w-4" /> Importar Lote
          </Button>
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
          handleDownloadLote,
          setLoteParaEditar,
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
          handleDownloadLote,
          setLoteParaEditar,
        )}
        {renderTabContent(
          "pendencia",
          "Lotes com Pendências (Reprovados)",
          <AlertTriangle className="text-red-500" />,
          getPaginatedLotes,
          pages,
          setPages,
          handleAction,
          actionLoading,
          "pendencia",
          getTotalPages,
          handleDownloadLote,
          setLoteParaEditar,
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
          handleDownloadLote,
          setLoteParaEditar,
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
  onDownload: any,
  onEdit: any,
) {
  return (
    <TabsContent value={value} className="mt-6">
      <TabCard title={title} icon={icon.type} color={icon.props.className}>
        <LotesTable
          lotes={getLotes(value)}
          isLoading={false}
          currentPage={pages[value]}
          totalPages={getTotal(value)}
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
