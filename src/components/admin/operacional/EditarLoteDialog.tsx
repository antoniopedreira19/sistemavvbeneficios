import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Trash2, Plus, Save, X, Pencil } from "lucide-react";
import { toast } from "sonner";
import { formatCPF } from "@/lib/validators";
import { LoteOperacional } from "./LotesTable";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface EditarLoteDialogProps {
  lote: LoteOperacional;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditarLoteDialog({ lote, open, onOpenChange }: EditarLoteDialogProps) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const [formData, setFormData] = useState({
    nome: "",
    cpf: "",
    sexo: "Masculino",
    data_nascimento: "",
    salario: "",
    classificacao_salario: "Ajudante Comum",
  });

  const { data: itens = [], isLoading } = useQuery({
    queryKey: ["itens-lote", lote.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaboradores_lote")
        .select("*")
        .eq("lote_id", lote.id)
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const resetForm = () => {
    setFormData({
      nome: "",
      cpf: "",
      sexo: "Masculino",
      data_nascimento: "",
      salario: "",
      classificacao_salario: "Ajudante Comum",
    });
    setEditingId(null);
    setIsAdding(false);
  };

  const handleEditClick = (item: any) => {
    setEditingId(item.id);
    setFormData({
      nome: item.nome,
      cpf: item.cpf,
      sexo: item.sexo || "Masculino",
      data_nascimento: item.data_nascimento || "",
      salario: item.salario?.toString() || "0",
      classificacao_salario: item.classificacao_salario || "Ajudante Comum",
    });
    setIsAdding(true);
  };

  const upsertItemMutation = useMutation({
    mutationFn: async () => {
      if (!formData.nome || !formData.cpf) throw new Error("Nome e CPF obrigatórios");
      const cpfLimpo = formData.cpf.replace(/\D/g, "");

      const { data: masterData, error: masterError } = await supabase
        .from("colaboradores")
        .upsert(
          {
            empresa_id: lote.empresa_id,
            obra_id: lote.obra?.id,
            nome: formData.nome.toUpperCase(),
            cpf: cpfLimpo,
            sexo: formData.sexo,
            data_nascimento: formData.data_nascimento,
            salario: parseFloat(formData.salario),
            classificacao_salario: formData.classificacao_salario,
            status: "ativo",
          },
          { onConflict: "empresa_id, cpf" },
        )
        .select("id")
        .single();

      if (masterError) throw masterError;

      // Cast para any para evitar erro de TS se a inferência falhar
      const colaboradorId = (masterData as any).id;

      if (editingId) {
        const { error } = await supabase
          .from("colaboradores_lote")
          .update({
            nome: formData.nome.toUpperCase(),
            cpf: cpfLimpo,
            sexo: formData.sexo,
            data_nascimento: formData.data_nascimento,
            salario: parseFloat(formData.salario),
            classificacao_salario: formData.classificacao_salario,
            colaborador_id: colaboradorId,
          })
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("colaboradores_lote").insert({
          lote_id: lote.id,
          colaborador_id: colaboradorId,
          nome: formData.nome.toUpperCase(),
          cpf: cpfLimpo,
          sexo: formData.sexo,
          data_nascimento: formData.data_nascimento,
          salario: parseFloat(formData.salario),
          classificacao_salario: formData.classificacao_salario,
          status_seguradora: "aprovado",
        });
        if (error) throw error;
      }
      await atualizarTotaisLote();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["itens-lote", lote.id] });
      toast.success(editingId ? "Colaborador atualizado" : "Colaborador adicionado");
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("colaboradores_lote").delete().eq("id", id);
      if (error) throw error;
      await atualizarTotaisLote();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["itens-lote", lote.id] });
      toast.success("Colaborador removido");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteLoteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("lotes_mensais").delete().eq("id", lote.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lotes-operacional"] });
      toast.success("Lote excluído");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const atualizarTotaisLote = async () => {
    const { count, error } = await supabase
      .from("colaboradores_lote")
      .select("*", { count: "exact", head: true })
      .eq("lote_id", lote.id);
    if (error) return;
    const novoTotal = count || 0;
    const novoValor = novoTotal * 50;
    await supabase
      .from("lotes_mensais")
      .update({ total_colaboradores: novoTotal, total_aprovados: novoTotal, valor_total: novoValor })
      .eq("id", lote.id);
    queryClient.invalidateQueries({ queryKey: ["lotes-operacional"] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Editar Lote: {lote.empresa?.nome}</DialogTitle>
          <DialogDescription>
            Competência: {lote.competencia} | Total: {itens.length} colaboradores
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 space-y-4 py-4">
          {!isAdding ? (
            <div className="flex justify-between items-center bg-muted/30 p-2 rounded-lg">
              <span className="text-sm font-medium ml-2">Lista de Colaboradores</span>
              <Button size="sm" onClick={() => setIsAdding(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Adicionar Colaborador
              </Button>
            </div>
          ) : (
            <div className="bg-muted/40 p-4 rounded-lg border space-y-4 animate-in fade-in">
              <div className="flex justify-between items-center">
                <h4 className="font-semibold text-sm">{editingId ? "Editar" : "Novo"}</h4>
                <Button variant="ghost" size="sm" onClick={resetForm}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label>Nome</Label>
                  <Input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>CPF</Label>
                  <Input
                    value={formData.cpf}
                    onChange={(e) => setFormData({ ...formData, cpf: formatCPF(e.target.value) })}
                    maxLength={14}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Nascimento</Label>
                  <Input
                    type="date"
                    value={formData.data_nascimento}
                    onChange={(e) => setFormData({ ...formData, data_nascimento: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Sexo</Label>
                  <Select value={formData.sexo} onValueChange={(v) => setFormData({ ...formData, sexo: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Masculino">Masculino</SelectItem>
                      <SelectItem value="Feminino">Feminino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Salário</Label>
                  <Input
                    type="number"
                    value={formData.salario}
                    onChange={(e) => setFormData({ ...formData, salario: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Cargo</Label>
                  <Input
                    value={formData.classificacao_salario}
                    onChange={(e) => setFormData({ ...formData, classificacao_salario: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button onClick={() => upsertItemMutation.mutate()} disabled={upsertItemMutation.isPending}>
                  {upsertItemMutation.isPending ? (
                    <Loader2 className="animate-spin mr-2" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}{" "}
                  Salvar
                </Button>
              </div>
            </div>
          )}

          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Nascimento</TableHead>
                  <TableHead>Salário</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Loader2 className="animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : (
                  itens.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.nome}</TableCell>
                      <TableCell>{formatCPF(item.cpf)}</TableCell>
                      <TableCell>
                        {item.data_nascimento ? new Date(item.data_nascimento).toLocaleDateString("pt-BR") : "-"}
                      </TableCell>
                      <TableCell>R$ {item.salario?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEditClick(item)}>
                            <Pencil className="h-4 w-4 text-blue-500" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir?</AlertDialogTitle>
                                <AlertDialogDescription>Remover este colaborador do lote?</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteItemMutation.mutate(item.id)}
                                  className="bg-red-600"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter className="justify-between border-t pt-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="gap-2">
                <Trash2 className="h-4 w-4" /> Excluir Lote
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir Lote?</AlertDialogTitle>
                <AlertDialogDescription>Isso apagará o lote e todos os itens.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteLoteMutation.mutate()} className="bg-red-600">
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
