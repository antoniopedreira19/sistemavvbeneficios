import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Pencil, Trash2, Send, Search } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { NovoColaboradorDialog } from "@/components/cliente/NovoColaboradorDialog";
import { EditarColaboradorDialog } from "@/components/cliente/EditarColaboradorDialog";
import { ImportarColaboradoresDialog } from "@/components/cliente/ImportarColaboradoresDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { formatCPF } from "@/lib/validators";
import { parseLocalDate } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const Colaboradores = () => {
  const { profile } = useUserRole();
  const [colaboradores, setColaboradores] = useState<any[]>([]);
  const [obras, setObras] = useState<any[]>([]);
  const [selectedObra, setSelectedObra] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [novosEsteMes, setNovosEsteMes] = useState(0);
  const [desligamentosEsteMes, setDesligamentosEsteMes] = useState(0);
  const [editingColaborador, setEditingColaborador] = useState<any>(null);
  const [deletingColaborador, setDeletingColaborador] = useState<any>(null);
  const [deleteAction, setDeleteAction] = useState<'desligar' | 'excluir' | null>(null);
  const [processing, setProcessing] = useState(false);
  const [showQuoteDialog, setShowQuoteDialog] = useState(false);
  const [sending, setSending] = useState(false);
  const [alteracoes, setAlteracoes] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "MM"));
  const [selectedYear, setSelectedYear] = useState(format(new Date(), "yyyy"));
  const [observacoes, setObservacoes] = useState("");
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [historicoEnvios, setHistoricoEnvios] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const meses = useMemo(() => [
    { value: "01", label: "Janeiro" },
    { value: "02", label: "Fevereiro" },
    { value: "03", label: "Março" },
    { value: "04", label: "Abril" },
    { value: "05", label: "Maio" },
    { value: "06", label: "Junho" },
    { value: "07", label: "Julho" },
    { value: "08", label: "Agosto" },
    { value: "09", label: "Setembro" },
    { value: "10", label: "Outubro" },
    { value: "11", label: "Novembro" },
    { value: "12", label: "Dezembro" }
  ], []);

  const anos = useMemo(() => Array.from({ length: 10 }, (_, i) => {
    const year = new Date().getFullYear() + i;
    return { value: year.toString(), label: year.toString() };
  }), []);

  // Buscar obras da empresa
  const fetchObras = useCallback(async () => {
    if (!profile?.empresa_id) return;

    try {
      const { data, error } = await supabase
        .from("obras")
        .select("*")
        .eq("empresa_id", profile.empresa_id)
        .eq("status", "ativa")
        .order("nome");

      if (error) throw error;
      
      setObras(data || []);
    } catch (error) {
      console.error("Erro ao buscar obras:", error);
      toast.error("Erro ao carregar obras");
    }
  }, [profile?.empresa_id]);

  // Buscar histórico de envios para a obra selecionada
  const fetchHistoricoEnvios = useCallback(async () => {
    if (!profile?.empresa_id || !selectedObra) {
      setHistoricoEnvios([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("lotes_mensais")
        .select(`
          *,
          obras:obra_id (nome)
        `)
        .eq("empresa_id", profile.empresa_id)
        .eq("obra_id", selectedObra)
        .order("competencia", { ascending: false });

      if (error) throw error;
      setHistoricoEnvios(data || []);
    } catch (error) {
      console.error("Erro ao buscar histórico de envios:", error);
    }
  }, [profile?.empresa_id, selectedObra]);

  // Recarregar obras quando o componente é montado ou quando o usuário volta para a página
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && profile?.empresa_id) {
        fetchObras();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Chamar na montagem inicial
    if (profile?.empresa_id) {
      fetchObras();
    }
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [profile?.empresa_id, fetchObras]);

  const fetchColaboradores = useCallback(async () => {
    if (!profile?.empresa_id || !selectedObra) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("colaboradores")
        .select("*")
        .eq("empresa_id", profile.empresa_id)
        .eq("obra_id", selectedObra)
        .eq("status", "ativo")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setColaboradores(data || []);

      // Calcular estatísticas
      const agora = new Date();
      const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

      const novos = (data || []).filter((c) => {
        const criado = new Date(c.created_at);
        return criado >= inicioMes;
      }).length;

      setNovosEsteMes(novos);
      // Desligamentos virão de uma coluna futura ou status
      setDesligamentosEsteMes(0);

      // Calcular alterações desde o último envio
      const { data: lotesData } = await supabase
        .from("lotes_mensais")
        .select("*")
        .eq("empresa_id", profile.empresa_id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (lotesData && lotesData.length > 0) {
        const ultimoLote = lotesData[0];
        const dataUltimoLote = new Date(ultimoLote.created_at);
        const novosDesdeUltimo = (data || []).filter(c => new Date(c.created_at) > dataUltimoLote);
        setAlteracoes(novosDesdeUltimo.length);
      } else {
        setAlteracoes(data?.length || 0);
      }
    } catch (error) {
      console.error("Erro ao buscar colaboradores:", error);
    } finally {
      setLoading(false);
    }
  }, [profile?.empresa_id, selectedObra]);

  useEffect(() => {
    if (selectedObra) {
      fetchColaboradores();
      fetchHistoricoEnvios();
    }
  }, [profile?.empresa_id, selectedObra, fetchColaboradores, fetchHistoricoEnvios]);

  const handleDesligar = useCallback(async () => {
    if (!deletingColaborador) return;

    setProcessing(true);
    try {
      const { error } = await supabase
        .from("colaboradores")
        .update({ 
          status: "desligado" as any,
          updated_at: new Date().toISOString()
        })
        .eq("id", deletingColaborador.id);

      if (error) throw error;

      toast.success("Colaborador desligado com sucesso!");
      setDeletingColaborador(null);
      setDeleteAction(null);
      fetchColaboradores();
    } catch (error) {
      console.error("Erro ao desligar colaborador:", error);
      toast.error("Erro ao desligar colaborador");
    } finally {
      setProcessing(false);
    }
  }, [deletingColaborador, fetchColaboradores]);

  const handleExcluirPermanentemente = useCallback(async () => {
    if (!deletingColaborador) return;

    setProcessing(true);
    try {
      const { error } = await supabase
        .from("colaboradores")
        .delete()
        .eq("id", deletingColaborador.id);

      if (error) throw error;

      toast.success("Colaborador excluído permanentemente!");
      setDeletingColaborador(null);
      setDeleteAction(null);
      fetchColaboradores();
    } catch (error) {
      console.error("Erro ao excluir colaborador:", error);
      toast.error("Erro ao excluir colaborador");
    } finally {
      setProcessing(false);
    }
  }, [deletingColaborador, fetchColaboradores]);

  const handleSendToQuote = useCallback(async () => {
    if (colaboradores.length === 0) {
      toast.error("Adicione colaboradores antes de enviar para cotação");
      return;
    }

    if (!selectedObra) {
      toast.error("Selecione uma obra antes de enviar para cotação");
      return;
    }

    setSending(true);
    try {
      // Criar novo lote
      const competencia = `${selectedMonth}/${selectedYear}`;
      
      const { data: lote, error: loteError } = await supabase
        .from("lotes_mensais")
        .insert({
          empresa_id: profile?.empresa_id!,
          obra_id: selectedObra,
          competencia: competencia,
          status: "em_cotacao" as any,
          total_colaboradores: colaboradores.length,
          total_novos: alteracoes,
          observacoes: observacoes,
          enviado_cotacao_em: new Date().toISOString()
        })
        .select()
        .single();

      if (loteError) throw loteError;

      // Criar snapshot dos colaboradores neste lote
      const colaboradoresLote = colaboradores.map(c => ({
        lote_id: lote.id,
        colaborador_id: c.id,
        nome: c.nome,
        cpf: c.cpf,
        sexo: c.sexo,
        data_nascimento: c.data_nascimento,
        salario: c.salario,
        classificacao: c.classificacao,
        classificacao_salario: c.classificacao_salario,
        aposentado: c.aposentado,
        afastado: c.afastado,
        cid: c.cid
      }));

      const { error: colabsError } = await supabase
        .from("colaboradores_lote")
        .insert(colaboradoresLote);

      if (colabsError) throw colabsError;

      toast.success("Lista enviada para cotação com sucesso!");
      setShowQuoteDialog(false);
      setSelectedMonth(format(new Date(), "MM"));
      setSelectedYear(format(new Date(), "yyyy"));
      setObservacoes("");
      fetchColaboradores();
      fetchHistoricoEnvios();
    } catch (error) {
      console.error("Erro ao enviar para cotação:", error);
      toast.error("Erro ao enviar para cotação");
    } finally {
      setSending(false);
    }
  }, [profile?.empresa_id, selectedObra, observacoes, selectedMonth, selectedYear, colaboradores, alteracoes, fetchColaboradores, fetchHistoricoEnvios]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Colaboradores</h1>
          <p className="text-muted-foreground">Gerencie os colaboradores da sua empresa</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => setShowQuoteDialog(true)} variant="outline" disabled={colaboradores.length === 0 || !selectedObra}>
            <Send className="h-4 w-4 mr-2" />
            Enviar Lista
          </Button>
          <Button onClick={() => setShowImportDialog(true)} variant="outline" disabled={!selectedObra}>
            <Users className="h-4 w-4 mr-2" />
            Importar XLSX
          </Button>
          <NovoColaboradorDialog obraId={selectedObra} onSuccess={fetchColaboradores} disabled={!selectedObra} />
        </div>
      </div>

      {/* Seletor de Obra */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Label htmlFor="obra-select" className="min-w-fit">
              Selecione a Obra:
            </Label>
            <Select value={selectedObra} onValueChange={setSelectedObra}>
              <SelectTrigger id="obra-select" className="max-w-md">
                <SelectValue placeholder="Selecione uma obra" />
              </SelectTrigger>
              <SelectContent>
                {obras.map((obra) => (
                  <SelectItem key={obra.id} value={obra.id}>
                    {obra.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedObra && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Colaboradores</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{colaboradores.length}</div>
            <p className="text-xs text-muted-foreground">colaboradores ativos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Novos este Mês</CardTitle>
            <Users className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{novosEsteMes}</div>
            <p className="text-xs text-muted-foreground">adições recentes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Desligamentos</CardTitle>
            <Users className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{desligamentosEsteMes}</div>
            <p className="text-xs text-muted-foreground">este mês</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Colaboradores</CardTitle>
          <CardDescription>
            {profile?.empresa_id ? "Gerencie e edite os dados dos colaboradores" : "Configure uma empresa no seu perfil para começar"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Carregando...</p>
            </div>
          ) : colaboradores.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Nenhum colaborador cadastrado</p>
              <p className="text-sm mt-2">Clique em "Novo Colaborador" para adicionar o primeiro</p>
            </div>
          ) : (
            <>
              {/* Campo de Busca */}
              <div className="mb-4 px-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou CPF..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1); // Reset to first page on search
                    }}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Lista Filtrada */}
              {(() => {
                // Função para normalizar texto (remover acentos e converter para minúsculas)
                const normalizeText = (text: string) => {
                  return text
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '');
                };

                // Filtrar colaboradores
                const filteredColaboradores = colaboradores.filter((colaborador) => {
                  if (!searchTerm.trim()) return true;
                  
                  const searchNormalized = normalizeText(searchTerm);
                  const nomeNormalized = normalizeText(colaborador.nome);
                  const cpfNumbers = colaborador.cpf.replace(/\D/g, '');
                  const searchNumbers = searchTerm.replace(/\D/g, '');
                  
                  return (
                    nomeNormalized.includes(searchNormalized) ||
                    (searchNumbers.length > 0 && cpfNumbers.includes(searchNumbers))
                  );
                });

                // Aplicar paginação
                const totalPages = Math.ceil(filteredColaboradores.length / itemsPerPage);
                const startIndex = (currentPage - 1) * itemsPerPage;
                const endIndex = startIndex + itemsPerPage;
                const paginatedColaboradores = filteredColaboradores.slice(startIndex, endIndex);

                if (filteredColaboradores.length === 0) {
                  return (
                    <div className="text-center py-12 text-muted-foreground">
                      <Search className="h-12 w-12 mx-auto mb-4 opacity-20" />
                      <p>Nenhum colaborador encontrado</p>
                      <p className="text-sm mt-2">Tente buscar com outro termo</p>
                    </div>
                  );
                }

                return (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-sm">Nome</TableHead>
                            <TableHead className="text-sm">CPF</TableHead>
                            <TableHead className="text-sm">Sexo</TableHead>
                            <TableHead className="text-sm">Data Nasc.</TableHead>
                            <TableHead className="text-sm">Salário</TableHead>
                            <TableHead className="text-sm">Classificação</TableHead>
                            <TableHead className="text-sm">Class. Salário</TableHead>
                            <TableHead className="text-right text-sm">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedColaboradores.map((colaborador) => (
                            <TableRow key={colaborador.id}>
                              <TableCell className="font-medium text-sm">{colaborador.nome}</TableCell>
                              <TableCell className="text-sm whitespace-nowrap">{formatCPF(colaborador.cpf)}</TableCell>
                              <TableCell className="text-sm">{colaborador.sexo}</TableCell>
                              <TableCell className="text-sm">
                                {format(parseLocalDate(colaborador.data_nascimento), "dd/MM/yyyy", { locale: ptBR })}
                              </TableCell>
                              <TableCell className="text-sm">
                                {new Intl.NumberFormat('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL'
                                }).format(colaborador.salario)}
                              </TableCell>
                              <TableCell className="text-sm">{colaborador.classificacao}</TableCell>
                              <TableCell className="text-sm">{colaborador.classificacao_salario}</TableCell>
                              <TableCell className="text-right text-sm">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setEditingColaborador(colaborador)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setDeletingColaborador(colaborador)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Paginação */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between px-6 py-4 border-t">
                        <div className="text-sm text-muted-foreground">
                          Mostrando {startIndex + 1} a {Math.min(endIndex, filteredColaboradores.length)} de {filteredColaboradores.length} colaboradores
                        </div>
                        <Pagination>
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious 
                                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                              />
                            </PaginationItem>
                            
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                              let pageNumber;
                              if (totalPages <= 5) {
                                pageNumber = i + 1;
                              } else if (currentPage <= 3) {
                                pageNumber = i + 1;
                              } else if (currentPage >= totalPages - 2) {
                                pageNumber = totalPages - 4 + i;
                              } else {
                                pageNumber = currentPage - 2 + i;
                              }
                              
                              return (
                                <PaginationItem key={pageNumber}>
                                  <PaginationLink
                                    onClick={() => setCurrentPage(pageNumber)}
                                    isActive={currentPage === pageNumber}
                                    className="cursor-pointer"
                                  >
                                    {pageNumber}
                                  </PaginationLink>
                                </PaginationItem>
                              );
                            })}
                            
                            <PaginationItem>
                              <PaginationNext 
                                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                              />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      </div>
                    )}
                  </>
                );
              })()}
            </>
          )}
        </CardContent>
      </Card>

      {/* Histórico de Envios */}
      {selectedObra && historicoEnvios.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Envios</CardTitle>
            <CardDescription>
              Listas enviadas para cotação da obra selecionada
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Competência</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Colaboradores</TableHead>
                    <TableHead>Enviado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historicoEnvios.map((lote) => (
                    <TableRow key={lote.id}>
                      <TableCell className="font-medium">{lote.competencia}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          lote.status === 'concluido' ? 'bg-green-100 text-green-800' :
                          lote.status === 'aprovado' ? 'bg-blue-100 text-blue-800' :
                          lote.status === 'em_cotacao' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {lote.status === 'em_cotacao' ? 'Em Cotação' :
                           lote.status === 'cotado' ? 'Cotado' :
                           lote.status === 'aprovado' ? 'Aprovado' :
                           lote.status === 'enviado' ? 'Enviado' :
                           lote.status === 'concluido' ? 'Concluído' :
                           lote.status}
                        </span>
                      </TableCell>
                      <TableCell>{lote.total_colaboradores || 0}</TableCell>
                      <TableCell>
                        {lote.enviado_cotacao_em ? 
                          format(new Date(lote.enviado_cotacao_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 
                          '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <EditarColaboradorDialog
        colaborador={editingColaborador}
        open={!!editingColaborador}
        onOpenChange={(open) => !open && setEditingColaborador(null)}
        onSuccess={fetchColaboradores}
      />

      {/* Dialog inicial - escolher ação */}
      <AlertDialog 
        open={!!deletingColaborador && !deleteAction} 
        onOpenChange={(open) => {
          if (!open) {
            setDeletingColaborador(null);
            setDeleteAction(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Colaborador</AlertDialogTitle>
            <AlertDialogDescription>
              Como você deseja remover <span className="font-semibold">{deletingColaborador?.nome}</span>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-3 py-4">
            <div className="rounded-lg border-2 border-border p-4 hover:border-primary cursor-pointer transition-colors"
                 onClick={() => setDeleteAction('desligar')}>
              <h4 className="font-semibold mb-1">Desligar Colaborador</h4>
              <p className="text-sm text-muted-foreground">
                O colaborador será marcado como desligado e não aparecerá mais nas listas ativas, 
                mas seus dados históricos serão preservados.
              </p>
            </div>

            <div className="rounded-lg border-2 border-destructive p-4 hover:border-destructive/80 cursor-pointer transition-colors"
                 onClick={() => setDeleteAction('excluir')}>
              <h4 className="font-semibold mb-1 text-destructive">Excluir Permanentemente</h4>
              <p className="text-sm text-muted-foreground">
                O colaborador será removido permanentemente do banco de dados. 
                Dados históricos em lotes enviados serão mantidos.
              </p>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de confirmação - Desligar */}
      <AlertDialog 
        open={deleteAction === 'desligar'} 
        onOpenChange={(open) => {
          if (!open) setDeleteAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Desligamento</AlertDialogTitle>
            <AlertDialogDescription>
              Confirma o desligamento de <span className="font-semibold">{deletingColaborador?.nome}</span>? 
              O colaborador não aparecerá mais nas listas ativas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDesligar} disabled={processing}>
              {processing ? "Processando..." : "Confirmar Desligamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de confirmação - Excluir permanentemente */}
      <AlertDialog 
        open={deleteAction === 'excluir'} 
        onOpenChange={(open) => {
          if (!open) setDeleteAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão Permanente</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Tem certeza que deseja excluir permanentemente <span className="font-semibold">{deletingColaborador?.nome}</span>?
              </p>
              <p className="text-destructive font-semibold">
                ⚠️ Esta ação não pode ser desfeita!
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleExcluirPermanentemente} 
              disabled={processing}
              className="bg-destructive hover:bg-destructive/90"
            >
              {processing ? "Excluindo..." : "Excluir Permanentemente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de envio para cotação */}
      <Dialog open={showQuoteDialog} onOpenChange={setShowQuoteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Envio para Cotação</DialogTitle>
            <DialogDescription>
              Preencha os dados do lote antes de enviar
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Competência (Mês/Ano)</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger>
                      <SelectValue placeholder="Mês" />
                    </SelectTrigger>
                    <SelectContent>
                      {meses.map((mes) => (
                        <SelectItem key={mes.value} value={mes.value}>
                          {mes.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger>
                      <SelectValue placeholder="Ano" />
                    </SelectTrigger>
                    <SelectContent>
                      {anos.map((ano) => (
                        <SelectItem key={ano.value} value={ano.value}>
                          {ano.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações (Opcional)</Label>
              <Textarea
                id="observacoes"
                placeholder="Adicione observações relevantes..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={3}
              />
            </div>

            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm font-medium">Resumo do Envio:</p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                <li>• {colaboradores.length} colaboradores ativos</li>
                <li>• {alteracoes} alterações desde o último envio</li>
                <li>• Competência: {selectedMonth}/{selectedYear}</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuoteDialog(false)} disabled={sending}>
              Cancelar
            </Button>
            <Button onClick={handleSendToQuote} disabled={sending}>
              {sending ? "Enviando..." : "Confirmar Envio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Importação */}
      {profile?.empresa_id && selectedObra && (
        <ImportarColaboradoresDialog
          open={showImportDialog}
          onOpenChange={setShowImportDialog}
          empresaId={profile.empresa_id}
          obraId={selectedObra}
          onSuccess={fetchColaboradores}
        />
      )}
        </>
      )}
    </div>
  );
};

export default Colaboradores;
