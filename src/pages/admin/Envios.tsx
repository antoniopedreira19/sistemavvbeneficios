import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Send, CheckCircle, Filter, Check, ChevronsUpDown, FileCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { capitalize } from "@/lib/utils";
import GerenciarAprovacaoSeguradoraDialog from "@/components/admin/GerenciarAprovacaoSeguradoraDialog";

const Envios = () => {
  const [lotes, setLotes] = useState<any[]>([]);
  const [lotesHistorico, setLotesHistorico] = useState<any[]>([]);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistorico, setLoadingHistorico] = useState(true);
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>("todas");
  const [filtroCompetencia, setFiltroCompetencia] = useState<string>("todas");
  const [filtroEmpresaHistorico, setFiltroEmpresaHistorico] = useState<string>("todas");
  const [filtroCompetenciaHistorico, setFiltroCompetenciaHistorico] = useState<string>("todas");
  const [openEmpresa, setOpenEmpresa] = useState(false);
  const [openCompetencia, setOpenCompetencia] = useState(false);
  const [openEmpresaHistorico, setOpenEmpresaHistorico] = useState(false);
  const [openCompetenciaHistorico, setOpenCompetenciaHistorico] = useState(false);
  const [gerenciarAprovacaoDialog, setGerenciarAprovacaoDialog] = useState(false);
  const [loteSelected, setLoteSelected] = useState<any>(null);
  const [cotacaoDialog, setCotacaoDialog] = useState(false);
  const [loteParaCotar, setLoteParaCotar] = useState<any>(null);
  const [valorPorColaborador, setValorPorColaborador] = useState("");

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

  const fetchLotes = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("lotes_mensais")
        .select(`
          *,
          empresas (
            nome,
            cnpj
          ),
          obras:obra_id (
            nome
          )
        `)
        .in("status", ["em_cotacao", "cotado", "aprovado", "enviado"]);

      // Filtro por empresa
      if (filtroEmpresa !== "todas") {
        query = query.eq("empresa_id", filtroEmpresa);
      }

      // Filtro por competência
      if (filtroCompetencia !== "todas") {
        query = query.eq("competencia", filtroCompetencia);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;
      setLotes(data || []);
    } catch (error) {
      toast.error("Erro ao carregar lotes");
    } finally {
      setLoading(false);
    }
  }, [filtroEmpresa, filtroCompetencia]);

  const fetchLotesHistorico = useCallback(async () => {
    setLoadingHistorico(true);
    try {
      let query = supabase
        .from("lotes_mensais")
        .select(`
          *,
          empresas (
            nome,
            cnpj
          ),
          obras:obra_id (
            nome
          )
        `)
        .eq("status", "concluido");

      // Filtro por empresa
      if (filtroEmpresaHistorico !== "todas") {
        query = query.eq("empresa_id", filtroEmpresaHistorico);
      }

      // Filtro por competência
      if (filtroCompetenciaHistorico !== "todas") {
        query = query.eq("competencia", filtroCompetenciaHistorico);
      }

      const { data, error } = await query.order("enviado_seguradora_em", { ascending: false });

      if (error) throw error;
      setLotesHistorico(data || []);
    } catch (error) {
      // Silently fail
    } finally {
      setLoadingHistorico(false);
    }
  }, [filtroEmpresaHistorico, filtroCompetenciaHistorico]);

  useEffect(() => {
    fetchLotes();
    fetchLotesHistorico();
    fetchEmpresas();

    // Configurar realtime para atualização automática
    const channel = supabase
      .channel('envios-lotes-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lotes_mensais'
        },
        () => {
          fetchLotes();
          fetchLotesHistorico();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLotes, fetchLotesHistorico, fetchEmpresas]);

  useEffect(() => {
    fetchLotes();
  }, [filtroEmpresa, filtroCompetencia, fetchLotes]);

  useEffect(() => {
    fetchLotesHistorico();
  }, [filtroEmpresaHistorico, filtroCompetenciaHistorico, fetchLotesHistorico]);

  const handleCotar = useCallback(async () => {
    if (!loteParaCotar || !valorPorColaborador) return;

    try {
      const valor = parseFloat(valorPorColaborador.replace(",", "."));
      if (isNaN(valor) || valor <= 0) {
        toast.error("Por favor, insira um valor válido");
        return;
      }

      const totalColaboradores = loteParaCotar.total_colaboradores || 0;
      const valorTotal = totalColaboradores * valor;

      // Atualizar lote
      const { error: loteError } = await supabase
        .from("lotes_mensais")
        .update({
          status: "cotado" as any,
          cotado_em: new Date().toISOString(),
          valor_total: valorTotal
        })
        .eq("id", loteParaCotar.id);

      if (loteError) throw loteError;

      // Inserir preço do plano
      const { error: precoError } = await supabase
        .from("precos_planos")
        .insert({
          lote_id: loteParaCotar.id,
          plano: "Plano Padrão",
          faixa_etaria: "Todas",
          valor: valor
        });

      if (precoError) throw precoError;

      toast.success("Lista confirmada com sucesso!");
      setCotacaoDialog(false);
      setLoteParaCotar(null);
      setValorPorColaborador("");
      fetchLotes();
    } catch (error) {
      console.error("Erro ao confirmar:", error);
      toast.error("Erro ao confirmar lista");
    }
  }, [loteParaCotar, valorPorColaborador, fetchLotes]);

  const handleEnviar = useCallback(async (loteId: string) => {
    try {
      const { error } = await supabase
        .from("lotes_mensais")
        .update({
          status: "enviado" as any,
          enviado_seguradora_em: new Date().toISOString()
        })
        .eq("id", loteId);

      if (error) throw error;
      toast.success("Lote enviado à seguradora com sucesso!");
      fetchLotes();
      fetchLotesHistorico();
    } catch (error) {
      console.error("Erro ao enviar lote:", error);
      toast.error("Erro ao processar envio");
    }
  }, [fetchLotes, fetchLotesHistorico]);

  const competencias = useMemo(() => {
    const uniqueCompetencias = Array.from(new Set(lotes.map(l => l.competencia)));
    return uniqueCompetencias.sort((a, b) => {
      const [mesA, anoA] = a.split('/');
      const [mesB, anoB] = b.split('/');
      return new Date(parseInt(anoB), parseInt(mesB) - 1).getTime() - 
             new Date(parseInt(anoA), parseInt(mesA) - 1).getTime();
    });
  }, [lotes]);

  const competenciasHistorico = useMemo(() => {
    const uniqueCompetencias = Array.from(new Set(lotesHistorico.map(l => l.competencia)));
    return uniqueCompetencias.sort((a, b) => {
      const [mesA, anoA] = a.split('/');
      const [mesB, anoB] = b.split('/');
      return new Date(parseInt(anoB), parseInt(mesB) - 1).getTime() - 
             new Date(parseInt(anoA), parseInt(mesA) - 1).getTime();
    });
  }, [lotesHistorico]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "em_cotacao":
        return <Badge variant="secondary">Aguardando Confirmação</Badge>;
      case "cotado":
        return <Badge variant="outline">Aguardando Aprovação Cliente</Badge>;
      case "aprovado":
        return <Badge className="bg-warning text-warning-foreground">Pronto para Envio</Badge>;
      case "enviado":
        return <Badge variant="default">Enviado à Seguradora</Badge>;
      case "concluido":
        return <Badge className="bg-success text-success-foreground">Concluído</Badge>;
      default:
        return <Badge variant="outline">{capitalize(status)}</Badge>;
    }
  };

  const getAcoes = (lote: any) => {
    switch (lote.status) {
      case "em_cotacao":
        return (
          <div className="flex gap-2 justify-center">
            <Button
              size="sm"
              onClick={() => {
                setLoteParaCotar(lote);
                setValorPorColaborador("50");
                setCotacaoDialog(true);
              }}
            >
              Confirmar
            </Button>
          </div>
        );
      case "cotado":
        return (
          <div className="flex gap-2 justify-center">
            <Button size="sm" variant="outline" disabled>
              Aguardando Cliente
            </Button>
          </div>
        );
      case "aprovado":
        return (
          <div className="flex gap-2 justify-center">
            <Button
              size="sm"
              onClick={() => handleEnviar(lote.id)}
            >
              <Send className="h-4 w-4 mr-1" />
              Enviar para Seguradora
            </Button>
          </div>
        );
      case "enviado":
        return (
          <div className="flex gap-2 justify-center">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setLoteSelected(lote);
                setGerenciarAprovacaoDialog(true);
              }}
            >
              <FileCheck className="h-4 w-4 mr-1" />
              Gerenciar Aprovações
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Gestão de Lotes</h1>
        <p className="text-muted-foreground">Confirme listas, envie para seguradora e gerencie aprovações</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lotes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <Label className="text-sm mb-2 block">
                <Filter className="h-3 w-3 inline mr-1" />
                Empresa
              </Label>
              <Popover open={openEmpresa} onOpenChange={setOpenEmpresa}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openEmpresa}
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
                            setOpenEmpresa(false);
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
                              setOpenEmpresa(false);
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
                    {filtroCompetencia === "todas" ? "Todas" : filtroCompetencia}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
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
                          Todas
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
          ) : lotes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Send className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Nenhum lote encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">Empresa</TableHead>
                    <TableHead className="text-center">Obra</TableHead>
                    <TableHead className="text-center">Competência</TableHead>
                    <TableHead className="text-center">Colaboradores</TableHead>
                    <TableHead className="text-center">Valor Total</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lotes.map((lote) => (
                    <TableRow key={lote.id}>
                      <TableCell className="text-center font-medium">
                        {lote.empresas?.nome || "N/A"}
                      </TableCell>
                      <TableCell className="text-center">
                        {lote.obras?.nome || "-"}
                      </TableCell>
                      <TableCell className="text-center">{lote.competencia}</TableCell>
                      <TableCell className="text-center">{lote.total_colaboradores}</TableCell>
                      <TableCell className="text-center">
                        {lote.valor_total 
                          ? new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: "BRL"
                            }).format(lote.valor_total)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(lote.status)}
                      </TableCell>
                      <TableCell className="text-center">{getAcoes(lote)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <Label className="text-sm mb-2 block">
                <Filter className="h-3 w-3 inline mr-1" />
                Empresa
              </Label>
              <Popover open={openEmpresaHistorico} onOpenChange={setOpenEmpresaHistorico}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openEmpresaHistorico}
                    className="w-full justify-between"
                  >
                    {filtroEmpresaHistorico === "todas" 
                      ? "Todas as empresas" 
                      : empresas.find((emp) => emp.id === filtroEmpresaHistorico)?.nome || "Selecione..."}
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
                            setFiltroEmpresaHistorico("todas");
                            setOpenEmpresaHistorico(false);
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${filtroEmpresaHistorico === "todas" ? "opacity-100" : "opacity-0"}`}
                          />
                          Todas as empresas
                        </CommandItem>
                        {empresas.map((emp) => (
                          <CommandItem
                            key={emp.id}
                            value={`${emp.nome} ${emp.cnpj}`}
                            onSelect={() => {
                              setFiltroEmpresaHistorico(emp.id);
                              setOpenEmpresaHistorico(false);
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${filtroEmpresaHistorico === emp.id ? "opacity-100" : "opacity-0"}`}
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

            <div className="flex-1">
              <Label className="text-sm mb-2 block">
                <Filter className="h-3 w-3 inline mr-1" />
                Competência
              </Label>
              <Popover open={openCompetenciaHistorico} onOpenChange={setOpenCompetenciaHistorico}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openCompetenciaHistorico}
                    className="w-full justify-between"
                  >
                    {filtroCompetenciaHistorico === "todas" ? "Todas" : filtroCompetenciaHistorico}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandList>
                      <CommandEmpty>Nenhuma competência encontrada.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="todas"
                          onSelect={() => {
                            setFiltroCompetenciaHistorico("todas");
                            setOpenCompetenciaHistorico(false);
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${filtroCompetenciaHistorico === "todas" ? "opacity-100" : "opacity-0"}`}
                          />
                          Todas
                        </CommandItem>
                        {competenciasHistorico.map((comp) => (
                          <CommandItem
                            key={comp}
                            value={comp}
                            onSelect={() => {
                              setFiltroCompetenciaHistorico(comp);
                              setOpenCompetenciaHistorico(false);
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${filtroCompetenciaHistorico === comp ? "opacity-100" : "opacity-0"}`}
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

          {loadingHistorico ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Carregando...</p>
            </div>
          ) : lotesHistorico.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileCheck className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Nenhum lote concluído</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">Empresa</TableHead>
                    <TableHead className="text-center">Obra</TableHead>
                    <TableHead className="text-center">Competência</TableHead>
                    <TableHead className="text-center">Colaboradores</TableHead>
                    <TableHead className="text-center">Aprovados</TableHead>
                    <TableHead className="text-center">Valor Total</TableHead>
                    <TableHead className="text-center">Data Conclusão</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lotesHistorico.map((lote) => (
                    <TableRow key={lote.id}>
                      <TableCell className="text-center font-medium">
                        {lote.empresas?.nome || "N/A"}
                      </TableCell>
                      <TableCell className="text-center">
                        {lote.obras?.nome || "-"}
                      </TableCell>
                      <TableCell className="text-center">{lote.competencia}</TableCell>
                      <TableCell className="text-center">{lote.total_colaboradores}</TableCell>
                      <TableCell className="text-center">{lote.total_aprovados || 0}</TableCell>
                      <TableCell className="text-center">
                        {lote.valor_total 
                          ? new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: "BRL"
                            }).format(lote.valor_total)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {lote.enviado_seguradora_em ? format(new Date(lote.enviado_seguradora_em), "dd/MM/yyyy", { locale: ptBR }) : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(lote.status)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={cotacaoDialog} onOpenChange={setCotacaoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Lista</DialogTitle>
            <DialogDescription>
              Informe o valor por colaborador para finalizar a confirmação
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Empresa</Label>
              <div className="text-sm font-medium">{loteParaCotar?.empresas?.nome}</div>
            </div>
            <div className="space-y-2">
              <Label>Competência</Label>
              <div className="text-sm">{loteParaCotar?.competencia}</div>
            </div>
            <div className="space-y-2">
              <Label>Total de Colaboradores</Label>
              <div className="text-sm font-bold">{loteParaCotar?.total_colaboradores}</div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="valor">Valor por Colaborador (R$)</Label>
              <Input
                id="valor"
                type="text"
                placeholder="0,00"
                defaultValue="50"
                value={valorPorColaborador}
                onChange={(e) => setValorPorColaborador(e.target.value)}
              />
            </div>
            {valorPorColaborador && (
              <div className="space-y-2 p-4 bg-muted rounded-lg">
                <Label>Valor Total</Label>
                <div className="text-2xl font-bold text-primary">
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL"
                  }).format((loteParaCotar?.total_colaboradores || 0) * parseFloat(valorPorColaborador.replace(",", ".") || "0"))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCotacaoDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCotar}>
              Confirmar Lista
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <GerenciarAprovacaoSeguradoraDialog
        lote={loteSelected}
        open={gerenciarAprovacaoDialog}
        onOpenChange={setGerenciarAprovacaoDialog}
        onSuccess={() => {
          fetchLotes();
          fetchLotesHistorico();
        }}
      />
    </div>
  );
};

export default Envios;
