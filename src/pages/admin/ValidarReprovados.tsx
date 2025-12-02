import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CheckCircle, Send, Filter, Check, ChevronsUpDown, Download, FileCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { capitalize, parseLocalDate } from "@/lib/utils";
import { formatCPF } from "@/lib/validators";
import ExcelJS from "exceljs";
import GerenciarAprovacaoSeguradoraDialog from "@/components/admin/GerenciarAprovacaoSeguradoraDialog";

const ValidarReprovados = () => {
  const [sublotesGestao, setSublotesGestao] = useState<any[]>([]);
  const [sublotesConcluidos, setSublotesConcluidos] = useState<any[]>([]);
  const [statusColaboradores, setStatusColaboradores] = useState<Record<string, { total: number; pendentes: number }>>({});
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>("todas");
  const [filtroCompetencia, setFiltroCompetencia] = useState<string>("todas");
  const [openEmpresaGestao, setOpenEmpresaGestao] = useState(false);
  const [openEmpresaConcluido, setOpenEmpresaConcluido] = useState(false);
  const [openCompetencia, setOpenCompetencia] = useState(false);
  const [gerenciarAprovacaoDialog, setGerenciarAprovacaoDialog] = useState(false);
  const [loteSelected, setLoteSelected] = useState<any>(null);

  const fetchEmpresas = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome, cnpj")
        .order("nome");

      if (error) throw error;
      setEmpresas(data || []);
    } catch (error) {
      // Silently fail
    }
  }, []);

  const fetchSublotesGestao = useCallback(async () => {
    setLoading(true);
    try {
      // Buscar lotes prontos para envio (status_seguradora = pendente, status != enviado)
      const { data: lotesProntos, error: prontosError } = await supabase
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
            enviado_seguradora_em,
            total_colaboradores,
            empresas (nome, cnpj),
            obras:obra_id (nome)
          )
        `)
        .gt("tentativa_reenvio", 1)
        .eq("status_seguradora", "pendente")
        .order("tentativa_reenvio", { ascending: false });

      if (prontosError) throw prontosError;

      // Filtrar apenas lotes que NÃO foram enviados
      let lotesProntosFiltrados = (lotesProntos || []).filter(
        (item: any) => item.lotes_mensais.status !== "enviado"
      );

      // Buscar lotes enviados (status = enviado)
      const { data: lotesEnviados, error: enviadosError } = await supabase
        .from("lotes_mensais")
        .select(`
          id,
          empresa_id,
          competencia,
          obra_id,
          status,
          created_at,
          enviado_seguradora_em,
          total_colaboradores,
          empresas (nome, cnpj),
          obras:obra_id (nome)
        `)
        .eq("status", "enviado")
        .order("enviado_seguradora_em", { ascending: false });

      if (enviadosError) throw enviadosError;

      // Aplicar filtros
      if (filtroEmpresa !== "todas") {
        lotesProntosFiltrados = lotesProntosFiltrados.filter(
          (item: any) => item.lotes_mensais.empresa_id === filtroEmpresa
        );
      }

      if (filtroCompetencia !== "todas") {
        lotesProntosFiltrados = lotesProntosFiltrados.filter(
          (item: any) => item.lotes_mensais.competencia === filtroCompetencia
        );
      }

      // Processar lotes prontos
      const lotesAgrupados: Record<string, any> = {};
      lotesProntosFiltrados.forEach((item: any) => {
        const loteId = item.lote_id;
        if (!lotesAgrupados[loteId] || lotesAgrupados[loteId].tentativa_reenvio < item.tentativa_reenvio) {
          lotesAgrupados[loteId] = {
            ...item.lotes_mensais,
            tentativa_reenvio: item.tentativa_reenvio,
            tipo: "pronto"
          };
        }
      });

      // Processar lotes enviados
      let lotesEnviadosFiltrados = lotesEnviados || [];
      if (filtroEmpresa !== "todas") {
        lotesEnviadosFiltrados = lotesEnviadosFiltrados.filter(
          (lote: any) => lote.empresa_id === filtroEmpresa
        );
      }

      if (filtroCompetencia !== "todas") {
        lotesEnviadosFiltrados = lotesEnviadosFiltrados.filter(
          (lote: any) => lote.competencia === filtroCompetencia
        );
      }

      const lotesEnviadosComTentativa = await Promise.all(
        lotesEnviadosFiltrados.map(async (lote) => {
          const { data: tentativas } = await supabase
            .from("colaboradores_lote")
            .select("tentativa_reenvio")
            .eq("lote_id", lote.id)
            .order("tentativa_reenvio", { ascending: false })
            .limit(1);

          return {
            ...lote,
            tentativa_reenvio: tentativas?.[0]?.tentativa_reenvio || 1,
            tipo: "enviado"
          };
        })
      );

      // Combinar ambos
      const todosLotes = [...Object.values(lotesAgrupados), ...lotesEnviadosComTentativa];
      setSublotesGestao(todosLotes);
    } catch (error) {
      toast.error("Erro ao carregar dados de gestão", { duration: 2000 });
    } finally {
      setLoading(false);
    }
  }, [filtroEmpresa, filtroCompetencia]);

  const fetchSublotesConcluidos = useCallback(async () => {
    try {
      // Buscar lotes que têm tentativas > 1 concluídas
      const { data: lotesComTentativas, error: tentativasError } = await supabase
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
            updated_at,
            total_colaboradores,
            total_aprovados,
            valor_total,
            empresas (nome, cnpj),
            obras:obra_id (nome)
          )
        `)
        .gt("tentativa_reenvio", 1)
        .order("tentativa_reenvio", { ascending: false });

      if (tentativasError) throw tentativasError;

      // Filtrar por empresa
      let lotesFiltrados = lotesComTentativas || [];
      if (filtroEmpresa !== "todas") {
        lotesFiltrados = lotesFiltrados.filter(
          (item: any) => item.lotes_mensais.empresa_id === filtroEmpresa
        );
      }

      if (filtroCompetencia !== "todas") {
        lotesFiltrados = lotesFiltrados.filter(
          (item: any) => item.lotes_mensais.competencia === filtroCompetencia
        );
      }

      // Filtrar apenas lotes concluídos
      lotesFiltrados = lotesFiltrados.filter(
        (item: any) => item.lotes_mensais.status === "concluido"
      );

      // Agrupar por lote_id e pegar todas as tentativas concluídas
      const lotesAgrupados: Record<string, any> = {};
      lotesFiltrados.forEach((item: any) => {
        const key = `${item.lote_id}_${item.tentativa_reenvio}`;
        if (!lotesAgrupados[key]) {
          lotesAgrupados[key] = {
            ...item.lotes_mensais,
            tentativa_reenvio: item.tentativa_reenvio
          };
        }
      });

      const lotesArray = Object.values(lotesAgrupados);
      setSublotesConcluidos(lotesArray);

      // Buscar status dos colaboradores
      if (lotesArray.length > 0) {
        const statusMap: Record<string, { total: number; pendentes: number }> = {};
        
        for (const lote of lotesArray) {
          const { data: colaboradores, error: colabError } = await supabase
            .from("colaboradores_lote")
            .select("status_seguradora")
            .eq("lote_id", lote.id)
            .eq("tentativa_reenvio", lote.tentativa_reenvio);

          if (!colabError && colaboradores) {
            const total = colaboradores.length;
            const pendentes = colaboradores.filter(c => c.status_seguradora === "pendente").length;
            statusMap[`${lote.id}_${lote.tentativa_reenvio}`] = { total, pendentes };
          }
        }
        
        setStatusColaboradores(statusMap);
      }
    } catch (error) {
      // Silently fail
    }
  }, [filtroEmpresa, filtroCompetencia]);

  useEffect(() => {
    fetchEmpresas();
    fetchSublotesGestao();
    fetchSublotesConcluidos();

    // Configurar realtime para atualização automática
    const lotesChannel = supabase
      .channel('validar-reprovados-lotes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lotes_mensais'
        },
        () => {
          fetchSublotesGestao();
          fetchSublotesConcluidos();
        }
      )
      .subscribe();

    const colaboradoresChannel = supabase
      .channel('validar-reprovados-colaboradores')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'colaboradores_lote'
        },
        () => {
          fetchSublotesGestao();
          fetchSublotesConcluidos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(lotesChannel);
      supabase.removeChannel(colaboradoresChannel);
    };
  }, [fetchEmpresas, fetchSublotesGestao, fetchSublotesConcluidos]);

  useEffect(() => {
    fetchSublotesGestao();
    fetchSublotesConcluidos();
  }, [filtroEmpresa, filtroCompetencia, fetchSublotesGestao, fetchSublotesConcluidos]);

  const handleEnviarSeguradora = useCallback(async (loteId: string, tentativaReenvio: number) => {
     try {
       // Atualizar status do lote para enviado
       const { error: loteError } = await supabase
         .from("lotes_mensais")
         .update({
           status: "enviado" as any,
           enviado_seguradora_em: new Date().toISOString(),
         })
         .eq("id", loteId);
 
       if (loteError) throw loteError;
 
       // Atualizar status dos colaboradores da tentativa para "enviado"
       const { error: colabError } = await supabase
         .from("colaboradores_lote")
         .update({ status_seguradora: "enviado" })
         .eq("lote_id", loteId)
         .eq("tentativa_reenvio", tentativaReenvio);
 
       if (colabError) throw colabError;
 
       toast.success(`Tentativa ${tentativaReenvio} enviada para seguradora!`, { duration: 2000 });
       
       // Aguardar atualizações antes de continuar
       await fetchSublotesGestao();
     } catch (error) {
       console.error("Erro ao enviar sublote:", error);
       toast.error("Erro ao enviar para seguradora", { duration: 2000 });
     }
   }, [fetchSublotesGestao]);

  const handleConcluir = useCallback(async (loteId: string, tentativaReenvio: number) => {
    try {
      // Sempre muda para aguardando_finalizacao quando concluir
      // O Relatórios é que finaliza definitivamente para "concluido" ou "aguardando_correcao"
      const { error } = await supabase
        .from("lotes_mensais")
        .update({
          status: "aguardando_finalizacao" as any
        })
        .eq("id", loteId);

      if (error) throw error;
      
      toast.success(`Tentativa ${tentativaReenvio} concluída! Lote enviado para finalização.`, { duration: 2000 });
      
      fetchSublotesGestao();
      fetchSublotesConcluidos();
    } catch (error) {
      console.error("Erro ao concluir sublote:", error);
      toast.error("Erro ao processar conclusão", { duration: 2000 });
    }
  }, [fetchSublotesGestao, fetchSublotesConcluidos]);

  const handleDownload = async (lote: any) => {
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
      link.download = `Reprovados_Tentativa${lote.tentativa_reenvio || 1}_${lote.empresas?.nome || "Empresa"}_${lote.competencia.replace("/", "-")}_${format(new Date(), "yyyyMMdd")}.xlsx`;
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

  const competencias = useMemo(() => {
    const allSublotes = [...sublotesGestao, ...sublotesConcluidos];
    const uniqueCompetencias = Array.from(new Set(allSublotes.map(l => l.competencia)));
    return uniqueCompetencias.sort((a, b) => {
      const [mesA, anoA] = a.split('/');
      const [mesB, anoB] = b.split('/');
      return new Date(parseInt(anoB), parseInt(mesB) - 1).getTime() - 
             new Date(parseInt(anoA), parseInt(mesA) - 1).getTime();
    });
  }, [sublotesGestao, sublotesConcluidos]);

  const FiltrosEmpresa = ({ open, setOpen, popoverId }: { open: boolean; setOpen: (val: boolean) => void; popoverId: string }) => (
    <div className="flex-1">
      <Label className="text-sm mb-2 block">
        <Filter className="h-3 w-3 inline mr-1" />
        Empresa
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {filtroEmpresa === "todas" 
              ? "Todas as empresas" 
              : empresas.find((emp) => emp.id === filtroEmpresa)?.nome || "Selecione..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput placeholder="Buscar por nome ou CNPJ..." />
            <CommandList>
              <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="todas"
                  onSelect={() => {
                    setFiltroEmpresa("todas");
                    setOpen(false);
                  }}
                >
                  <Check
                    className={`mr-2 h-4 w-4 ${filtroEmpresa === "todas" ? "opacity-100" : "opacity-0"}`}
                  />
                  Todas as empresas
                </CommandItem>
                {empresas.map((emp) => (
                  <CommandItem
                    key={emp.id}
                    value={`${emp.nome} ${emp.cnpj}`}
                    onSelect={() => {
                      setFiltroEmpresa(emp.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={`mr-2 h-4 w-4 ${filtroEmpresa === emp.id ? "opacity-100" : "opacity-0"}`}
                    />
                    {emp.nome} - {emp.cnpj}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Validar Reprovados</h1>
        <p className="text-muted-foreground">Gerencie reenvios de colaboradores reprovados corrigidos</p>
      </div>


      <div className="space-y-6">
        {/* Seção Consolidada: Gestão de Reenvios */}
        <Card>
          <CardHeader>
            <CardTitle>Gestão de Reenvios ({sublotesGestao.length})</CardTitle>
            <CardDescription>Reenvios prontos para validação e aguardando conclusão</CardDescription>
          </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <FiltrosEmpresa open={openEmpresaGestao} setOpen={setOpenEmpresaGestao} popoverId="gestao" />
                <div className="flex-1">
                  <Label className="text-sm mb-2 block">
                    <Filter className="h-3 w-3 inline mr-1" />
                    Competência
                  </Label>
                  <Popover open={openCompetencia} onOpenChange={setOpenCompetencia}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openCompetencia}
                        className="w-full justify-between"
                      >
                        {filtroCompetencia === "todas" ? "Todas as competências" : filtroCompetencia}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="Buscar competência..." />
                        <CommandList>
                          <CommandEmpty>Nenhuma competência encontrada.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="todas"
                              onSelect={() => {
                                setFiltroCompetencia("todas");
                                setOpenCompetencia(false);
                              }}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${filtroCompetencia === "todas" ? "opacity-100" : "opacity-0"}`}
                              />
                              Todas as competências
                            </CommandItem>
                            {competencias.map((comp) => (
                              <CommandItem
                                key={comp}
                                value={comp}
                                onSelect={() => {
                                  setFiltroCompetencia(comp);
                                  setOpenCompetencia(false);
                                }}
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${filtroCompetencia === comp ? "opacity-100" : "opacity-0"}`}
                                />
                                {comp}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>Carregando...</p>
                </div>
              ) : sublotesGestao.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Send className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>Nenhum reenvio para gerenciar</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-center">Empresa</TableHead>
                      <TableHead className="text-center">Obra</TableHead>
                      <TableHead className="text-center">Competência</TableHead>
                      <TableHead className="text-center">Tentativa</TableHead>
                      <TableHead className="text-center">Colaboradores</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center">Data</TableHead>
                      <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sublotesGestao.map((lote) => (
                      <TableRow key={`${lote.id}_${lote.tentativa_reenvio}`}>
                        <TableCell className="text-center font-medium">{lote.empresas?.nome || "N/A"}</TableCell>
                        <TableCell className="text-center">{lote.obras?.nome || "-"}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{lote.competencia}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">Tentativa {lote.tentativa_reenvio}</Badge>
                        </TableCell>
                        <TableCell className="text-center">{lote.total_colaboradores || 0}</TableCell>
                        <TableCell className="text-center">
                          {lote.tipo === "pronto" ? (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                              Pronto para Envio
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                              Aguardando Conclusão
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {lote.tipo === "enviado" && lote.enviado_seguradora_em
                            ? format(new Date(lote.enviado_seguradora_em), "dd/MM/yyyy HH:mm", { locale: ptBR })
                            : format(new Date(lote.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex gap-2 justify-center">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDownload(lote)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            {lote.tipo === "pronto" ? (
                              <Button
                                size="sm"
                                onClick={() => handleEnviarSeguradora(lote.id, lote.tentativa_reenvio || 1)}
                              >
                                <Send className="h-4 w-4 mr-2" />
                                Enviar
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => {
                                  setLoteSelected(lote);
                                  setGerenciarAprovacaoDialog(true);
                                }}
                              >
                                <FileCheck className="h-4 w-4 mr-2" />
                                Gerenciar Aprovações
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
          </CardContent>
        </Card>

        {/* Seção 3: Concluídos */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Reenvios Concluídos ({sublotesConcluidos.length})</CardTitle>
            <CardDescription>Tentativas finalizadas que atualizaram totais automaticamente</CardDescription>
          </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <FiltrosEmpresa open={openEmpresaConcluido} setOpen={setOpenEmpresaConcluido} popoverId="concluido" />
              </div>

              {sublotesConcluidos.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>Nenhum reenvio concluído</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-center">Empresa</TableHead>
                      <TableHead className="text-center">Obra</TableHead>
                      <TableHead className="text-center">Competência</TableHead>
                      <TableHead className="text-center">Tentativa</TableHead>
                      <TableHead className="text-center">Colaboradores</TableHead>
                      <TableHead className="text-center">Aprovados</TableHead>
                      <TableHead className="text-center">Valor Total</TableHead>
                      <TableHead className="text-center">Data Conclusão</TableHead>
                      <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sublotesConcluidos.map((lote) => (
                      <TableRow key={`${lote.id}_${lote.tentativa_reenvio}`}>
                        <TableCell className="text-center font-medium">{lote.empresas?.nome || "N/A"}</TableCell>
                        <TableCell className="text-center">{lote.obras?.nome || "-"}</TableCell>
                        <TableCell className="text-center">{lote.competencia}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">Tentativa {lote.tentativa_reenvio}</Badge>
                        </TableCell>
                        <TableCell className="text-center">{lote.total_colaboradores}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="default">{lote.total_aprovados || 0}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {lote.valor_total 
                            ? new Intl.NumberFormat("pt-BR", {
                                style: "currency",
                                currency: "BRL"
                              }).format(lote.valor_total)
                            : "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          {lote.updated_at ? format(new Date(lote.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex gap-2 justify-center">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDownload(lote)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setLoteSelected(lote);
                                setGerenciarAprovacaoDialog(true);
                              }}
                            >
                              <FileCheck className="h-4 w-4 mr-2" />
                              Ver Status
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
      </div>

      {gerenciarAprovacaoDialog && loteSelected && (
        <GerenciarAprovacaoSeguradoraDialog
          lote={loteSelected}
          open={gerenciarAprovacaoDialog}
          onOpenChange={setGerenciarAprovacaoDialog}
          onSuccess={() => {
            fetchSublotesGestao();
            fetchSublotesConcluidos();
          }}
        />
      )}
    </div>
  );
};

export default ValidarReprovados;
