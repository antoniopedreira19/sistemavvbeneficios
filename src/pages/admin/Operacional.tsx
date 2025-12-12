import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Building2, Clock, AlertTriangle, CheckCircle2, Inbox, Upload, Search, ArrowUpDown } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LotesTable, LoteOperacional } from "@/components/admin/operacional/LotesTable";
import { ProcessarRetornoDialog } from "@/components/admin/operacional/ProcessarRetornoDialog";
import { AdminImportarLoteDialog } from "@/components/admin/operacional/AdminImportarLoteDialog";
import { EditarLoteDialog } from "@/components/admin/operacional/EditarLoteDialog";
import ExcelJS from "exceljs";
import { formatCNPJ, formatCPF } from "@/lib/validators";

const ITEMS_PER_PAGE = 10;

type TabType = "entrada" | "seguradora" | "pendencia" | "concluido";
type SortType = "alfabetica" | "recente";

export default function Operacional() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>("entrada");

  // Estados de Filtro e Ordenação
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortType>("alfabetica");

  const [pages, setPages] = useState<Record<TabType, number>>({
    entrada: 1,
    seguradora: 1,
    pendencia: 1,
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
        .in("status", ["aguardando_processamento", "em_analise_seguradora", "com_pendencia", "concluido", "faturado"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as unknown as LoteOperacional[];
    },
  });

  // --- Lógica de Filtragem e Ordenação Dinâmica ---
  const filteredLotes = lotes
    .filter((l) => l.empresa?.nome?.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "alfabetica") {
        return (a.empresa?.nome || "").localeCompare(b.empresa?.nome || "");
      } else {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  const getLotesByTab = (tab: TabType) => {
    switch (tab) {
      case "entrada":
        return filteredLotes.filter((l) => l.status === "aguardando_processamento");
      case "seguradora":
        return filteredLotes.filter((l) => l.status === "em_analise_seguradora");
      case "pendencia":
        return filteredLotes.filter((l) => l.status === "com_pendencia");
      case "concluido":
        return filteredLotes.filter((l) => l.status === "concluido" || l.status === "faturado");
      default:
        return [];
    }
  };

  // --- MUTAÇÃO DE ENVIO COM GERAÇÃO DE EXCEL E UPLOAD ---
  const enviarNovoMutation = useMutation({
    mutationFn: async (lote: LoteOperacional) => {
      setActionLoading(lote.id);

      try {
        toast.info("Gerando arquivo e enviando para nuvem...");

        // 1. Buscar dados para o Excel (Igual ao Download)
        const { data: itens, error: fetchError } = await supabase
          .from("colaboradores_lote")
          .select("nome, sexo, cpf, data_nascimento, salario, classificacao_salario, created_at")
          .eq("lote_id", lote.id)
          .order("created_at", { ascending: false });

        if (fetchError) throw fetchError;
        if (!itens || itens.length === 0) throw new Error("Lote vazio, impossível enviar.");

        // 2. Filtrar Duplicatas (Manter apenas o mais recente)
        const cpfsProcessados = new Set();
        const itensUnicos = itens.filter((item) => {
          const cpfLimpo = item.cpf.replace(/\D/g, "");
          if (cpfsProcessados.has(cpfLimpo)) return false;
          cpfsProcessados.add(cpfLimpo);
          return true;
        });
        itensUnicos.sort((a, b) => a.nome.localeCompare(b.nome));

        // 3. Gerar o Excel em Memória
        let cnpj = (lote.empresa as any)?.cnpj || "";
        if (!cnpj && lote.empresa_id) {
          const { data: emp } = await supabase.from("empresas").select("cnpj").eq("id", lote.empresa_id).single();
          if (emp) cnpj = emp.cnpj;
        }

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

        // Estilização
        const COL_WIDTH = 37.11;
        worksheet.columns = headers.map(() => ({ width: COL_WIDTH }));
        headerRow.eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF203455" } };
          cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
          cell.alignment = { horizontal: "center" };
        });

        itensUnicos.forEach((c) => {
          let dataNascDate = null;
          if (c.data_nascimento) {
            const parts = c.data_nascimento.split("-");
            if (parts.length === 3)
              dataNascDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          }
          const row = worksheet.addRow([
            c.nome?.toUpperCase(),
            c.sexo,
            formatCPF(c.cpf),
            dataNascDate,
            c.salario ? Number(c.salario) : 0,
            c.classificacao_salario,
            formatCNPJ(cnpj),
          ]);
          if (dataNascDate) row.getCell(4).numFmt = "dd/mm/yyyy";
          row.getCell(5).numFmt = "#,##0.00";
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

        // 4. Upload para o Supabase Storage
        // Nota: Assumindo bucket 'contratos' e pasta 'lotes'
        const fileName = `lotes/${lote.id}_${Date.now()}.xlsx`;
        const { error: uploadError } = await supabase.storage
          .from("contratos")
          .upload(fileName, blob, { upsert: true });

        if (uploadError) throw uploadError;

        // 5. Pegar a URL Pública
        const {
          data: { publicUrl },
        } = supabase.storage.from("contratos").getPublicUrl(fileName);

        // 6. Atualizar Banco de Dados (Isso dispara o Webhook)
        const { error: updateError } = await supabase
          .from("lotes_mensais")
          .update({
            status: "em_analise_seguradora",
            enviado_seguradora_em: new Date().toISOString(),
            arquivo_url: publicUrl,
          })
          .eq("id", lote.id);

        if (updateError) throw updateError;
      } catch (error: any) {
        throw error;
      }
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
        .select("nome, sexo, cpf, data_nascimento, salario, classificacao_salario, created_at")
        .eq("lote_id", lote.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!itens || itens.length === 0) {
        toast.warning("Não há colaboradores neste lote para baixar.");
        return;
      }

      // FILTRAGEM DE DUPLICATAS
      const cpfsProcessados = new Set();
      const itensUnicos = itens.filter((item) => {
        const cpfLimpo = item.cpf.replace(/\D/g, "");
        if (cpfsProcessados.has(cpfLimpo)) {
          return false;
        }
        cpfsProcessados.add(cpfLimpo);
        return true;
      });

      // Ordenação Alfabética
      itensUnicos.sort((a, b) => a.nome.localeCompare(b.nome));

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

      itensUnicos.forEach((c) => {
        let dataNascDate = null;
        if (c.data_nascimento) {
          const parts = c.data_nascimento.split("-");
          if (parts.length === 3)
            dataNascDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        }

        const row = worksheet.addRow([
          c.nome ? c.nome.toUpperCase() : "",
          c.sexo || "Masculino",
          c.cpf ? formatCPF(c.cpf) : "",
          dataNascDate,
          c.salario ? Number(c.salario) : 0,
          c.classificacao_salario || "",
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
      toast.error("Erro ao gerar planilha: " + e.message);
    }
  };

  const handleAction = (lote: LoteOperacional, tab: string) => {
    setSelectedLote(lote);
    if (tab === "entrada") setConfirmEnviarDialog(true);
    else if (tab === "seguradora") setProcessarDialogOpen(true);
    else if (tab === "concluido") setConfirmFaturarDialog(true);
    else if (tab === "pendencia") {
      toast.success("Email de pendência enviado ao cliente (ação futura).");
    }
  };

  const handleConfirmarEnvio = () => {
    if (!selectedLote) return;
    // IMPORTANTE: Agora passamos o objeto completo, pois precisamos do ID da empresa para o nome do arquivo
    enviarNovoMutation.mutate(selectedLote);
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Building2 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Operacional</h1>
            <p className="text-muted-foreground">Gestão de Fluxo de Lotes</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por empresa..."
              className="pl-8 bg-background"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPages({ entrada: 1, seguradora: 1, pendencia: 1, concluido: 1 });
              }}
            />
          </div>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortType)}>
            <SelectTrigger className="w-full md:w-[180px] bg-background">
              <ArrowUpDown className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alfabetica">Ordem Alfabética</SelectItem>
              <SelectItem value="recente">Mais Recentes</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={() => setImportarDialogOpen(true)} variant="outline">
            <Upload className="mr-2 h-4 w-4" /> Importar
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
        <TabsList className="grid w-full grid-cols-4">
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
          "enviar_cliente",
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
            <AlertDialogTitle>Enviar Lote para Seguradora?</AlertDialogTitle>
            <AlertDialogDescription>O lote será enviado para análise inicial da seguradora.</AlertDialogDescription>
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
