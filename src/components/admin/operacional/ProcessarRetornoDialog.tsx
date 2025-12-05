import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Copy, AlertCircle, CheckCircle2 } from "lucide-react";

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
      // CORREÇÃO 1: Removemos o filtro de status 'pendente'.
      // Buscamos TODOS para garantir que o cálculo de valor total seja feito sobre o lote inteiro
      // e para recuperar itens que ficaram travados em 'aprovado' por erro anterior.
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

  const processarMutation = useMutation({
    mutationFn: async () => {
      if (!colaboradores) return;

      const reprovadosArray = Array.from(reprovados.entries());

      // 1. Atualizar quem foi marcado como REPROVADO agora
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

      // 2. Atualizar quem NÃO está na lista de reprovados (Aprovados)
      // Isso conserta qualquer colaborador que esteja com status errado
      const reprovadosIds = Array.from(reprovados.keys());
      const aprovadosIds = colaboradores.filter((c) => !reprovadosIds.includes(c.id)).map((c) => c.id);

      if (aprovadosIds.length > 0) {
        const { error } = await supabase
          .from("colaboradores_lote")
          .update({
            status_seguradora: "aprovado",
            motivo_reprovacao_seguradora: null,
          })
          .in("id", aprovadosIds);
        if (error) throw error;
      }

      // 3. Calcular Totais para o Lote
      // O cálculo deve considerar o TOTAL do lote, menos os reprovados atuais
      const totalColaboradores = colaboradores.length;
      const totalReprovados = reprovadosArray.length;
      const totalAprovados = totalColaboradores - totalReprovados;

      // CORREÇÃO 2: Cálculo explícito do valor para evitar erro de 'null' no banco
      const valorTotalCalculado = totalAprovados * 50;

      // Determinar novo status
      const novoStatus = totalReprovados > 0 ? "com_pendencia" : "concluido";

      const { error: loteError } = await supabase
        .from("lotes_mensais")
        .update({
          status: novoStatus,
          total_aprovados: totalAprovados,
          total_reprovados: totalReprovados,
          // IMPORTANTE: Enviamos o valor calculado para satisfazer a constraint not-null das NFs
          valor_total: valorTotalCalculado,
          updated_at: new Date().toISOString(),
        })
        .eq("id", loteId);

      if (loteError) throw loteError;

      return { novoStatus, totalReprovados };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["lotes-operacional"] });
      // Invalida o cache dos colaboradores para recarregar os status novos se abrir de novo
      queryClient.invalidateQueries({ queryKey: ["colaboradores-lote", loteId] });

      toast.success(
        result.novoStatus === "concluido"
          ? "Lote aprovado e finalizado com sucesso!"
          : `Processado: ${result.totalReprovados} itens reprovados enviadas para pendência.`,
      );
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
    // Validar se todos os marcados como reprovados têm motivo
    for (const [, info] of reprovados) {
      if (!info.motivo.trim()) {
        toast.error("Informe o motivo para todos os colaboradores reprovados");
        return;
      }
    }
    processarMutation.mutate();
  };

  // Helper para mostrar status atual na tabela
  const getStatusBadge = (status: string | null) => {
    if (status === "aprovado")
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          Já Aprovado
        </Badge>
      );
    if (status === "reprovado")
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          Já Reprovado
        </Badge>
      );
    return <Badge variant="secondary">Pendente</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
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
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded text-sm flex gap-2 items-start">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Instruções:</p>
                <p>
                  Marque abaixo <strong>apenas</strong> os colaboradores REPROVADOS. Todos os desmarcados serão
                  considerados APROVADOS e o valor da fatura será calculado com base neles.
                </p>
              </div>
            </div>

            {reprovados.size > 0 && (
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border">
                <Input
                  placeholder="Motivo em lote (ex: Data incorreta)"
                  value={motivoEmLote}
                  onChange={(e) => setMotivoEmLote(e.target.value)}
                  className="flex-1 h-9"
                />
                <Button type="button" variant="secondary" size="sm" onClick={aplicarMotivoEmLote} className="shrink-0">
                  <Copy className="h-4 w-4 mr-1" />
                  Aplicar a todos
                </Button>
              </div>
            )}

            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">Reprovar</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Status Atual</TableHead>
                    <TableHead>Motivo da Reprovação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {colaboradores?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Nenhum colaborador encontrado neste lote.
                      </TableCell>
                    </TableRow>
                  ) : (
                    colaboradores?.map((colab) => (
                      <TableRow key={colab.id} className={reprovados.has(colab.id) ? "bg-red-50" : ""}>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={reprovados.has(colab.id)}
                            onCheckedChange={(checked) => toggleReprovado(colab.id, checked as boolean)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{colab.nome}</TableCell>
                        <TableCell>{colab.cpf}</TableCell>
                        <TableCell>{getStatusBadge(colab.status_seguradora)}</TableCell>
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
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Aprovado
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between text-sm border-t pt-4">
              <span>
                Total no Lote: <strong>{colaboradores?.length || 0}</strong>
              </span>
              <div className="flex gap-4 items-center">
                <div className="text-right">
                  <p className="text-muted-foreground text-xs">Valor Previsto:</p>
                  <p className="font-mono font-medium">R$ {((colaboradores?.length || 0) - reprovados.size) * 50},00</p>
                </div>
                <span className={reprovados.size > 0 ? "text-destructive font-bold" : "text-muted-foreground"}>
                  {reprovados.size} Reprovados
                </span>
                <span className="text-green-600 font-bold border-l pl-4">
                  {(colaboradores?.length || 0) - reprovados.size} Aprovados
                </span>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleProcessar}
            disabled={processarMutation.isPending || isLoading || colaboradores?.length === 0}
            className={reprovados.size === 0 ? "bg-green-600 hover:bg-green-700" : "bg-primary"}
          >
            {processarMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {reprovados.size === 0 ? "Aprovar Tudo e Finalizar" : "Confirmar Processamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
