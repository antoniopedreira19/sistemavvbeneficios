import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { Loader2, Copy, AlertCircle, CheckCircle2, UserCheck, History } from "lucide-react";

interface ProcessarRetornoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loteId: string;
  empresaNome: string;
  competencia: string;
}

interface ColaboradorLote {
  id: string;
  nome: string;
  cpf: string;
  status_seguradora: string | null;
  motivo_reprovacao_seguradora: string | null;
}

interface ReprovadoInfo {
  id: string;
  motivo: string;
}

export function ProcessarRetornoDialog({
  open,
  onOpenChange,
  loteId,
  empresaNome,
  competencia,
}: ProcessarRetornoDialogProps) {
  const queryClient = useQueryClient();
  const [reprovados, setReprovados] = useState<Map<string, ReprovadoInfo>>(new Map());
  const [motivoEmLote, setMotivoEmLote] = useState("");

  const { data: colaboradores, isLoading } = useQuery({
    queryKey: ["colaboradores-lote", loteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaboradores_lote")
        .select("id, nome, cpf, status_seguradora, motivo_reprovacao_seguradora")
        .eq("lote_id", loteId)
        .order("nome");

      if (error) throw error;
      return data as ColaboradorLote[];
    },
    enabled: open,
  });

  // Separação Visual: Quem precisa de ação vs Quem já foi
  const pendentes = colaboradores?.filter((c) => c.status_seguradora === "pendente") || [];
  const jaProcessados = colaboradores?.filter((c) => c.status_seguradora !== "pendente") || [];

  const processarMutation = useMutation({
    mutationFn: async () => {
      if (!colaboradores) return;

      const reprovadosArray = Array.from(reprovados.entries());

      // 1. Atualizar REPROVADOS (Marcados agora)
      for (const [id, info] of reprovadosArray) {
        const { error } = await supabase
          .from("colaboradores_lote")
          .update({
            status_seguradora: "reprovado",
            motivo_reprovacao_seguradora: info.motivo,
          })
          .eq("id", id);
        if (error) throw error;
      }

      // 2. Atualizar APROVADOS (Pendentes que NÃO foram marcados)
      const reprovadosIds = Array.from(reprovados.keys());
      const novosAprovadosIds = pendentes.filter((c) => !reprovadosIds.includes(c.id)).map((c) => c.id);

      if (novosAprovadosIds.length > 0) {
        const { error } = await supabase
          .from("colaboradores_lote")
          .update({
            status_seguradora: "aprovado",
            motivo_reprovacao_seguradora: null,
          })
          .in("id", novosAprovadosIds);
        if (error) throw error;
      }

      // 3. Calcular Totais Finais
      const totalPendentes = pendentes.length;
      const totalReprovadosAgora = reprovadosArray.length;
      const totalAprovadosAgora = totalPendentes - totalReprovadosAgora;

      // Totais acumulados
      const totalAprovadosGeral =
        jaProcessados.filter((c) => c.status_seguradora === "aprovado").length + totalAprovadosAgora;
      const totalReprovadosGeral =
        jaProcessados.filter((c) => c.status_seguradora === "reprovado").length + totalReprovadosAgora;

      const valorTotalCalculado = totalAprovadosGeral * 50;

      // NOVO FLUXO: Sempre vai para "concluido" - os aprovados seguem, reprovados ficam registrados
      const novoStatus = "concluido";

      const { error: loteError } = await supabase
        .from("lotes_mensais")
        .update({
          status: novoStatus,
          total_aprovados: totalAprovadosGeral,
          total_reprovados: totalReprovadosGeral,
          valor_total: valorTotalCalculado,
          updated_at: new Date().toISOString(),
        })
        .eq("id", loteId);

      if (loteError) throw loteError;

      return { novoStatus, totalReprovados: totalReprovadosGeral, totalAprovados: totalAprovadosGeral };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["lotes-operacional"] });
      queryClient.invalidateQueries({ queryKey: ["colaboradores-lote", loteId] });

      if (result?.totalReprovados && result.totalReprovados > 0) {
        toast.success(
          `Processado! ${result.totalAprovados} aprovados, ${result.totalReprovados} reprovados. Lote enviado para Prontos.`
        );
      } else {
        toast.success("Lote finalizado! Todos aprovados.");
      }
      setReprovados(new Map());
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error(error);
      toast.error("Erro ao processar: " + (error.message || "Erro desconhecido"));
    },
  });

  const toggleReprovado = (id: string, checked: boolean) => {
    const newReprovados = new Map(reprovados);
    if (checked) {
      newReprovados.set(id, { id, motivo: "" });
    } else {
      newReprovados.delete(id);
    }
    setReprovados(newReprovados);
  };

  const updateMotivo = (id: string, motivo: string) => {
    const newReprovados = new Map(reprovados);
    const info = newReprovados.get(id);
    if (info) {
      newReprovados.set(id, { ...info, motivo });
      setReprovados(newReprovados);
    }
  };

  const aplicarMotivoEmLote = () => {
    if (!motivoEmLote.trim()) {
      toast.error("Digite um motivo para aplicar");
      return;
    }
    const newReprovados = new Map(reprovados);
    for (const [id, info] of newReprovados) {
      newReprovados.set(id, { ...info, motivo: motivoEmLote });
    }
    setReprovados(newReprovados);
    toast.success(`Motivo aplicado a ${newReprovados.size} colaborador(es)`);
  };

  const handleProcessar = () => {
    for (const [, info] of reprovados) {
      if (!info.motivo.trim()) {
        toast.error("Informe o motivo para todos os colaboradores reprovados");
        return;
      }
    }
    processarMutation.mutate();
  };

  const getStatusBadge = (status: string | null) => {
    if (status === "aprovado")
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          Aprovado
        </Badge>
      );
    if (status === "reprovado")
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          Reprovado
        </Badge>
      );
    return <Badge variant="secondary">Pendente</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Processar Retorno da Seguradora</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {empresaNome} - {competencia}
          </p>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-2 space-y-6">
            {/* SEÇÃO 1: PENDENTES (Ação Necessária) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2 text-blue-700">
                  <AlertCircle className="h-4 w-4" />
                  Aguardando Análise ({pendentes.length})
                </h3>
                {pendentes.length > 0 && <Badge variant="secondary">Requer Ação</Badge>}
              </div>

              {pendentes.length === 0 ? (
                <div className="text-center py-6 border rounded-md bg-muted/10 text-muted-foreground text-sm">
                  Nenhum colaborador pendente. Todos já foram processados.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded text-sm">
                    Marque os <strong>REPROVADOS</strong>. Os desmarcados serão <strong>APROVADOS</strong>{" "}
                    automaticamente.
                  </div>

                  {reprovados.size > 0 && (
                    <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border">
                      <Input
                        placeholder="Motivo em lote (ex: Data incorreta)"
                        value={motivoEmLote}
                        onChange={(e) => setMotivoEmLote(e.target.value)}
                        className="flex-1 h-9"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={aplicarMotivoEmLote}
                        className="shrink-0"
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Aplicar
                      </Button>
                    </div>
                  )}

                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-12 text-center">Repr.</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>CPF</TableHead>
                          <TableHead>Motivo da Reprovação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendentes.map((colab) => (
                          <TableRow key={colab.id} className={reprovados.has(colab.id) ? "bg-red-50" : ""}>
                            <TableCell className="text-center">
                              <Checkbox
                                checked={reprovados.has(colab.id)}
                                onCheckedChange={(checked) => toggleReprovado(colab.id, checked as boolean)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{colab.nome}</TableCell>
                            <TableCell>{colab.cpf}</TableCell>
                            <TableCell>
                              {reprovados.has(colab.id) ? (
                                <Input
                                  placeholder="Descreva o motivo..."
                                  value={reprovados.get(colab.id)?.motivo || ""}
                                  onChange={(e) => updateMotivo(colab.id, e.target.value)}
                                  className="h-8 border-red-200 focus-visible:ring-red-500"
                                />
                              ) : (
                                <span className="text-xs text-green-600 font-medium flex items-center">
                                  <CheckCircle2 className="w-3 h-3 mr-1" /> Aprovar
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>

            {/* SEÇÃO 2: JÁ PROCESSADOS (Histórico) */}
            {jaProcessados.length > 0 && (
              <Accordion type="single" collapsible className="w-full border rounded-md px-4">
                <AccordionItem value="item-1" className="border-none">
                  <AccordionTrigger className="text-sm font-medium text-muted-foreground hover:no-underline py-3">
                    <div className="flex items-center gap-2">
                      <History className="h-4 w-4" />
                      Já Processados / Histórico ({jaProcessados.length})
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="border rounded-md mt-2">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead>Nome</TableHead>
                            <TableHead>CPF</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {jaProcessados.map((colab) => (
                            <TableRow key={colab.id} className="opacity-70 bg-muted/10">
                              <TableCell>{colab.nome}</TableCell>
                              <TableCell>{colab.cpf}</TableCell>
                              <TableCell>{getStatusBadge(colab.status_seguradora)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}

            {/* RESUMO FINAL */}
            <div className="flex items-center justify-between bg-muted/20 p-4 rounded-lg border">
              <div className="text-sm text-muted-foreground">
                Total Geral do Lote: <strong>{colaboradores?.length || 0}</strong>
              </div>
              <div className="flex gap-6 text-sm">
                <div className="flex flex-col items-end">
                  <span className="text-muted-foreground text-xs">Novos Reprovados</span>
                  <span className="font-bold text-red-600">{reprovados.size}</span>
                </div>
                <div className="flex flex-col items-end border-l pl-6">
                  <span className="text-muted-foreground text-xs">Novos Aprovados</span>
                  <span className="font-bold text-green-600">{pendentes.length - reprovados.size}</span>
                </div>
                <div className="flex flex-col items-end border-l pl-6 bg-green-50/50 px-2 rounded">
                  <span className="text-green-700 text-xs font-medium">Valor Final Previsto</span>
                  <span className="font-mono font-bold text-green-800">
                    R${" "}
                    {(
                      (jaProcessados.filter((c) => c.status_seguradora === "aprovado").length +
                        (pendentes.length - reprovados.size)) *
                      50
                    ).toLocaleString("pt-BR")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="mt-4 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleProcessar}
            disabled={processarMutation.isPending || isLoading || pendentes.length === 0}
            className={reprovados.size === 0 ? "bg-green-600 hover:bg-green-700" : "bg-primary"}
          >
            {processarMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {reprovados.size === 0 ? "Aprovar Pendentes e Finalizar" : "Confirmar Reprovações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
