import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, AlertCircle, Edit2, Save, X, Send } from "lucide-react";

interface CorrigirPendenciasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loteId: string | null;
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ColaboradorReprovado>>({});

  // Buscar colaboradores reprovados do lote
  const { data: reprovados, isLoading } = useQuery({
    queryKey: ["colaboradores-reprovados", loteId],
    queryFn: async () => {
      if (!loteId) return [];
      const { data, error } = await supabase
        .from("colaboradores_lote")
        .select("*")
        .eq("lote_id", loteId)
        .eq("status_seguradora", "reprovado")
        .order("nome");

      if (error) throw error;
      return data as ColaboradorReprovado[];
    },
    enabled: open && !!loteId,
  });

  // Mutation para salvar edição
  const editMutation = useMutation({
    mutationFn: async ({ id, ...dados }: Partial<ColaboradorReprovado> & { id: string }) => {
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
      setEditingId(null);
      setEditForm({});
      queryClient.invalidateQueries({ queryKey: ["colaboradores-reprovados", loteId] });
    },
    onError: (error) => {
      toast.error("Erro ao salvar: " + error.message);
    },
  });

  // Mutation para reenviar para análise
  const reenviarMutation = useMutation({
    mutationFn: async () => {
      if (!reprovados || reprovados.length === 0) {
        throw new Error("Nenhum colaborador para reenviar");
      }

      // Calcular próxima tentativa
      const maxTentativa = Math.max(...reprovados.map((r) => r.tentativa_reenvio || 0));
      const novaTentativa = maxTentativa + 1;

      // 1. Atualizar status dos ITENS (Colaboradores)
      // CORREÇÃO CRÍTICA: Status volta para 'pendente' (o banco aceita), e NÃO 'enviado'
      const { error: updateError } = await supabase
        .from("colaboradores_lote")
        .update({
          status_seguradora: "pendente",
          tentativa_reenvio: novaTentativa,
          data_tentativa: new Date().toISOString(),
          motivo_reprovacao_seguradora: null, // Limpa o motivo da reprovação anterior
          updated_at: new Date().toISOString(),
        })
        .eq("lote_id", loteId)
        .eq("status_seguradora", "reprovado");

      if (updateError) throw updateError;

      // 2. Atualizar status do LOTE para o NOVO STATUS DE REANÁLISE
      const { error: loteError } = await supabase
        .from("lotes_mensais")
        .update({
          status: "aguardando_reanalise", // Envia para a aba Reanálise do Admin
          updated_at: new Date().toISOString(),
        })
        .eq("id", loteId);

      if (loteError) throw loteError;

      return { totalReenviados: reprovados.length };
    },
    onSuccess: (data) => {
      toast.success(`${data.totalReenviados} colaborador(es) enviados para reanálise.`);
      queryClient.invalidateQueries({ queryKey: ["colaboradores-reprovados", loteId] });
      queryClient.invalidateQueries({ queryKey: ["lotes"] }); // Atualiza listas do cliente
      queryClient.invalidateQueries({ queryKey: ["lotes-operacional"] }); // Atualiza Admin se estiver aberto
      onOpenChange(false);
    },
    onError: (error) => {
      console.error(error);
      toast.error("Erro ao reenviar: " + error.message);
    },
  });

  const startEditing = (colaborador: ColaboradorReprovado) => {
    setEditingId(colaborador.id);
    setEditForm({ ...colaborador });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEditing = () => {
    if (editingId) {
      editMutation.mutate({ id: editingId, ...editForm });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Corrigir Pendências
          </DialogTitle>
          <DialogDescription>
            {obraNome} - {competencia}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[400px] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin" />
            </div>
          ) : reprovados && reprovados.length > 0 ? (
            <div className="space-y-4">
              {reprovados.map((colab) => (
                <div key={colab.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="font-medium">{editingId === colab.id ? "Editando..." : colab.nome}</div>
                    {editingId === colab.id ? (
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={cancelEditing}>
                          <X className="h-4 w-4" />
                        </Button>
                        <Button size="sm" onClick={saveEditing} disabled={editMutation.isPending}>
                          <Save className="h-4 w-4 mr-1" /> Salvar
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => startEditing(colab)}>
                        <Edit2 className="h-4 w-4 mr-1" /> Editar
                      </Button>
                    )}
                  </div>

                  {colab.motivo_reprovacao_seguradora && (
                    <div className="bg-red-50 text-red-700 text-sm p-2 rounded">
                      Motivo: {colab.motivo_reprovacao_seguradora}
                    </div>
                  )}

                  {editingId === colab.id ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Nome</Label>
                        <Input
                          value={editForm.nome}
                          onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>CPF</Label>
                        <Input
                          value={editForm.cpf}
                          onChange={(e) => setEditForm({ ...editForm, cpf: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Nascimento</Label>
                        <Input
                          type="date"
                          value={editForm.data_nascimento}
                          onChange={(e) => setEditForm({ ...editForm, data_nascimento: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Salário</Label>
                        <Input
                          type="number"
                          value={editForm.salario}
                          onChange={(e) => setEditForm({ ...editForm, salario: parseFloat(e.target.value) })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Sexo</Label>
                        <Select
                          value={editForm.sexo || ""}
                          onValueChange={(value) => setEditForm({ ...editForm, sexo: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="M">Masculino</SelectItem>
                            <SelectItem value="F">Feminino</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground grid grid-cols-2 gap-2">
                      <div>CPF: {colab.cpf}</div>
                      <div>Salário: R$ {colab.salario}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">Nenhuma pendência encontrada.</p>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => reenviarMutation.mutate()}
            disabled={reenviarMutation.isPending || !reprovados?.length}
          >
            {reenviarMutation.isPending ? <Loader2 className="animate-spin mr-2" /> : <Send className="mr-2 h-4 w-4" />}
            Reenviar Correções
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
