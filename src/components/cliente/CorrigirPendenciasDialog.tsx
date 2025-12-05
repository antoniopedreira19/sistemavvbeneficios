import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, Edit2, Save, X, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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
        .select("id, nome, cpf, data_nascimento, sexo, salario, motivo_reprovacao_seguradora, tentativa_reenvio")
        .eq("lote_id", loteId)
        .eq("status_seguradora", "reprovado")
        .order("nome");

      if (error) throw error;
      return data as ColaboradorReprovado[];
    },
    enabled: open && !!loteId,
  });

  // Mutation para salvar edição de um colaborador
  const editMutation = useMutation({
    mutationFn: async (colaborador: Partial<ColaboradorReprovado> & { id: string }) => {
      const { error } = await supabase
        .from("colaboradores_lote")
        .update({
          nome: colaborador.nome,
          cpf: colaborador.cpf,
          data_nascimento: colaborador.data_nascimento,
          sexo: colaborador.sexo,
          salario: colaborador.salario,
          updated_at: new Date().toISOString(),
        })
        .eq("id", colaborador.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dados atualizados com sucesso");
      queryClient.invalidateQueries({ queryKey: ["colaboradores-reprovados", loteId] });
      setEditingId(null);
      setEditForm({});
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

      // 1. Atualiza os ITENS (Colaboradores)
      // CORREÇÃO 1: Muda para 'pendente' (o banco aceita), não 'enviado' (o banco rejeita)
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

      // 2. Atualiza o LOTE para o NOVO STATUS DE REANÁLISE
      // CORREÇÃO 2: Muda para 'aguardando_reanalise' para cair na aba certa do Admin
      const { error: loteError } = await supabase
        .from("lotes_mensais")
        .update({
          status: "aguardando_reanalise",
          updated_at: new Date().toISOString(),
        })
        .eq("id", loteId);

      if (loteError) throw loteError;

      return { totalReenviados: reprovados.length };
    },
    onSuccess: (data) => {
      toast.success(`${data.totalReenviados} colaborador(es) enviados para reanálise.`);
      queryClient.invalidateQueries({ queryKey: ["colaboradores-reprovados", loteId] });
      queryClient.invalidateQueries({ queryKey: ["lotes"] });
      queryClient.invalidateQueries({ queryKey: ["lotes-operacional"] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Erro ao reenviar: " + error.message);
    },
  });

  const startEditing = (colaborador: ColaboradorReprovado) => {
    setEditingId(colaborador.id);
    setEditForm({
      nome: colaborador.nome,
      cpf: colaborador.cpf,
      data_nascimento: colaborador.data_nascimento,
      sexo: colaborador.sexo,
      salario: colaborador.salario,
    });
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
              {reprovados.map((colaborador) => (
                <div key={colaborador.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="font-medium">{editingId === colaborador.id ? "Editando..." : colaborador.nome}</div>
                    {editingId === colaborador.id ? (
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={cancelEditing}>
                          <X className="h-4 w-4" />
                        </Button>
                        <Button size="sm" onClick={saveEditing} disabled={editMutation.isPending}>
                          <Save className="h-4 w-4 mr-1" /> Salvar
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => startEditing(colaborador)}>
                        <Edit2 className="h-4 w-4 mr-1" /> Editar
                      </Button>
                    )}
                  </div>

                  {colaborador.motivo_reprovacao_seguradora && (
                    <div className="bg-red-50 text-red-700 text-sm p-2 rounded">
                      Motivo: {colaborador.motivo_reprovacao_seguradora}
                    </div>
                  )}

                  {editingId === colaborador.id ? (
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
                      <div>CPF: {colaborador.cpf}</div>
                      <div>Salário: R$ {colaborador.salario}</div>
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
