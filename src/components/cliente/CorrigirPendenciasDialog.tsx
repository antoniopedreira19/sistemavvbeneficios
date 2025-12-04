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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, AlertTriangle, CheckCircle2, Send, Pencil } from "lucide-react";

interface CorrigirPendenciasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loteId: string;
  obraNome: string;
  competencia: string;
}

interface ColaboradorReprovado {
  id: string;
  nome: string;
  cpf: string;
  data_nascimento: string;
  sexo: string | null;
  salario: number;
  motivo_reprovacao_seguradora: string | null;
  status_seguradora: string | null;
  tentativa_reenvio: number;
}

export function CorrigirPendenciasDialog({
  open,
  onOpenChange,
  loteId,
  obraNome,
  competencia,
}: CorrigirPendenciasDialogProps) {
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState<string | null>(null);
  const [dadosEdicao, setDadosEdicao] = useState<Partial<ColaboradorReprovado>>({});

  // Buscar colaboradores reprovados do lote
  const { data: reprovados, isLoading } = useQuery({
    queryKey: ["colaboradores-reprovados", loteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaboradores_lote")
        .select("*")
        .eq("lote_id", loteId)
        .eq("status_seguradora", "reprovado")
        .order("nome");

      if (error) throw error;
      return data as ColaboradorReprovado[];
    },
    enabled: open,
  });

  // Buscar colaboradores aprovados para mostrar resumo
  const { data: aprovados } = useQuery({
    queryKey: ["colaboradores-aprovados", loteId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("colaboradores_lote")
        .select("*", { count: "exact", head: true })
        .eq("lote_id", loteId)
        .eq("status_seguradora", "aprovado");

      if (error) throw error;
      return count || 0;
    },
    enabled: open,
  });

  // Mutation para salvar edição
  const salvarEdicaoMutation = useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: Partial<ColaboradorReprovado> }) => {
      const { error } = await supabase
        .from("colaboradores_lote")
        .update({
          nome: dados.nome,
          cpf: dados.cpf,
          data_nascimento: dados.data_nascimento,
          sexo: dados.sexo,
          salario: dados.salario,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dados atualizados");
      setEditando(null);
      setDadosEdicao({});
      queryClient.invalidateQueries({ queryKey: ["colaboradores-reprovados", loteId] });
    },
    onError: (error) => {
      console.error(error);
      toast.error("Erro ao salvar alterações");
    },
  });

  // Mutation para reenviar para análise
  const reenviarMutation = useMutation({
    mutationFn: async () => {
      if (!reprovados || reprovados.length === 0) {
        throw new Error("Nenhum colaborador para reenviar");
      }

      // Calcular próxima tentativa
      const maxTentativa = Math.max(...reprovados.map(r => r.tentativa_reenvio));
      const novaTentativa = maxTentativa + 1;

      // Atualizar status dos reprovados para pendente (nova tentativa)
      const { error: updateError } = await supabase
        .from("colaboradores_lote")
        .update({
          status_seguradora: "pendente",
          tentativa_reenvio: novaTentativa,
          data_tentativa: new Date().toISOString(),
          motivo_reprovacao_seguradora: null,
          updated_at: new Date().toISOString(),
        })
        .eq("lote_id", loteId)
        .eq("status_seguradora", "reprovado");

      if (updateError) throw updateError;

      // Atualizar status do lote para aguardando_processamento
      const { error: loteError } = await supabase
        .from("lotes_mensais")
        .update({
          status: "aguardando_processamento",
          updated_at: new Date().toISOString(),
        })
        .eq("id", loteId);

      if (loteError) throw loteError;

      return { totalReenviados: reprovados.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["colaboradores-reprovados"] });
      queryClient.invalidateQueries({ queryKey: ["lotes-atuais"] });
      queryClient.invalidateQueries({ queryKey: ["historico-lotes"] });
      toast.success(`${result.totalReenviados} colaborador(es) reenviado(s) para análise`);
      onOpenChange(false);
    },
    onError: (error) => {
      console.error(error);
      toast.error("Erro ao reenviar para análise");
    },
  });

  const iniciarEdicao = (colab: ColaboradorReprovado) => {
    setEditando(colab.id);
    setDadosEdicao({
      nome: colab.nome,
      cpf: colab.cpf,
      data_nascimento: colab.data_nascimento,
      sexo: colab.sexo,
      salario: colab.salario,
    });
  };

  const cancelarEdicao = () => {
    setEditando(null);
    setDadosEdicao({});
  };

  const salvarEdicao = (id: string) => {
    salvarEdicaoMutation.mutate({ id, dados: dadosEdicao });
  };

  const formatCPF = (cpf: string) => {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            Pendências - {obraNome}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {competencia} • Corrija os dados e reenvie para análise
          </p>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Resumo */}
            <div className="flex gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm">
                  <strong className="text-green-600">{aprovados}</strong> aprovado(s)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span className="text-sm">
                  <strong className="text-red-600">{reprovados?.length || 0}</strong> reprovado(s)
                </span>
              </div>
            </div>

            {/* Lista de Reprovados */}
            {reprovados && reprovados.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Nascimento</TableHead>
                    <TableHead>Sexo</TableHead>
                    <TableHead className="text-right">Salário</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reprovados.map((colab) => (
                    <TableRow key={colab.id}>
                      {editando === colab.id ? (
                        <>
                          <TableCell>
                            <Input
                              value={dadosEdicao.nome || ""}
                              onChange={(e) => setDadosEdicao({ ...dadosEdicao, nome: e.target.value })}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={dadosEdicao.cpf || ""}
                              onChange={(e) => setDadosEdicao({ ...dadosEdicao, cpf: e.target.value.replace(/\D/g, "") })}
                              className="h-8"
                              maxLength={11}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              value={dadosEdicao.data_nascimento || ""}
                              onChange={(e) => setDadosEdicao({ ...dadosEdicao, data_nascimento: e.target.value })}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={dadosEdicao.sexo || ""}
                              onValueChange={(v) => setDadosEdicao({ ...dadosEdicao, sexo: v })}
                            >
                              <SelectTrigger className="h-8 w-20">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="M">M</SelectItem>
                                <SelectItem value="F">F</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={dadosEdicao.salario || ""}
                              onChange={(e) => setDadosEdicao({ ...dadosEdicao, salario: parseFloat(e.target.value) })}
                              className="h-8 text-right"
                            />
                          </TableCell>
                          <TableCell>
                            <Badge variant="destructive" className="text-xs">
                              {colab.motivo_reprovacao_seguradora || "Sem motivo"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => salvarEdicao(colab.id)}
                                disabled={salvarEdicaoMutation.isPending}
                              >
                                {salvarEdicaoMutation.isPending ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="h-3 w-3" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={cancelarEdicao}
                              >
                                ✕
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="font-medium">{colab.nome}</TableCell>
                          <TableCell>{formatCPF(colab.cpf)}</TableCell>
                          <TableCell>{colab.data_nascimento}</TableCell>
                          <TableCell>{colab.sexo || "-"}</TableCell>
                          <TableCell className="text-right">
                            {colab.salario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="destructive" className="text-xs">
                              {colab.motivo_reprovacao_seguradora || "Sem motivo"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => iniciarEdicao(colab)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma pendência encontrada.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button
            onClick={() => reenviarMutation.mutate()}
            disabled={reenviarMutation.isPending || isLoading || !reprovados?.length}
            className="gap-2"
          >
            {reenviarMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Reenviar para Análise
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
