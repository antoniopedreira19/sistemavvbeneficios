import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
      // Buscar apenas colaboradores com status "enviado" (aguardando resposta da seguradora)
      const { data, error } = await supabase
        .from("colaboradores_lote")
        .select("id, nome, cpf, status_seguradora")
        .eq("lote_id", loteId)
        .eq("status_seguradora", "enviado")
        .order("nome");

      if (error) throw error;
      return data as ColaboradorLote[];
    },
    enabled: open,
  });

  const processarMutation = useMutation({
    mutationFn: async () => {
      const reprovadosArray = Array.from(reprovados.entries());
      
      // Update reprovados
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

      // Update aprovados (todos que não estão na lista de reprovados)
      const reprovadosIds = Array.from(reprovados.keys());
      if (colaboradores) {
        const aprovadosIds = colaboradores
          .filter((c) => !reprovadosIds.includes(c.id))
          .map((c) => c.id);

        if (aprovadosIds.length > 0) {
          const { error } = await supabase
            .from("colaboradores_lote")
            .update({ status_seguradora: "aprovado" })
            .in("id", aprovadosIds);
          if (error) throw error;
        }
      }

      // Determinar novo status do lote
      const novoStatus = reprovadosArray.length > 0 ? "com_pendencia" : "concluido";
      const totalAprovados = colaboradores ? colaboradores.length - reprovadosArray.length : 0;
      const valorTotal = totalAprovados * 50; // R$ 50 por vida
      
      const { error: loteError } = await supabase
        .from("lotes_mensais")
        .update({
          status: novoStatus,
          total_aprovados: totalAprovados,
          total_reprovados: reprovadosArray.length,
          valor_total: valorTotal,
        })
        .eq("id", loteId);

      if (loteError) throw loteError;

      return { novoStatus, totalReprovados: reprovadosArray.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["lotes-operacional"] });
      toast.success(
        result.novoStatus === "concluido"
          ? "Lote aprovado com sucesso!"
          : `Lote processado com ${result.totalReprovados} reprovação(ões)`
      );
      setReprovados(new Map());
      onOpenChange(false);
    },
    onError: (error) => {
      console.error(error);
      toast.error("Erro ao processar retorno");
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
    // Validar que todos reprovados têm motivo
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
            <p className="text-sm">
              Marque os colaboradores que foram <strong>reprovados</strong> pela seguradora:
            </p>

            {reprovados.size > 0 && (
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border">
                <Input
                  placeholder="Motivo em lote..."
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
                  Aplicar a {reprovados.size} selecionado(s)
                </Button>
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Repr.</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Motivo da Reprovação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {colaboradores?.map((colab) => (
                  <TableRow key={colab.id}>
                    <TableCell>
                      <Checkbox
                        checked={reprovados.has(colab.id)}
                        onCheckedChange={(checked) =>
                          toggleReprovado(colab.id, checked as boolean)
                        }
                      />
                    </TableCell>
                    <TableCell className="font-medium">{colab.nome}</TableCell>
                    <TableCell>{colab.cpf}</TableCell>
                    <TableCell>
                      {reprovados.has(colab.id) && (
                        <Input
                          placeholder="Motivo..."
                          value={reprovados.get(colab.id)?.motivo || ""}
                          onChange={(e) => updateMotivo(colab.id, e.target.value)}
                          className="h-8"
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between text-sm border-t pt-4">
              <span>
                Total: {colaboradores?.length || 0} colaboradores
              </span>
              <span className={reprovados.size > 0 ? "text-destructive font-medium" : "text-green-600 font-medium"}>
                {reprovados.size > 0
                  ? `${reprovados.size} reprovado(s)`
                  : "Todos aprovados"}
              </span>
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
          >
            {processarMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Confirmar Processamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
