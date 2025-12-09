import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatCPF, validateCPF } from "@/lib/validators";
import { useUserRole } from "@/hooks/useUserRole";
import { Plus } from "lucide-react";
const CLASSIFICACOES_SALARIO = [{
  label: "Ajudante Comum",
  minimo: 1454.20
}, {
  label: "Ajudante Prático/Meio-Oficial",
  minimo: 1476.20
}, {
  label: "Oficial",
  minimo: 2378.34
}, {
  label: "Op. Qualificado I",
  minimo: 2637.80
}, {
  label: "Op. Qualificado II",
  minimo: 3262.60
}, {
  label: "Op. Qualificado III",
  minimo: 4037.00
}];
const colaboradorSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  sexo: z.enum(["Masculino", "Feminino"], {
    required_error: "Sexo é obrigatório"
  }),
  cpf: z.string().min(1, "CPF é obrigatório").refine(val => validateCPF(val), "CPF inválido"),
  data_nascimento: z.string().min(1, "Data de nascimento é obrigatória"),
  salario: z.string().min(1, "Salário é obrigatório").refine(val => {
    const num = parseFloat(val.replace(/[^\d,]/g, '').replace(',', '.'));
    return !isNaN(num) && num >= 0;
  }, "Salário deve ser um valor válido"),
  classificacao: z.enum(["CLT", "SÓCIOS", "PRESTADOR DE SERVIÇO"], {
    required_error: "Classificação é obrigatória"
  }),
  aposentado: z.boolean().default(false),
  afastado: z.boolean().default(false),
  cid: z.string().optional(),
  empresa_id: z.string().optional()
}).refine(data => {
  if (data.afastado && !data.cid) {
    return false;
  }
  return true;
}, {
  message: "CID é obrigatório quando o colaborador está afastado",
  path: ["cid"]
});
type ColaboradorFormData = z.infer<typeof colaboradorSchema>;
interface NovoColaboradorDialogProps {
  obraId?: string;
  onSuccess?: () => void;
  disabled?: boolean;
}
export function NovoColaboradorDialog({
  obraId,
  onSuccess,
  disabled
}: NovoColaboradorDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [empresas, setEmpresas] = useState<Array<{
    id: string;
    nome: string;
  }>>([]);
  const {
    toast
  } = useToast();
  const {
    profile,
    isAdmin
  } = useUserRole();
  const form = useForm<ColaboradorFormData>({
    resolver: zodResolver(colaboradorSchema),
    defaultValues: {
      nome: "",
      cpf: "",
      data_nascimento: "",
      salario: "",
      aposentado: false,
      afastado: false,
      cid: ""
    }
  });
  const afastado = form.watch("afastado");

  // Buscar empresas para admin
  useEffect(() => {
    if (isAdmin && open) {
      const fetchEmpresas = async () => {
        const {
          data
        } = await supabase.from("empresas").select("id, nome").order("nome");
        if (data) {
          setEmpresas(data);
        }
      };
      fetchEmpresas();
    }
  }, [isAdmin, open]);

  // Função para calcular classificação de salário automaticamente
  const calcularClassificacaoSalario = (valorSalario: number): string => {
    // Se for menor que o mínimo de Ajudante Comum, retorna Ajudante Comum
    if (valorSalario < CLASSIFICACOES_SALARIO[0].minimo) {
      return CLASSIFICACOES_SALARIO[0].label;
    }

    // Encontra a maior classificação cujo mínimo é <= salário
    const classificacao = [...CLASSIFICACOES_SALARIO].reverse().find(c => valorSalario >= c.minimo);
    return classificacao?.label || CLASSIFICACOES_SALARIO[0].label;
  };
  const onSubmit = async (data: ColaboradorFormData) => {
    try {
      setLoading(true);
      const empresa_id = isAdmin ? data.empresa_id : profile?.empresa_id;
      if (!empresa_id) {
        toast({
          title: "Erro",
          description: "Empresa não identificada",
          variant: "destructive"
        });
        return;
      }

      // Verificar CPF duplicado
      const {
        data: existente
      } = await supabase.from("colaboradores").select("id").eq("cpf", data.cpf.replace(/\D/g, '')).eq("empresa_id", empresa_id).maybeSingle();
      if (existente) {
        toast({
          title: "Erro",
          description: "Já existe um colaborador com este CPF nesta empresa",
          variant: "destructive"
        });
        return;
      }
      const valorSalario = parseFloat(data.salario.replace(/[^\d,]/g, '').replace(',', '.'));
      const classificacaoSalario = calcularClassificacaoSalario(valorSalario);
      const {
        error
      } = await supabase.from("colaboradores").insert({
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
        empresa_id,
        obra_id: obraId || null
      });
      if (error) throw error;
      toast({
        title: "Sucesso",
        description: "Colaborador cadastrado com sucesso"
      });
      form.reset();
      setOpen(false);
      onSuccess?.();
    } catch (error) {
      console.error("Erro ao cadastrar colaborador:", error);
      toast({
        title: "Erro",
        description: "Erro ao cadastrar colaborador",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const formatarMoeda = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    const amount = parseFloat(numbers) / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };
  return <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Colaborador</DialogTitle>
          <DialogDescription>
            Preencha todos os campos obrigatórios para cadastrar um novo colaborador.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {isAdmin && <FormField control={form.control} name="empresa_id" render={({
            field
          }) => <FormItem>
                    <FormLabel>Empresa *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a empresa" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {empresas.map(empresa => <SelectItem key={empresa.id} value={empresa.id}>
                            {empresa.nome}
                          </SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>} />}

            <FormField control={form.control} name="nome" render={({
            field
          }) => <FormItem>
                  <FormLabel>Nome *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Nome completo" />
                  </FormControl>
                  <FormMessage />
                </FormItem>} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="sexo" render={({
              field
            }) => <FormItem>
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
                  </FormItem>} />

              <FormField control={form.control} name="cpf" render={({
              field
            }) => <FormItem>
                    <FormLabel>CPF *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="000.000.000-00" maxLength={14} onChange={e => {
                  const formatted = formatCPF(e.target.value);
                  field.onChange(formatted);
                }} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="data_nascimento" render={({
              field
            }) => <FormItem>
                    <FormLabel>Data de Nascimento *</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>} />

              <FormField control={form.control} name="salario" render={({
              field
            }) => <FormItem>
                    <FormLabel>Salário *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="R$ 0,00" onChange={e => {
                  const formatted = formatarMoeda(e.target.value);
                  field.onChange(formatted);
                }} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>} />
            </div>

            <FormField control={form.control} name="classificacao" render={({
            field
          }) => <FormItem>
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
                </FormItem>} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="aposentado" render={({
              field
            }) => <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Aposentado</FormLabel>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>} />

              <FormField control={form.control} name="afastado" render={({
              field
            }) => <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Afastado</FormLabel>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>} />
            </div>

            {afastado && <FormField control={form.control} name="cid" render={({
            field
          }) => <FormItem>
                    <FormLabel>CID *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Código CID" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>} />}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
              form.reset();
              setOpen(false);
            }} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>;
}