import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const obraSchema = z.object({
  nome: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  status: z.enum(["ativa", "inativa"]).default("ativa"),
});

type ObraFormData = z.infer<typeof obraSchema>;

interface NovaObraDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaId: string;
  onSuccess?: () => void;
}

export function NovaObraDialog({ open, onOpenChange, empresaId, onSuccess }: NovaObraDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<ObraFormData>({
    resolver: zodResolver(obraSchema),
    defaultValues: {
      nome: "",
      status: "ativa",
    },
  });

  const onSubmit = async (data: ObraFormData) => {
    if (!empresaId) return;
    setLoading(true);

    try {
      const { error } = await supabase.from("obras").insert({
        nome: data.nome,
        status: data.status,
        empresa_id: empresaId,
      });

      if (error) throw error;

      toast({
        title: "Obra criada!",
        description: "A obra foi cadastrada com sucesso.",
      });

      form.reset();
      onOpenChange(false); // Fecha o modal
      onSuccess?.(); // Atualiza a lista
    } catch (error: any) {
      toast({
        title: "Erro ao criar obra",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Nova Obra</DialogTitle>
          <DialogDescription>Cadastre uma nova obra ou centro de custo para alocar colaboradores.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Obra</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Residencial Flores" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Criar Obra
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
