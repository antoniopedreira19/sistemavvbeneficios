import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Copy } from "lucide-react";

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
        .select("id, nome, cpf, status_seguradora")
        .eq("lote_id", loteId)
        .order("nome");

      if (error) throw error;
      return data as ColaboradorLote[];
    },
    enabled: open,
  });

  const processarMutation = useMutation({
    mutationFn: async () => {
      if (!colaboradores) throw new Error("Dados dos colaboradores não carregados.");

      const reprovadosArray = Array.from(reprovados.entries());

      // 1. Atualizar REPROVADOS
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

      // 2. Atualizar APROVADOS (Todos que NÃO estão na lista de reprovados)
      const reprovadosIds = Array.from(reprovados.keys());
      const aprovadosIds = colaboradores.filter((c) => !reprovadosIds.includes(c.id)).map((c) => c.id);

      if (aprovadosIds.length > 0) {
        const { error } = await supabase
          .from("colaboradores_lote")
          // Importante: Limpar o motivo se foi aprovado (caso fosse um reenvio corrigido)
          .update({
            status_seguradora: "aprovado",
            motivo_reprovacao_seguradora: null,
          })
          .in("id", aprovadosIds);

        if (error) throw error;
      }

      // 3. Atualizar Status do LOTE
      const novoStatus = reprovadosArray.length > 0 ? "com_pendencia" : "concluido";
      const totalAprovados = colaboradores.length - reprovadosArray.length;

      const { error: loteError } = await supabase
        .from("lotes_mensais")
        .update({
          status: novoStatus,
          total_aprovados: totalAprovados,
          total_reprovados: reprovadosArray.length,
        })
        .eq("id", loteId);

      if (loteError) throw loteError;

      return { novoStatus, totalReprovados: reprovadosArray.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["lotes-operacional"] });
      // Também invalidamos a lista de colaboradores para garantir dados frescos na próxima abertura
      queryClient.invalidateQueries({ queryKey: ["colaboradores-lote", loteId] });

      toast.success(
        result.novoStatus === "concluido"
          ? "Lote aprovado com sucesso! Pronto para faturamento."
          : `Processado: ${result.totalReprovados} colaborador(es) reprovado(s).`,
      );
      setReprovados(new Map());
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error("Erro no processamento:", error);
      // Mostra a mensagem real do erro para facilitar o debug
      toast.error(`Erro ao processar: ${error.message || "Erro desconhecido no banco de dados."}`);
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
            <div className="bg-blue-50 p-3 rounded-md border border-blue-100 text-sm text-blue-700">
              <p>
                Marque abaixo <strong>apenas</strong> os colaboradores REPROVADOS. Os desmarcados serão considerados{" "}
                <strong>APROVADOS</strong>.
              </p>
            </div>

            {reprovados.size > 0 && (
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border">
                <Input
                  placeholder="Motivo em lote (ex: Data de nascimento divergente)"
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
                    <TableHead>Motivo da Reprovação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {colaboradores?.map((colab) => (
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
                            autoFocus
                          />
                        ) : (
                          <span className="text-xs text-green-600 font-medium flex items-center">
                            <CheckCircle className="w-3 h-3 mr-1" /> Aprovado
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between text-sm border-t pt-4">
              <span>
                Total: <strong>{colaboradores?.length || 0}</strong> colaboradores
              </span>
              <div className="flex gap-4">
                <span className="text-green-600 font-bold">
                  {colaboradores ? colaboradores.length - reprovados.size : 0} Aprovados
                </span>
                <span className={reprovados.size > 0 ? "text-destructive font-bold" : "text-muted-foreground"}>
                  {reprovados.size} Reprovados
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
            disabled={processarMutation.isPending || isLoading}
            className={reprovados.size === 0 ? "bg-green-600 hover:bg-green-700" : "bg-primary"}
          >
            {processarMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {reprovados.size === 0 ? "Aprovar Todo o Lote" : "Confirmar Processamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Ícone auxiliar para o badge de aprovado
function CheckCircle({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
