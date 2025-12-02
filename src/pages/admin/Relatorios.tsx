import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Download, Eye, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { capitalize, parseLocalDate } from "@/lib/utils";
import { formatCPF } from "@/lib/validators";
import ExcelJS from "exceljs";

const Relatorios = () => {
  const [lotes, setLotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLote, setSelectedLote] = useState<any>(null);
  const [colaboradores, setColaboradores] = useState<any[]>([]);
  const [showColaboradoresDialog, setShowColaboradoresDialog] = useState(false);
  const [loadingColaboradores, setLoadingColaboradores] = useState(false);
  const [finalizando, setFinalizando] = useState(false);

  useEffect(() => {
    fetchLotes();
  }, []);

  const fetchLotes = useCallback(async () => {
    setLoading(true);
    try {
      // Buscar lotes com status "enviado", "aguardando_finalizacao", "aguardando_correcao" ou "concluido"
      const { data, error } = await supabase
        .from("lotes_mensais")
        .select("*, empresas(nome, status)")
        .in("status", ["enviado", "aguardando_finalizacao", "concluido", "aguardando_correcao"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLotes(data || []);
    } catch (error) {
      console.error("Erro ao buscar lotes:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleViewColaboradores = async (lote: any) => {
    setSelectedLote(lote);
    setShowColaboradoresDialog(true);
    setLoadingColaboradores(true);

    try {
      const { data, error } = await supabase
        .from("colaboradores_lote")
        .select("*")
        .eq("lote_id", lote.id)
        .eq("status_seguradora", "aprovado")
        .order("nome", { ascending: true });

      if (error) throw error;
      setColaboradores(data || []);
    } catch (error) {
      toast.error("Erro ao carregar colaboradores");
    } finally {
      setLoadingColaboradores(false);
    }
  };

  const handleDownload = async (lote: any) => {
    try {
      toast.loading("Preparando arquivo para download...");

      const { data: colaboradoresData, error } = await supabase
        .from("colaboradores_lote")
        .select("*")
        .eq("lote_id", lote.id)
        .eq("status_seguradora", "aprovado")
        .order("nome", { ascending: true });

      if (error) throw error;

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Colaboradores Aprovados");

      worksheet.columns = [
        { header: "Nome", key: "nome", width: 35 },
        { header: "CPF", key: "cpf", width: 15 },
        { header: "Data Nascimento", key: "data_nascimento", width: 18 },
        { header: "Sexo", key: "sexo", width: 12 },
        { header: "Classificação", key: "classificacao", width: 25 },
        { header: "Salário", key: "salario", width: 15 },
        { header: "Classificação Salarial", key: "classificacao_salario", width: 25 },
        { header: "Aposentado", key: "aposentado", width: 12 },
        { header: "Afastado", key: "afastado", width: 12 },
        { header: "CID", key: "cid", width: 15 },
      ];

      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFC0504D" },
      };
      headerRow.alignment = { vertical: "middle", horizontal: "center" };
      headerRow.height = 20;

      colaboradoresData?.forEach((colab) => {
        worksheet.addRow({
          nome: colab.nome,
          cpf: formatCPF(colab.cpf),
          data_nascimento: format(parseLocalDate(colab.data_nascimento), "dd/MM/yyyy", { locale: ptBR }),
          sexo: colab.sexo,
          classificacao: colab.classificacao || "",
          salario: colab.salario ? new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL"
          }).format(colab.salario) : "",
          classificacao_salario: colab.classificacao_salario || "",
          aposentado: colab.aposentado ? "Sim" : "Não",
          afastado: colab.afastado ? "Sim" : "Não",
          cid: colab.cid || "",
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Relatorio_Aprovados_${lote.competencia.replace("/", "-")}_${format(new Date(), "yyyyMMdd")}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);

      toast.dismiss();
      toast.success("Arquivo baixado com sucesso!");
    } catch (error) {
      toast.dismiss();
      console.error("Erro ao baixar relatório:", error);
      toast.error("Erro ao baixar relatório");
    }
  };

  const handleFinalizarLote = async (lote: any) => {
    setFinalizando(true);
    try {
      // Apenas muda o status para "concluido"; triggers no banco cuidam de apólices / notas fiscais
      const { error: statusError } = await supabase
        .from("lotes_mensais")
        .update({ status: "concluido" })
        .eq("id", lote.id);

      if (statusError) throw statusError;

      toast.success("Lote finalizado com sucesso!");
      await fetchLotes();
    } catch (error: any) {
      console.error("Erro ao finalizar:", error);
      toast.error("Erro ao finalizar lote");
    } finally {
      setFinalizando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Relatórios</h1>
        <p className="text-muted-foreground">Finalize lotes aprovados para enviar para Apólices ou Notas Fiscais</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Relatórios de Lotes</CardTitle>
          <CardDescription>Lotes concluídos ou aguardando correção de reprovados</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Carregando...</p>
            </div>
          ) : lotes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Nenhum lote disponível para finalização</p>
              <p className="text-sm mt-2">Os lotes aparecerão aqui após conclusão</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Competência</TableHead>
                  <TableHead className="text-center">Data</TableHead>
                  <TableHead className="text-center">Total Colaboradores</TableHead>
                  <TableHead className="text-center">Aprovados</TableHead>
                  <TableHead className="text-center">Reprovados</TableHead>
                  <TableHead className="text-center">Valor Total</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lotes.map((lote) => (
                  <TableRow key={lote.id}>
                    <TableCell className="font-medium">{lote.empresas?.nome}</TableCell>
                    <TableCell>{lote.competencia}</TableCell>
                    <TableCell className="text-center">
                      {format(new Date(lote.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{(lote.total_aprovados || 0) + (lote.total_reprovados || 0)}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="default">{lote.total_aprovados || 0}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="destructive">{lote.total_reprovados || 0}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {lote.valor_total ? new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL"
                      }).format(lote.valor_total) : "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={
                        lote.status === "concluido" ? "default" : 
                        lote.status === "enviado" ? "default" : 
                        "secondary"
                      }>
                        {lote.status === "concluido" ? "Concluído" : 
                         lote.status === "enviado" ? "Corrigidos Reenviados" : 
                         lote.status === "aguardando_finalizacao" ? "Aguardando Finalização" :
                         "Aguardando Correção"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex gap-2 justify-center">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleViewColaboradores(lote)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Ver
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDownload(lote)}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Baixar
                        </Button>
                        <Button 
                          size="sm"
                          onClick={() => handleFinalizarLote(lote)}
                          disabled={finalizando || lote.status !== "aguardando_finalizacao"}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Finalizar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showColaboradoresDialog} onOpenChange={setShowColaboradoresDialog}>
        <DialogContent className="max-w-[95vw] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Colaboradores Aprovados</DialogTitle>
            <DialogDescription>
              {selectedLote && `Competência: ${selectedLote.competencia} - ${selectedLote.total_aprovados || 0} colaboradores aprovados`}
            </DialogDescription>
          </DialogHeader>
          
          {loadingColaboradores ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Carregando colaboradores...</p>
            </div>
          ) : colaboradores.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Nenhum colaborador encontrado</p>
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Nome</TableHead>
                    <TableHead className="min-w-[150px]">CPF</TableHead>
                    <TableHead>Data Nascimento</TableHead>
                    <TableHead>Sexo</TableHead>
                    <TableHead>Classificação</TableHead>
                    <TableHead className="text-right">Salário</TableHead>
                    <TableHead>Aposentado</TableHead>
                    <TableHead>Afastado</TableHead>
                    <TableHead>CID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {colaboradores.map((colab) => (
                    <TableRow key={colab.id}>
                      <TableCell className="font-medium min-w-[200px]">{colab.nome}</TableCell>
                      <TableCell className="min-w-[150px] whitespace-nowrap">{formatCPF(colab.cpf)}</TableCell>
                      <TableCell>{format(parseLocalDate(colab.data_nascimento), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                      <TableCell>{colab.sexo}</TableCell>
                      <TableCell>{colab.classificacao}</TableCell>
                      <TableCell className="text-right">
                        {colab.salario ? new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL'
                        }).format(colab.salario) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={colab.aposentado ? "default" : "outline"}>
                          {colab.aposentado ? "Sim" : "Não"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={colab.afastado ? "destructive" : "outline"}>
                          {colab.afastado ? "Sim" : "Não"}
                        </Badge>
                      </TableCell>
                      <TableCell>{colab.cid || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Relatorios;
