import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Trash2, Building } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface GerenciarObrasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaId: string;
}

export function GerenciarObrasDialog({ open, onOpenChange, empresaId }: GerenciarObrasDialogProps) {
  const queryClient = useQueryClient();
  const [novaObraNome, setNovaObraNome] = useState("");
  const [creating, setCreating] = useState(false);

  // Busca obras existentes
  const { data: obras = [], isLoading } = useQuery({
    queryKey: ["obras", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obras")
        .select("id, nome, status")
        .eq("empresa_id", empresaId)
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: open && !!empresaId,
  });

  // Criar Obra
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!novaObraNome.trim()) throw new Error("Nome é obrigatório");
      
      const { error } = await supabase
        .from("obras")
        .insert({
          nome: novaObraNome.trim(),
          empresa_id: empresaId,
          status: "ativa"
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["obras"] });
      setNovaObraNome("");
      toast.success("Obra adicionada com sucesso!");
    },
    onError: (error: any) => {
      toast.error(error.message);
    }
  });

  // Remover Obra
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("obras")
        .delete()
        .eq("id", id);
      
      if (error) {
        // Se for erro de chave estrangeira (FK), avisar amigavelmente
        if (error.code === '23503') throw new Error("Não é possível excluir esta obra pois existem colaboradores vinculados a ela.");
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["obras"] });
      toast.success("Obra removida!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao excluir obra");
    }
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    await createMutation.mutateAsync();
    setCreating(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className="h-5 w-5 text-primary" />
            Gerenciar Obras
          </DialogTitle>
          <DialogDescription>
            Adicione novas obras ou remova as que não são mais necessárias.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          
          {/* Formulário de Criação */}
          <form onSubmit={handleCreate} className="flex gap-2 items-end bg-muted/30 p-3 rounded-lg border">
            <div className="flex-1 space-y-1">
              <Label htmlFor="novaObra" className="text-xs">Nova Obra</Label>
              <Input 
                id="novaObra"
                placeholder="Ex: Residencial Jardins" 
                value={novaObraNome}
                onChange={(e) => setNovaObraNome(e.target.value)}
                className="bg-white"
              />
            </div>
            <Button type="submit" disabled={creating || !novaObraNome.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </form>

          {/* Lista de Obras */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Obras Cadastradas</h4>
            <ScrollArea className="h-[200px] pr-4">
              {isLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="animate-spin h-5 w-5 text-muted-foreground"/></div>
              ) : obras.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                  Nenhuma obra cadastrada.
                </div>
              ) : (
                <div className="space-y-2">
                  {obras.map((obra) => (
                    <div key={obra.id} className="flex items-center justify-between p-3 bg-white border rounded-md shadow-sm group">
                      <span className="font-medium text-sm">{obra.nome}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => deleteMutation.mutate(obra.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
