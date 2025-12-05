import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Loader2, FileSpreadsheet, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { format } from "date-fns";

interface LoteDetalhesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lote: {
    id: string;
    competencia: string;
    status: string;
    total_colaboradores: number | null;
    valor_total: number | null;
    obras?: { nome: string } | null;
  } | null;
}

export function LoteDetalhesDialog({ open, onOpenChange, lote }: LoteDetalhesDialogProps) {
  const [isExporting, setIsExporting] = useState(false);

  const { data: colaboradores, isLoading } = useQuery({
    queryKey: ["colaboradores-lote", lote?.id],
    queryFn: async () => {
      if (!lote?.id) return [];
      const { data, error } = await supabase
        .from("colaboradores_lote")
        .select("*")
        .eq("lote_id", lote.id)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
    enabled: !!lote?.id && open,
  });

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
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getStatusSeguradoraBadge = (status: string | null) => {
    switch (status) {
      case "aprovado":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Aprovado</Badge>;
      case "reprovado":
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Reprovado</Badge>;
      case "pendente":
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Pendente</Badge>;
      case "enviado":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Enviado</Badge>;
      default:
        return <Badge variant="secondary">{status || "-"}</Badge>;
    }
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "R$ 0,00";
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const formatCPF = (cpf: string) => {
    const cleaned = cpf.replace(/\D/g, '');
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const handleExportXLSX = () => {
    if (!colaboradores || colaboradores.length === 0 || !lote) return;

    setIsExporting(true);
    try {
      const data = colaboradores.map((c: any) => ({
        Nome: c.nome,
        CPF: formatCPF(c.cpf),
        "Data Nascimento": c.data_nascimento ? format(new Date(c.data_nascimento), "dd/MM/yyyy") : "-",
        Sexo: c.sexo || "-",
        Salário: c.salario || 0,
        Classificação: c.classificacao || "-",
        "Status Seguradora": c.status_seguradora || "-",
        "Motivo Reprovação": c.motivo_reprovacao_seguradora || "-",
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Colaboradores");

      // Ajustar largura das colunas
      const colWidths = [
        { wch: 35 }, // Nome
        { wch: 15 }, // CPF
        { wch: 15 }, // Data Nascimento
        { wch: 12 }, // Sexo
        { wch: 12 }, // Salário
        { wch: 18 }, // Classificação
        { wch: 18 }, // Status Seguradora
        { wch: 30 }, // Motivo Reprovação
      ];
      ws["!cols"] = colWidths;

      const fileName = `lote_${lote.competencia.replace("/", "_")}_${lote.obras?.nome || "sem_obra"}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } finally {
      setIsExporting(false);
    }
  };

  if (!lote) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Detalhes do Lote
              </DialogTitle>
              <DialogDescription className="mt-1">
                {lote.competencia} {lote.obras?.nome && `• ${lote.obras.nome}`}
              </DialogDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleExportXLSX}
              disabled={isExporting || !colaboradores || colaboradores.length === 0}
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Baixar XLSX
            </Button>
          </div>
        </DialogHeader>

        {/* Info Cards */}
        <div className="grid grid-cols-3 gap-3 py-3">
          <div className="p-3 rounded-lg border bg-muted/30">
            <p className="text-xs text-muted-foreground">Total Colaboradores</p>
            <p className="text-lg font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              {lote.total_colaboradores || 0}
            </p>
          </div>
          <div className="p-3 rounded-lg border bg-muted/30">
            <p className="text-xs text-muted-foreground">Valor Total</p>
            <p className="text-lg font-semibold">{formatCurrency(lote.valor_total)}</p>
          </div>
          <div className="p-3 rounded-lg border bg-muted/30">
            <p className="text-xs text-muted-foreground">Status</p>
            <div className="mt-1">{getStatusBadge(lote.status)}</div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto border rounded-lg">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : colaboradores && colaboradores.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Data Nasc.</TableHead>
                  <TableHead>Salário</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {colaboradores.map((colab: any) => (
                  <TableRow key={colab.id}>
                    <TableCell className="font-medium">{colab.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{formatCPF(colab.cpf)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {colab.data_nascimento ? format(new Date(colab.data_nascimento), "dd/MM/yyyy") : "-"}
                    </TableCell>
                    <TableCell>{formatCurrency(colab.salario)}</TableCell>
                    <TableCell>{getStatusSeguradoraBadge(colab.status_seguradora)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              Nenhum colaborador neste lote.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
