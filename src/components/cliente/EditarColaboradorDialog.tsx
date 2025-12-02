import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCPF, formatTelefone, validateCPF } from "@/lib/validators";

const CLASSIFICACOES_SALARIO = [
  { label: "Ajudante Comum", minimo: 0 },
  { label: "Op. Qualificado I", minimo: 2000 },
  { label: "Op. Qualificado II", minimo: 3000 },
  { label: "Op. Qualificado III", minimo: 4000 },
  { label: "Técnico Especializado", minimo: 5000 },
  { label: "Diretor", minimo: 10000 },
];

const colaboradorSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  sexo: z.enum(["Masculino", "Feminino"], { required_error: "Sexo é obrigatório" }),
  cpf: z.string().min(1, "CPF é obrigatório").refine((cpf) => validateCPF(cpf), "CPF inválido"),
  data_nascimento: z.string().min(1, "Data de nascimento é obrigatória"),
  salario: z.string().min(1, "Salário é obrigatório")
    .refine((val) => {
      const num = parseFloat(val.replace(/[^\d,]/g, '').replace(',', '.'));
      return !isNaN(num) && num >= 0;
    }, "Salário deve ser um valor válido"),
  classificacao: z.enum(["CLT", "SÓCIOS", "PRESTADOR DE SERVIÇO"], { required_error: "Classificação é obrigatória" }),
  aposentado: z.boolean().default(false),
  afastado: z.boolean().default(false),
  cid: z.string().optional(),
});

type ColaboradorFormData = z.infer<typeof colaboradorSchema>;

interface EditarColaboradorDialogProps {
  colaborador: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  isLoteColaborador?: boolean; // Para editar colaboradores_lote em vez de colaboradores
}

export function EditarColaboradorDialog({ colaborador, open, onOpenChange, onSuccess, isLoteColaborador = false }: EditarColaboradorDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ColaboradorFormData>({
    resolver: zodResolver(colaboradorSchema),
    defaultValues: {
      nome: "",
      sexo: "Masculino",
      cpf: "",
      data_nascimento: "",
      salario: "",
      aposentado: false,
      afastado: false,
      cid: "",
    },
  });

  const afastado = form.watch("afastado");

  useEffect(() => {
    if (open && colaborador) {
      form.reset({
        nome: colaborador.nome || "",
        sexo: colaborador.sexo || "Masculino",
        cpf: formatCPF(colaborador.cpf || ""),
        data_nascimento: colaborador.data_nascimento || "",
        salario: colaborador.salario?.toString() || "",
        classificacao: colaborador.classificacao || "CLT",
        aposentado: colaborador.aposentado || false,
        afastado: colaborador.afastado || false,
        cid: colaborador.cid || "",
      });
    }
  }, [open, colaborador, form]);

  const calcularClassificacaoSalario = (valorSalario: number): string => {
    if (valorSalario < CLASSIFICACOES_SALARIO[0].minimo) {
      return CLASSIFICACOES_SALARIO[0].label;
    }
    
    const classificacao = [...CLASSIFICACOES_SALARIO]
      .reverse()
      .find(c => valorSalario >= c.minimo);
    
    return classificacao?.label || CLASSIFICACOES_SALARIO[0].label;
  };

  const onSubmit = async (data: ColaboradorFormData) => {
    try {
      setIsSubmitting(true);

      const valorSalario = parseFloat(data.salario.replace(/[^\d,]/g, '').replace(',', '.'));
      const classificacaoSalario = calcularClassificacaoSalario(valorSalario);
      const tableName = isLoteColaborador ? "colaboradores_lote" : "colaboradores";

      const updateData = {
        nome: data.nome,
        sexo: data.sexo,
        cpf: data.cpf.replace(/\D/g, ''),
        data_nascimento: data.data_nascimento,
        salario: valorSalario,
        classificacao: data.classificacao,
        classificacao_salario: classificacaoSalario,
        aposentado: data.aposentado,
        afastado: data.afastado,
        cid: data.afastado ? data.cid : null,
      };

      const { error } = await supabase
        .from(tableName)
        .update(updateData)
        .eq('id', colaborador.id);

      if (error) throw error;

      toast.success("Colaborador atualizado com sucesso!");
      onOpenChange(false);
      form.reset();
      onSuccess();
    } catch (error) {
      console.error("Erro ao atualizar colaborador:", error);
      toast.error("Erro ao atualizar colaborador");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Colaborador</DialogTitle>
          <DialogDescription>
            Atualize as informações do colaborador
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo *</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome completo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="sexo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sexo *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
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
                name="cpf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF *</FormLabel>
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="data_nascimento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Nascimento *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="salario"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Salário *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="0,00"
                        {...field}
                        onChange={(e) => {
                          const valor = e.target.value.replace(/\D/g, '');
                          const numero = parseFloat(valor) / 100;
                          field.onChange(numero.toFixed(2).replace('.', ','));
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="classificacao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Classificação *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="CLT">CLT</SelectItem>
                      <SelectItem value="SÓCIOS">SÓCIOS</SelectItem>
                      <SelectItem value="PRESTADOR DE SERVIÇO">PRESTADOR DE SERVIÇO</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <FormField
                control={form.control}
                name="aposentado"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Aposentado</FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="afastado"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Afastado</FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              {afastado && (
                <FormField
                  control={form.control}
                  name="cid"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CID</FormLabel>
                      <FormControl>
                        <Input placeholder="Código CID" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
