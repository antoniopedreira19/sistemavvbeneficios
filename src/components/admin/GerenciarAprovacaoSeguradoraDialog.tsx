import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, XCircle, AlertCircle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCPF } from "@/lib/validators";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";

interface GerenciarAprovacaoSeguradoraDialogProps {
  lote: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  readOnly?: boolean;
}

const GerenciarAprovacaoSeguradoraDialog = ({
  lote,
  open,
  onOpenChange,
  onSuccess,
  readOnly = false,
}: GerenciarAprovacaoSeguradoraDialogProps) => {
  const [colaboradores, setColaboradores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [motivoReprovacao, setMotivoReprovacao] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showConcluirDialog, setShowConcluirDialog] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open && lote) {
      fetchColaboradores();
    }
  }, [open, lote]);

  const colaboradoresFiltrados = colaboradores.filter((colaborador) =>
    colaborador.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendentes = colaboradoresFiltrados.filter((c) => 
    c.status_seguradora === "pendente" || c.status_seguradora === "enviado"
  );
  const processados = colaboradoresFiltrados.filter((c) => 
    c.status_seguradora !== "pendente" && c.status_seguradora !== "enviado"
  );

  const fetchColaboradores = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("colaboradores_lote")
        .select("*")
        .eq("lote_id", lote.id)
        .eq("tentativa_reenvio", lote.tentativa_reenvio || 1)
        .order("nome");

      if (error) throw error;
      setColaboradores(data || []);
    } catch (error) {
      toast.error("Erro ao carregar colaboradores", { duration: 2000 });
    } finally {
      setLoading(false);
    }
  };

  const handleConcluirLote = async () => {
    try {
      // Verificar se há colaboradores reprovados em TODAS as tentativas do lote
      const { count, error: countError } = await supabase
        .from("colaboradores_lote")
        .select("*", { count: "exact", head: true })
        .eq("lote_id", lote.id)
        .eq("status_seguradora", "reprovado");

      if (countError) {
        console.error("Erro ao verificar reprovados:", countError);
        toast.error("Erro ao verificar status dos colaboradores", { duration: 2000 });
        return;
      }

      const temReprovados = (count || 0) > 0;
      const novoStatus = temReprovados ? "aguardando_correcao" : "aguardando_finalizacao";

      console.log("Verificação de reprovados:", {
        loteId: lote.id,
        totalReprovados: count,
        temReprovados,
        novoStatus
      });

      const { error: updateError } = await supabase
        .from("lotes_mensais")
        .update({ status: novoStatus })
        .eq("id", lote.id);

      if (updateError) {
        console.error("Erro ao concluir lote:", updateError);
        toast.error("Erro ao concluir lote", { duration: 2000 });
      } else {
        if (temReprovados) {
          toast.success(`Lote atualizado para "Aguardando Correção". ${count} colaborador(es) reprovado(s) precisam ser corrigidos.`, { duration: 4000 });
        } else {
          toast.success("Lote pronto para finalização! Aguardando finalização pelo admin em Relatórios.", { duration: 3000 });
        }
        setShowConcluirDialog(false);
        onOpenChange(false);
        
        // Invalidar todas as queries relacionadas a validar reprovados
        await queryClient.invalidateQueries({ queryKey: ['validar-reprovados-rascunho'] });
        await queryClient.invalidateQueries({ queryKey: ['validar-reprovados-enviados'] });
        await queryClient.invalidateQueries({ queryKey: ['validar-reprovados-concluidos'] });
        
        onSuccess();
      }
    } catch (error) {
      console.error("Erro ao concluir lote:", error);
      toast.error("Erro ao concluir lote", { duration: 2000 });
    }
  };

  const handleAprovar = async (colaboradorId: string) => {
    try {
      const { error } = await supabase
        .from("colaboradores_lote")
        .update({
          status_seguradora: "aprovado",
          motivo_reprovacao_seguradora: null,
        })
        .eq("id", colaboradorId);

      if (error) {
        console.error("Erro ao aprovar:", error);
        throw error;
      }
      toast.success("Colaborador aprovado pela seguradora", { duration: 2000 });
      await fetchColaboradores();
    } catch (error: any) {
      console.error("Erro ao aprovar colaborador:", error);
      toast.error(`Erro ao aprovar colaborador: ${error.message || "Erro desconhecido"}`, { duration: 2000 });
    }
  };

  const handleReprovar = async (colaboradorId: string) => {
    try {
      const { error } = await supabase
        .from("colaboradores_lote")
        .update({
          status_seguradora: "reprovado",
          motivo_reprovacao_seguradora: motivoReprovacao.trim() || null,
        })
        .eq("id", colaboradorId);

      if (error) {
        console.error("Erro ao reprovar:", error);
        throw error;
      }
      toast.success("Colaborador reprovado pela seguradora", { duration: 2000 });
      setEditingId(null);
      setMotivoReprovacao("");
      await fetchColaboradores();
    } catch (error: any) {
      console.error("Erro ao reprovar colaborador:", error);
      toast.error(`Erro ao reprovar colaborador: ${error.message || "Erro desconhecido"}`, { duration: 2000 });
    }
  };

  const handleAprovarTodos = async () => {
    const naoReprovados = colaboradores.filter((c) => c.status_seguradora !== "reprovado");
    
    if (naoReprovados.length === 0) {
      toast.info("Não há colaboradores para aprovar", { duration: 2000 });
      return;
    }

    try {
      const { error } = await supabase
        .from("colaboradores_lote")
        .update({
          status_seguradora: "aprovado",
          motivo_reprovacao_seguradora: null,
        })
        .eq("lote_id", lote.id)
        .eq("tentativa_reenvio", lote.tentativa_reenvio || 1)
        .neq("status_seguradora", "reprovado");

      if (error) {
        console.error("Erro ao aprovar todos:", error);
        throw error;
      }
      toast.success(`${naoReprovados.length} colaboradores aprovados pela seguradora`);
      setSelectedIds([]);
      await fetchColaboradores();
      onSuccess();
    } catch (error: any) {
      console.error("Erro ao aprovar todos colaboradores:", error);
      toast.error(`Erro ao aprovar todos: ${error.message || "Erro desconhecido"}`);
    }
  };

  const handleAprovarSelecionados = async () => {
    if (selectedIds.length === 0) {
      toast.info("Selecione colaboradores para aprovar", { duration: 2000 });
      return;
    }

    try {
      const { error } = await supabase
        .from("colaboradores_lote")
        .update({
          status_seguradora: "aprovado",
          motivo_reprovacao_seguradora: null,
        })
        .in("id", selectedIds);

      if (error) {
        console.error("Erro ao aprovar selecionados:", error);
        throw error;
      }
      toast.success(`${selectedIds.length} colaboradores aprovados`, { duration: 2000 });
      setSelectedIds([]);
      await fetchColaboradores();
    } catch (error: any) {
      console.error("Erro ao aprovar colaboradores selecionados:", error);
      toast.error(`Erro ao aprovar selecionados: ${error.message || "Erro desconhecido"}`, { duration: 2000 });
    }
  };

  const handleReprovarSelecionados = async () => {
    if (selectedIds.length === 0) {
      toast.info("Selecione colaboradores para reprovar", { duration: 2000 });
      return;
    }

    try {
      const { error } = await supabase
        .from("colaboradores_lote")
        .update({
          status_seguradora: "reprovado",
          motivo_reprovacao_seguradora: motivoReprovacao.trim() || null,
        })
        .in("id", selectedIds);

      if (error) {
        console.error("Erro ao reprovar selecionados:", error);
        throw error;
      }
      toast.success(`${selectedIds.length} colaboradores reprovados`, { duration: 2000 });
      setSelectedIds([]);
      setEditingId(null);
      setMotivoReprovacao("");
      await fetchColaboradores();
    } catch (error: any) {
      console.error("Erro ao reprovar colaboradores selecionados:", error);
      toast.error(`Erro ao reprovar selecionados: ${error.message || "Erro desconhecido"}`, { duration: 2000 });
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === pendentes.length && pendentes.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendentes.map((c) => c.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "aprovado":
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Aprovado</Badge>;
      case "reprovado":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Reprovado</Badge>;
      default:
        return <Badge variant="secondary"><AlertCircle className="w-3 h-3 mr-1" />Pendente</Badge>;
    }
  };

  const stats = {
    total: colaboradoresFiltrados.length,
    aprovados: colaboradoresFiltrados.filter((c) => c.status_seguradora === "aprovado").length,
    reprovados: colaboradoresFiltrados.filter((c) => c.status_seguradora === "reprovado").length,
    pendentes: pendentes.length,
  };

  const isVisualizacao = lote?.status === "concluido" || readOnly;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-4 pb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-3">
              <DialogTitle className="text-2xl">
                {readOnly ? "Visualizar Colaboradores Corrigidos" : isVisualizacao ? "Visualizar Aprovações" : "Gerenciar Aprovação da Seguradora"}
              </DialogTitle>
              <div className="flex flex-col gap-2">
                <DialogDescription className="text-base">
                  <span className="font-semibold">Empresa:</span> {lote?.empresas?.nome || "-"}
                </DialogDescription>
                <DialogDescription className="text-base">
                  <span className="font-semibold">Obra:</span> {lote?.obras?.nome || "-"}
                </DialogDescription>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-sm">
                    Competência: {lote?.competencia}
                  </Badge>
                  {lote?.tentativa_reenvio && lote.tentativa_reenvio > 1 && (
                    <Badge variant="secondary" className="text-sm">
                      Tentativa {lote.tentativa_reenvio}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
              {!isVisualizacao && stats.pendentes === 0 && colaboradores.length > 0 && (
                <Button
                  onClick={() => setShowConcluirDialog(true)}
                  className="mr-8"
                  size="sm"
                  variant="default"
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Concluir Lote
                </Button>
              )}
          </div>
        </DialogHeader>

        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="bg-muted p-3 rounded-lg">
            <div className="text-sm text-muted-foreground">Total</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </div>
          <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg">
            <div className="text-sm text-green-600 dark:text-green-400">Aprovados</div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.aprovados}</div>
          </div>
          <div className="bg-red-50 dark:bg-red-950 p-3 rounded-lg">
            <div className="text-sm text-red-600 dark:text-red-400">Reprovados</div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.reprovados}</div>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-950 p-3 rounded-lg">
            <div className="text-sm text-yellow-600 dark:text-yellow-400">Pendentes</div>
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.pendentes}</div>
          </div>
        </div>

        {!isVisualizacao && (
          <div className="flex gap-2 mb-4">
            {stats.pendentes > 0 && (
              <Button onClick={handleAprovarTodos} className="flex-1">
                <CheckCircle className="w-4 h-4 mr-2" />
                Aprovar Todos Não Reprovados
              </Button>
            )}
            {selectedIds.length > 0 && (
              <>
                <Button onClick={handleAprovarSelecionados} variant="default">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Aprovar Selecionados ({selectedIds.length})
                </Button>
                <Button
                  onClick={() => setEditingId("bulk")}
                  variant="destructive"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reprovar Selecionados ({selectedIds.length})
                </Button>
              </>
            )}
          </div>
        )}

        {editingId === "bulk" && (
          <div className="space-y-2 mb-4 p-4 border rounded-lg bg-muted">
            <Label>Motivo da Reprovação (para os selecionados)</Label>
            <Textarea
              value={motivoReprovacao}
              onChange={(e) => setMotivoReprovacao(e.target.value)}
              placeholder="Digite o motivo da reprovação..."
              rows={3}
            />
            <div className="flex gap-2">
              <Button variant="destructive" onClick={handleReprovarSelecionados}>
                Confirmar Reprovação
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setEditingId(null);
                  setMotivoReprovacao("");
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : isVisualizacao ? (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Nascimento</TableHead>
                  <TableHead>Status</TableHead>
                  {!readOnly && <TableHead>Motivo</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(readOnly ? colaboradoresFiltrados : processados).map((colaborador) => (
                  <TableRow key={colaborador.id}>
                    <TableCell>{colaborador.nome}</TableCell>
                    <TableCell>{formatCPF(colaborador.cpf)}</TableCell>
                    <TableCell>
                      {colaborador.data_nascimento
                        ? format(new Date(colaborador.data_nascimento + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })
                        : "-"}
                    </TableCell>
                    <TableCell>{getStatusBadge(colaborador.status_seguradora)}</TableCell>
                    {!readOnly && (
                      <TableCell>
                        {colaborador.motivo_reprovacao_seguradora || "-"}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Tabs defaultValue="pendentes" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="pendentes">
                Pendentes ({stats.pendentes})
              </TabsTrigger>
              <TabsTrigger value="processados">
                Processados ({stats.aprovados + stats.reprovados})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pendentes">
              <Table>
                <TableHeader>
                  <TableRow>
                    {!isVisualizacao && (
                      <TableHead className="w-12">
                        <input
                          type="checkbox"
                          checked={selectedIds.length === pendentes.length && pendentes.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded"
                        />
                      </TableHead>
                    )}
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Nascimento</TableHead>
                    <TableHead>Status</TableHead>
                    {!isVisualizacao && <TableHead>Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendentes.map((colaborador) => (
                    <TableRow key={colaborador.id}>
                      {!isVisualizacao && (
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(colaborador.id)}
                            onChange={() => toggleSelect(colaborador.id)}
                            className="rounded"
                          />
                        </TableCell>
                      )}
                      <TableCell>{colaborador.nome}</TableCell>
                      <TableCell>{formatCPF(colaborador.cpf)}</TableCell>
                      <TableCell>
                        {colaborador.data_nascimento
                          ? format(new Date(colaborador.data_nascimento + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })
                          : "-"}
                      </TableCell>
                      <TableCell>{getStatusBadge(colaborador.status_seguradora)}</TableCell>
                      {!isVisualizacao && (
                        <TableCell>
                        {editingId === colaborador.id ? (
                          <div className="space-y-2 min-w-[300px]">
                            <Label>Motivo da Reprovação</Label>
                            <Textarea
                              value={motivoReprovacao}
                              onChange={(e) => setMotivoReprovacao(e.target.value)}
                              placeholder="Digite o motivo da reprovação..."
                              rows={3}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleReprovar(colaborador.id)}
                              >
                                Confirmar Reprovação
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingId(null);
                                  setMotivoReprovacao("");
                                }}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleAprovar(colaborador.id)}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Aprovar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setEditingId(colaborador.id);
                                setMotivoReprovacao(colaborador.motivo_reprovacao_seguradora || "");
                              }}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Reprovar
                            </Button>
                          </div>
                        )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="processados">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Nascimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processados.map((colaborador) => (
                    <TableRow key={colaborador.id}>
                      <TableCell>{colaborador.nome}</TableCell>
                      <TableCell>{formatCPF(colaborador.cpf)}</TableCell>
                      <TableCell>
                        {colaborador.data_nascimento
                          ? format(new Date(colaborador.data_nascimento + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })
                          : "-"}
                      </TableCell>
                      <TableCell>{getStatusBadge(colaborador.status_seguradora)}</TableCell>
                      <TableCell>
                        {colaborador.motivo_reprovacao_seguradora || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        )}
        </DialogContent>
      </Dialog>

      {showConcluirDialog && (
        <Dialog open={showConcluirDialog} onOpenChange={setShowConcluirDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Concluir Lote?</DialogTitle>
              <DialogDescription>
                Ao concluir este lote, o relatório com os colaboradores aprovados será disponibilizado para o cliente visualizar e baixar.
                Esta ação não pode ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowConcluirDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleConcluirLote}>
                Concluir Lote
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default GerenciarAprovacaoSeguradoraDialog;
