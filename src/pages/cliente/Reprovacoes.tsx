import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { XCircle, AlertTriangle, Edit, Send, Eye, Download, FileCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCPF } from "@/lib/validators";
import { parseLocalDate, capitalize } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { EditarColaboradorDialog } from "@/components/cliente/EditarColaboradorDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ExcelJS from "exceljs";
import GerenciarAprovacaoSeguradoraDialog from "@/components/admin/GerenciarAprovacaoSeguradoraDialog";

 const Reprovacoes = () => {
   const [sublotesRascunho, setSublotesRascunho] = useState<any[]>([]);
   const [sublotesEnviados, setSublotesEnviados] = useState<any[]>([]);
   const [sublotesConcluidos, setSublotesConcluidos] = useState<any[]>([]);
   const [lotes, setLotes] = useState<any[]>([]);
   const [obras, setObras] = useState<any[]>([]);
   const [colaboradoresReprovados, setColaboradoresReprovados] = useState<any[]>([]);
   const [loading, setLoading] = useState(true);
   const [selectedLote, setSelectedLote] = useState<string>("todos");
   const [selectedObra, setSelectedObra] = useState<string>("todas");
   const [editingColaborador, setEditingColaborador] = useState<any>(null);
   const [editDialogOpen, setEditDialogOpen] = useState(false);
   const [sending, setSending] = useState(false);
   const [gerenciarAprovacaoDialog, setGerenciarAprovacaoDialog] = useState(false);
   const [loteSelected, setLoteSelected] = useState<any>(null);
   const [viewColaboradoresDialog, setViewColaboradoresDialog] = useState(false);
   const [colaboradoresHistorico, setColaboradoresHistorico] = useState<any[]>([]);
   const [loadingColaboradoresHistorico, setLoadingColaboradoresHistorico] = useState(false);
   const { profile } = useUserRole();


  const fetchLotes = useCallback(async () => {
    if (!profile?.empresa_id) return;
    try {
      const { data, error } = await supabase
        .from("lotes_mensais")
        .select("id, competencia")
        .eq("empresa_id", profile.empresa_id)
        .in("status", ["enviado", "concluido", "aguardando_correcao"])
        .order("competencia", { ascending: false });

      if (error) throw error;
      setLotes(data || []);
    } catch (error) {
      toast.error("Erro ao carregar lotes", { duration: 2000 });
    }
  }, [profile?.empresa_id]);

  const fetchObras = useCallback(async () => {
    if (!profile?.empresa_id) return;
    try {
      const { data, error } = await supabase
        .from("obras")
        .select("id, nome")
        .eq("empresa_id", profile.empresa_id)
        .eq("status", "ativa")
        .order("nome");

      if (error) throw error;
      setObras(data || []);
    } catch (error) {
      toast.error("Erro ao carregar obras", { duration: 2000 });
    }
  }, [profile?.empresa_id]);

  const fetchSublotesRascunho = useCallback(async () => {
    if (!profile?.empresa_id) return;
    try {
      const { data: colaboradoresPendentes, error } = await supabase
        .from("colaboradores_lote")
        .select(`
          lote_id,
          tentativa_reenvio,
          lotes_mensais!inner (
            id,
            empresa_id,
            competencia,
            obra_id,
            status,
            created_at,
            total_colaboradores,
            obras:obra_id (nome)
          )
        `)
        .gt("tentativa_reenvio", 1)
        .eq("status_seguradora", "pendente");

      if (error) throw error;

      // Agrupar por lote_id e tentativa
      const lotesAgrupados: Record<string, any> = {};
      (colaboradoresPendentes || [])
        .filter((item: any) => 
          item.lotes_mensais.empresa_id === profile.empresa_id &&
          !["enviado", "concluido"].includes(item.lotes_mensais.status)
        )
        .forEach((item: any) => {
          const key = `${item.lote_id}_${item.tentativa_reenvio}`;
          if (!lotesAgrupados[key]) {
            lotesAgrupados[key] = {
              ...item.lotes_mensais,
              tentativa_reenvio: item.tentativa_reenvio,
              count: 0
            };
          }
          lotesAgrupados[key].count++;
        });

      setSublotesRascunho(Object.values(lotesAgrupados));
    } catch (error) {
      // Silently fail
    }
  }, [profile?.empresa_id]);

  const fetchSublotesEnviados = useCallback(async () => {
    if (!profile?.empresa_id) return;
    try {
      const { data: colaboradoresEnviados, error } = await supabase
        .from("colaboradores_lote")
        .select(`
          lote_id,
          tentativa_reenvio,
          lotes_mensais!inner (
            id,
            empresa_id,
            competencia,
            obra_id,
            status,
            enviado_seguradora_em,
            total_colaboradores,
            obras:obra_id (nome)
          )
        `)
        .gt("tentativa_reenvio", 1)
        .eq("status_seguradora", "enviado");

      if (error) throw error;

      // Agrupar por lote_id e tentativa
      const lotesAgrupados: Record<string, any> = {};
      (colaboradoresEnviados || [])
        .filter((item: any) => 
          item.lotes_mensais.empresa_id === profile.empresa_id &&
          item.lotes_mensais.status === "enviado"
        )
        .forEach((item: any) => {
          const key = `${item.lote_id}_${item.tentativa_reenvio}`;
          if (!lotesAgrupados[key]) {
            lotesAgrupados[key] = {
              ...item.lotes_mensais,
              tentativa_reenvio: item.tentativa_reenvio,
              count: 0
            };
          }
          lotesAgrupados[key].count++;
        });

      setSublotesEnviados(Object.values(lotesAgrupados));
    } catch (error) {
      // Silently fail
    }
  }, [profile?.empresa_id]);

  const fetchSublotesConcluidos = useCallback(async () => {
    if (!profile?.empresa_id) return;
    try {
      const { data: colaboradoresConcluidos, error } = await supabase
        .from("colaboradores_lote")
        .select(`
          lote_id,
          tentativa_reenvio,
          status_seguradora,
          lotes_mensais!inner (
            id,
            empresa_id,
            competencia,
            obra_id,
            status,
            updated_at,
            total_aprovados,
            total_reprovados,
            valor_total,
            obras:obra_id (nome)
          )
        `)
        .gt("tentativa_reenvio", 1);

      if (error) throw error;

      // Agrupar por lote_id e tentativa
      const lotesAgrupados: Record<string, any> = {};
      (colaboradoresConcluidos || [])
        .filter((item: any) => 
          item.lotes_mensais.empresa_id === profile.empresa_id &&
          ["concluido", "aguardando_correcao"].includes(item.lotes_mensais.status)
        )
        .forEach((item: any) => {
          const key = `${item.lote_id}_${item.tentativa_reenvio}`;
          if (!lotesAgrupados[key]) {
            lotesAgrupados[key] = {
              ...item.lotes_mensais,
              tentativa_reenvio: item.tentativa_reenvio,
              count: 0,
              aprovados: 0,
              reprovados: 0
            };
          }
          lotesAgrupados[key].count++;
          if (item.status_seguradora === "aprovado") {
            lotesAgrupados[key].aprovados++;
          } else if (item.status_seguradora === "reprovado") {
            lotesAgrupados[key].reprovados++;
          }
        });

      setSublotesConcluidos(Object.values(lotesAgrupados));
    } catch (error) {
      // Silently fail
    }
  }, [profile?.empresa_id]);

  const fetchColaboradoresReprovados = useCallback(async () => {
    setLoading(true);
    try {
      if (!profile?.empresa_id) {
        console.error("Perfil sem empresa_id");
        setLoading(false);
        return;
      }

      let query = supabase
        .from("colaboradores_lote")
        .select(`
          *,
          lotes_mensais!inner (
            id,
            competencia,
            empresa_id,
            obra_id,
            status,
            obras (
              id,
              nome
            )
          )
        `)
        .eq("lotes_mensais.empresa_id", profile.empresa_id)
        .eq("status_seguradora", "reprovado");

      if (selectedLote !== "todos") {
        query = query.eq("lote_id", selectedLote);
      }

      if (selectedObra !== "todas") {
        query = query.eq("lotes_mensais.obra_id", selectedObra);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) {
        console.error("Erro na query:", error);
        throw error;
      }
      
      setColaboradoresReprovados(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar colaboradores reprovados:", error);
      toast.error(`Erro: ${error.message || 'Desconhecido'}`, { duration: 3000 });
    } finally {
      setLoading(false);
    }
  }, [profile?.empresa_id, selectedLote, selectedObra]);

  useEffect(() => {
    if (profile?.empresa_id) {
      fetchLotes();
      fetchObras();
      fetchSublotesRascunho();
      fetchSublotesEnviados();
      fetchSublotesConcluidos();

      const lotesChannel = supabase
        .channel('cliente-reprovacoes-lotes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'lotes_mensais' }, () => {
          fetchLotes();
          fetchSublotesRascunho();
          fetchSublotesEnviados();
          fetchSublotesConcluidos();
        })
        .subscribe();

      const colaboradoresChannel = supabase
        .channel('cliente-reprovacoes-colaboradores')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'colaboradores_lote' }, () => {
          fetchColaboradoresReprovados();
          fetchSublotesRascunho();
          fetchSublotesEnviados();
          fetchSublotesConcluidos();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(lotesChannel);
        supabase.removeChannel(colaboradoresChannel);
      };
    }
  }, [profile?.empresa_id, fetchLotes, fetchObras, fetchSublotesRascunho, fetchSublotesEnviados, fetchSublotesConcluidos, fetchColaboradoresReprovados]);

  useEffect(() => {
    if (profile?.empresa_id) {
      fetchColaboradoresReprovados();
    }
  }, [selectedLote, selectedObra, profile?.empresa_id, fetchColaboradoresReprovados]);

  const handleViewColaboradoresHistorico = async (lote: any) => {
    setLoteSelected(lote);
    setViewColaboradoresDialog(true);
    setLoadingColaboradoresHistorico(true);

    try {
      const { data, error } = await supabase
        .from("colaboradores_lote")
        .select("*")
        .eq("lote_id", lote.id)
        .eq("tentativa_reenvio", lote.tentativa_reenvio || 1)
        .order("nome", { ascending: true });

      if (error) throw error;
      setColaboradoresHistorico(data || []);
    } catch (error) {
      toast.error("Erro ao carregar colaboradores");
    } finally {
      setLoadingColaboradoresHistorico(false);
    }
  };

  const handleDownloadSublote = async (lote: any) => {
    try {
      toast.loading("Preparando arquivo para download...");

      const { data: colaboradoresData, error } = await supabase
        .from("colaboradores_lote")
        .select("*")
        .eq("lote_id", lote.id)
        .eq("tentativa_reenvio", lote.tentativa_reenvio || 1)
        .order("nome", { ascending: true });

      if (error) throw error;

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(`Tentativa ${lote.tentativa_reenvio || 1}`);

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
        { header: "Status Seguradora", key: "status_seguradora", width: 20 },
        { header: "Motivo Reprovação", key: "motivo_reprovacao", width: 30 },
        { header: "Tentativa", key: "tentativa", width: 12 },
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
          status_seguradora: capitalize(colab.status_seguradora || ""),
          motivo_reprovacao: colab.motivo_reprovacao_seguradora || "",
          tentativa: colab.tentativa_reenvio || 1,
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Reprovados_Tentativa${lote.tentativa_reenvio || 1}_${lote.competencia.replace("/", "-")}_${format(new Date(), "yyyyMMdd")}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);

      toast.dismiss();
      toast.success("Arquivo baixado com sucesso!", { duration: 2000 });
    } catch (error) {
      toast.dismiss();
      console.error("Erro ao baixar relatório:", error);
      toast.error("Erro ao baixar relatório", { duration: 2000 });
    }
  };

  const handleEditColaborador = (colaborador: any) => {
    setEditingColaborador(colaborador);
    setEditDialogOpen(true);
  };

  const handleReenviarCorrigidos = async () => {
    if (selectedObra === "todas" || !selectedObra) {
      toast.error("Selecione uma obra específica antes de reenviar", { duration: 2000 });
      return;
    }

    if (colaboradoresReprovados.length === 0) {
      toast.error("Não há colaboradores para reenviar", { duration: 2000 });
      return;
    }

    const lotesUnicos = [...new Set(colaboradoresReprovados.map(c => c.lote_id))];
    if (lotesUnicos.length > 1) {
      toast.error("Selecione uma competência específica para reenviar", { duration: 2000 });
      return;
    }

    setSending(true);
    try {
      const primeiroColaborador = colaboradoresReprovados[0];
      const loteId = primeiroColaborador.lote_id;
      
      const { data: maxTentativa, error: maxError } = await supabase
        .from("colaboradores_lote")
        .select("tentativa_reenvio")
        .eq("lote_id", loteId)
        .order("tentativa_reenvio", { ascending: false })
        .limit(1)
        .single();

      if (maxError) throw maxError;
      
      const proximaTentativa = (maxTentativa?.tentativa_reenvio || 1) + 1;

      const colaboradoresNovaTentativa = colaboradoresReprovados.map((colab) => ({
        lote_id: loteId,
        colaborador_id: colab.colaborador_id,
        nome: colab.nome,
        cpf: colab.cpf,
        data_nascimento: colab.data_nascimento,
        sexo: colab.sexo,
        salario: colab.salario || 0,
        classificacao: colab.classificacao,
        classificacao_salario: colab.classificacao_salario,
        aposentado: colab.aposentado || false,
        afastado: colab.afastado || false,
        cid: colab.cid,
        status_seguradora: "pendente",
        tentativa_reenvio: proximaTentativa,
        data_tentativa: new Date().toISOString(),
      }));

      const { error: insertError } = await supabase
        .from("colaboradores_lote")
        .insert(colaboradoresNovaTentativa);

      if (insertError) throw insertError;

      const idsColaboradores = colaboradoresReprovados.map((c) => c.id);
      const { error: updateError } = await supabase
        .from("colaboradores_lote")
        .update({ status_seguradora: "reenviado" })
        .in("id", idsColaboradores);

      if (updateError) throw updateError;

      const { error: updateLoteError } = await supabase
        .from("lotes_mensais")
        .update({ 
          total_colaboradores: colaboradoresNovaTentativa.length,
          updated_at: new Date().toISOString()
        })
        .eq("id", loteId);

      if (updateLoteError) throw updateLoteError;

      toast.success(`Tentativa ${proximaTentativa} criada com sucesso! Aguarde validação da equipe administrativa.`, { duration: 2000 });
      fetchColaboradoresReprovados();
      fetchSublotesRascunho();
    } catch (error: any) {
      console.error("Erro ao reenviar colaboradores:", error);
      const errorMessage = error?.message || "Erro desconhecido";
      toast.error(`Erro ao reenviar: ${errorMessage}`, { duration: 2000 });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Validar Reprovados</h1>
        <p className="text-muted-foreground">
          Gerencie reenvios de colaboradores reprovados corrigidos e consulte relatórios de aprovados
        </p>
      </div>

      <Tabs defaultValue="reprovados" className="space-y-6">
         <TabsList className="grid w-full grid-cols-3">
           <TabsTrigger value="reprovados">Reprovados</TabsTrigger>
           <TabsTrigger value="corrigidos">Corrigidos ({sublotesRascunho.length})</TabsTrigger>
           <TabsTrigger value="historico">Histórico ({sublotesEnviados.length + sublotesConcluidos.length})</TabsTrigger>
         </TabsList>

        <TabsContent value="reprovados" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                    <CardTitle>Reprovações pela Seguradora</CardTitle>
                  </div>
                  <CardDescription>
                    Total de colaboradores não autorizados: {colaboradoresReprovados.length}
                  </CardDescription>
                </div>
                <Button 
                  onClick={handleReenviarCorrigidos} 
                  disabled={sending || selectedObra === "todas" || !selectedObra}
                  className={selectedObra === "todas" || !selectedObra ? "opacity-50" : ""}
                >
                  <Send className="w-4 h-4 mr-2" />
                  {sending ? "Enviando..." : "Reenviar Corrigidos"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {selectedObra === "todas" && colaboradoresReprovados.length > 0 && (
                <div className="mb-6 p-4 bg-muted/50 border border-border rounded-lg flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-warning mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Selecione uma obra para reenviar</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Para reenviar colaboradores corrigidos, você precisa filtrar por uma obra específica.
                    </p>
                  </div>
                </div>
              )}
              
              <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Filtrar por Competência</Label>
                  <Select value={selectedLote} onValueChange={setSelectedLote}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma competência" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas as Competências</SelectItem>
                      {lotes.map((lote) => (
                        <SelectItem key={lote.id} value={lote.id}>
                          {lote.competencia}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Filtrar por Obra</Label>
                  <Select value={selectedObra} onValueChange={setSelectedObra}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma obra" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas as Obras</SelectItem>
                      {obras.map((obra) => (
                        <SelectItem key={obra.id} value={obra.id}>
                          {obra.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {loading ? (
                <div className="flex justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : colaboradoresReprovados.length === 0 ? (
                <div className="text-center py-12">
                  <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                      <XCircle className="w-8 h-8 text-muted-foreground" />
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Nenhuma Reprovação</h3>
                  <p className="text-muted-foreground">
                    Não há colaboradores reprovados pela seguradora.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Competência</TableHead>
                      <TableHead>Obra</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Data de Nascimento</TableHead>
                      <TableHead>Motivo da Reprovação</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {colaboradoresReprovados.map((colaborador) => (
                      <TableRow key={colaborador.id}>
                        <TableCell>
                          <Badge variant="outline">
                            {colaborador.lotes_mensais.competencia}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {colaborador.lotes_mensais.obras?.nome || "-"}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">{colaborador.nome}</TableCell>
                        <TableCell>{formatCPF(colaborador.cpf)}</TableCell>
                        <TableCell>
                          {colaborador.data_nascimento
                            ? format(
                                new Date(colaborador.data_nascimento + "T00:00:00"),
                                "dd/MM/yyyy",
                                { locale: ptBR }
                              )
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="max-w-md">
                            <div className="flex items-start gap-2">
                              <XCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                              <span className="text-sm">
                                {colaborador.motivo_reprovacao_seguradora || "Não especificado"}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditColaborador(colaborador)}
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Editar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="corrigidos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Reenvios Corrigidos</CardTitle>
              <CardDescription>
                Colaboradores corrigidos que estão prontos para serem enviados à seguradora
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : sublotesRascunho.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Send className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>Nenhum reenvio aguardando validação</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {sublotesRascunho.map((lote) => (
                    <Card key={`${lote.id}_${lote.tentativa_reenvio}`} className="border-2">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">
                              {lote.obras?.nome || "Sem obra"} - {lote.competencia}
                            </CardTitle>
                            <CardDescription>
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <Badge variant="secondary">
                                  Tentativa {lote.tentativa_reenvio}
                                </Badge>
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">
                                  Aguardando Correção
                                </Badge>
                                <span className="text-sm">
                                  {lote.count || 0} colaboradores corrigidos
                                </span>
                              </div>
                            </CardDescription>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadSublote(lote)}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Baixar
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => {
                                setLoteSelected(lote);
                                setGerenciarAprovacaoDialog(true);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Ver Colaboradores
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico" className="space-y-4">
           <Card>
             <CardHeader>
               <CardTitle>Histórico de Reenvios</CardTitle>
               <CardDescription>
                 Histórico completo de todos os reenvios enviados e concluídos
               </CardDescription>
             </CardHeader>
             <CardContent>
               {loading ? (
                 <div className="flex justify-center p-8">
                   <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                 </div>
               ) : (sublotesEnviados.length + sublotesConcluidos.length) === 0 ? (
                 <div className="text-center py-12 text-muted-foreground">
                   <XCircle className="h-12 w-12 mx-auto mb-4 opacity-20" />
                   <p>Nenhum reenvio no histórico</p>
                 </div>
               ) : (
                 <Table>
                   <TableHeader>
                     <TableRow>
                       <TableHead>Obra</TableHead>
                       <TableHead>Competência</TableHead>
                       <TableHead className="text-center">Tentativa</TableHead>
                       <TableHead className="text-center">Colaboradores</TableHead>
                       <TableHead className="text-center">Status</TableHead>
                       <TableHead className="text-center">Data</TableHead>
                       <TableHead className="text-center">Ações</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {[...sublotesEnviados.map((l) => ({ ...l, _status: "enviado" })),
                       ...sublotesConcluidos.map((l) => ({ ...l, _status: "concluido" }))].map((lote) => (
                       <TableRow key={`${lote.id}_${lote.tentativa_reenvio}_${lote._status}`}>
                         <TableCell className="font-medium">
                           {lote.obras?.nome || "-"}
                         </TableCell>
                         <TableCell>
                           <Badge variant="outline">{lote.competencia}</Badge>
                         </TableCell>
                         <TableCell className="text-center">
                           <Badge>Tentativa {lote.tentativa_reenvio}</Badge>
                         </TableCell>
                          <TableCell className="text-center">
                            {lote.count || lote.total_colaboradores || 0}
                          </TableCell>
                         <TableCell className="text-center">
                           <Badge variant={lote._status === "enviado" ? "secondary" : "default"}>
                             {lote._status === "enviado" ? "Enviado" : "Concluído"}
                           </Badge>
                         </TableCell>
                         <TableCell className="text-center">
                           {lote._status === "enviado" && lote.enviado_seguradora_em
                             ? format(new Date(lote.enviado_seguradora_em), "dd/MM/yyyy HH:mm", { locale: ptBR })
                             : format(new Date(lote.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                         </TableCell>
                          <TableCell className="text-center">
                            <div className="flex gap-2 justify-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewColaboradoresHistorico(lote)}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                Ver
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownloadSublote(lote)}
                              >
                                <Download className="h-4 w-4" />
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
         </TabsContent>
      </Tabs>

      {editingColaborador && (
        <EditarColaboradorDialog
          colaborador={editingColaborador}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSuccess={() => {
            fetchColaboradoresReprovados();
            setEditDialogOpen(false);
          }}
          isLoteColaborador={true}
        />
      )}

      {gerenciarAprovacaoDialog && loteSelected && (
        <GerenciarAprovacaoSeguradoraDialog
          lote={loteSelected}
          open={gerenciarAprovacaoDialog}
          onOpenChange={setGerenciarAprovacaoDialog}
          onSuccess={() => {
            fetchSublotesRascunho();
            fetchSublotesEnviados();
            setGerenciarAprovacaoDialog(false);
          }}
          readOnly={true}
        />
      )}

      <Dialog open={viewColaboradoresDialog} onOpenChange={setViewColaboradoresDialog}>
        <DialogContent className="max-w-[95vw] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Colaboradores do Reenvio</DialogTitle>
            <DialogDescription>
              {loteSelected && (
                <div className="space-y-1 mt-2">
                  <div className="flex gap-4">
                    <span><strong>Obra:</strong> {loteSelected.obras?.nome || "-"}</span>
                    <span><strong>Competência:</strong> {loteSelected.competencia}</span>
                    <span><strong>Tentativa:</strong> {loteSelected.tentativa_reenvio}</span>
                  </div>
                  <span className="text-sm">{colaboradoresHistorico.length} colaborador(es)</span>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {loadingColaboradoresHistorico ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Carregando colaboradores...</p>
            </div>
          ) : colaboradoresHistorico.length === 0 ? (
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
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead>Motivo Reprovação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {colaboradoresHistorico.map((colab) => (
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
                      <TableCell className="text-center">
                        <Badge variant={
                          colab.status_seguradora === "aprovado" ? "default" : 
                          colab.status_seguradora === "reprovado" ? "destructive" : 
                          "secondary"
                        }>
                          {capitalize(colab.status_seguradora || "pendente")}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[300px]">
                        {colab.motivo_reprovacao_seguradora || '-'}
                      </TableCell>
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

export default Reprovacoes;
