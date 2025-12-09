import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { validateCPF, formatCPF } from "@/lib/validators";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

// Schema de validação
const colaboradorSchema = z.object({
  nome: z.string().min(3, "Nome completo é obrigatório"),
  cpf: z.string().refine(validateCPF, "CPF inválido"),
  sexo: z.string().min(1, "Selecione o sexo"),
  data_nascimento: z.string().min(1, "Data de nascimento é obrigatória"),
  salario: z.coerce.number().min(1, "Salário é obrigatório"),
  obra_id: z.string().optional(), // Pode ser nulo se for administrativo geral
});

type ColaboradorFormData = z.infer<typeof colaboradorSchema>;

interface NovoColaboradorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaId: string;
  obras: { id: string; nome: string }[];
  onSuccess?: () => void;
}

const CLASSIFICACOES_SALARIO = [
  { label: "Ajudante Comum", minimo: 1454.2 },
  { label: "Ajudante Prático/Meio-Oficial", minimo: 1476.2 },
  { label: "Oficial", minimo: 2378.34 },
  { label: "Op. Qualificado I", minimo: 2637.8 },
  { label: "Op. Qualificado II", minimo: 3262.6 },
  { label: "Op. Qualificado III", minimo: 4037.0 },
];

export function NovoColaboradorDialog({ open, onOpenChange, empresaId, obras, onSuccess }: NovoColaboradorDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<ColaboradorFormData>({
    resolver: zodResolver(colaboradorSchema),
    defaultValues: {
      nome: "",
      cpf: "",
      sexo: "",
      data_nascimento: "",
      salario: 0,
      obra_id: "",
    },
  });

  const calcularClassificacao = (salario: number) => {
    if (salario < CLASSIFICACOES_SALARIO[0].minimo) return CLASSIFICACOES_SALARIO[0].label;
    const item = [...CLASSIFICACOES_SALARIO].reverse().find((c) => salario >= c.minimo);
    return item?.label || CLASSIFICACOES_SALARIO[0].label;
  };

  const onSubmit = async (data: ColaboradorFormData) => {
    if (!empresaId) return;
    setLoading(true);

    try {
      const classificacao = calcularClassificacao(data.salario);
      const cpfLimpo = data.cpf.replace(/\D/g, "");

      const { error } = await supabase.from("colaboradores").insert({
        nome: data.nome,
        cpf: cpfLimpo,
        sexo: data.sexo,
        data_nascimento: data.data_nascimento,
        salario: data.salario,
        classificacao_salario: classificacao,
        obra_id: data.obra_id || null,
        empresa_id: empresaId,
        status: "ativo",
        classificacao: "CLT", // Padrão
        aposentado: false,
        afastado: false,
      });

      if (error) throw error;

      toast({
        title: "Colaborador adicionado!",
        description: `Classificado como ${classificacao}`,
      });

      form.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      // Tratamento de erro de CPF duplicado (comum)
      if (error.code === "23505") {
        toast({ title: "Erro", description: "Este CPF já está cadastrado nesta empresa.", variant: "destructive" });
      } else {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Novo Colaborador</DialogTitle>
          <DialogDescription>Adicione um funcionário manualmente à base ativa.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome do funcionário" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cpf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="000.000.000-00"
                        {...field}
                        onChange={(e) => field.onChange(formatCPF(e.target.value))}
                        maxLength={14}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="data_nascimento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Nascimento</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="sexo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sexo</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Masculino">Masculino</SelectItem>
                        <SelectItem value="Feminino">Feminino</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="salario"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Salário (R$)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="obra_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Obra (Opcional)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a obra" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {obras.map((obra) => (
                        <SelectItem key={obra.id} value={obra.id}>
                          {obra.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Salvar Colaborador
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
