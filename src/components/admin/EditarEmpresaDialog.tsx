import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { validateCNPJ, formatCNPJ, formatTelefone } from "@/lib/validators";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";

const empresaSchema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório").max(200, "Nome muito longo"),
  nome_responsavel: z.string().trim().max(200, "Nome muito longo").optional().or(z.literal('')),
  cnpj: z.string()
    .trim()
    .min(1, "CNPJ é obrigatório")
    .refine((val) => validateCNPJ(val), "CNPJ inválido"),
  email_contato: z.string().trim().email("Email inválido").max(255, "Email muito longo").optional().or(z.literal('')),
  telefone_contato: z.string().trim().optional().or(z.literal('')),
  status: z.enum(['ativa', 'em_implementacao']),
});

type EmpresaFormData = z.infer<typeof empresaSchema>;

interface Empresa {
  id: string;
  nome: string;
  nome_responsavel: string | null;
  cnpj: string;
  email_contato: string | null;
  telefone_contato: string | null;
  emails_contato?: any;
  telefones_contato?: any;
  status: 'ativa' | 'em_implementacao';
}

interface EditarEmpresaDialogProps {
  empresa: Empresa;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const EditarEmpresaDialog = ({ empresa, open, onOpenChange, onSuccess }: EditarEmpresaDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [emails, setEmails] = useState<string[]>([]);
  const [telefones, setTelefones] = useState<string[]>([]);
  const { toast } = useToast();

  const form = useForm<EmpresaFormData>({
    resolver: zodResolver(empresaSchema),
    defaultValues: {
      nome: empresa.nome,
      nome_responsavel: empresa.nome_responsavel || "",
      cnpj: empresa.cnpj,
      email_contato: empresa.email_contato || "",
      telefone_contato: empresa.telefone_contato || "",
      status: empresa.status,
    },
  });

  useEffect(() => {
    form.reset({
      nome: empresa.nome,
      nome_responsavel: empresa.nome_responsavel || "",
      cnpj: empresa.cnpj,
      email_contato: empresa.email_contato || "",
      telefone_contato: empresa.telefone_contato || "",
      status: empresa.status,
    });
    
    // Load existing emails and telefones, filtering out duplicates with main contact fields
    const existingEmails = empresa.emails_contato || [];
    const existingTelefones = empresa.telefones_contato || [];
    
    // Remove main email from array if it exists there to avoid duplication
    const filteredEmails = existingEmails.filter((e: string) => e !== empresa.email_contato);
    const filteredTelefones = existingTelefones.filter((t: string) => t !== empresa.telefone_contato);
    
    setEmails(filteredEmails);
    setTelefones(filteredTelefones);
  }, [empresa, form]);

  const addEmail = () => setEmails((prev) => [...prev, ""]);
  const removeEmail = (index: number) => setEmails(emails.filter((_, i) => i !== index));
  const updateEmail = (index: number, value: string) => {
    const newEmails = [...emails];
    newEmails[index] = value;
    setEmails(newEmails);
  };

  const addTelefone = () => setTelefones((prev) => [...prev, ""]);
  const removeTelefone = (index: number) => setTelefones(telefones.filter((_, i) => i !== index));
  const updateTelefone = (index: number, value: string) => {
    const newTelefones = [...telefones];
    newTelefones[index] = value;
    setTelefones(newTelefones);
  };

  const onSubmit = async (data: EmpresaFormData) => {
    setLoading(true);
    try {
      // Filter empty values
      const validEmails = emails.filter(e => e.trim() !== "");
      const validTelefones = telefones.filter(t => t.trim() !== "");

      const { error } = await supabase
        .from("empresas")
        .update({
          nome: data.nome,
          nome_responsavel: data.nome_responsavel,
          cnpj: data.cnpj,
          email_contato: data.email_contato,
          telefone_contato: data.telefone_contato,
          emails_contato: validEmails,
          telefones_contato: validTelefones,
          status: data.status,
        })
        .eq("id", empresa.id);

      if (error) throw error;

      toast({
        title: "Empresa atualizada!",
        description: "As informações da empresa foram atualizadas com sucesso.",
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar empresa",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Editar Empresa</DialogTitle>
          <DialogDescription>
            Atualize as informações da empresa
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 px-1">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Empresa</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="nome_responsavel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Responsável</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: João Silva" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cnpj"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CNPJ</FormLabel>
                  <FormControl>
                    <Input 
                      {...field}
                      onChange={(e) => {
                        const formatted = formatCNPJ(e.target.value);
                        field.onChange(formatted);
                      }}
                      maxLength={18}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email_contato"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email de Contato</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="telefone_contato"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone de Contato</FormLabel>
                  <FormControl>
                    <Input 
                      {...field}
                      onChange={(e) => {
                        const formatted = formatTelefone(e.target.value);
                        field.onChange(formatted);
                      }}
                      maxLength={15}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="space-y-2">
              <FormLabel>Emails Adicionais (CRM)</FormLabel>
              {emails.map((email, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => updateEmail(index, e.target.value)}
                    placeholder="email@exemplo.com"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeEmail(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addEmail}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Email
              </Button>
            </div>

            <div className="space-y-2">
              <FormLabel>Telefones Adicionais (CRM)</FormLabel>
              {telefones.map((telefone, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={telefone}
                    onChange={(e) => {
                      const formatted = formatTelefone(e.target.value);
                      updateTelefone(index, formatted);
                    }}
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeTelefone(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addTelefone}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Telefone
              </Button>
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={field.value}
                    onChange={field.onChange}
                  >
                    <option value="em_implementacao">Em Implementação</option>
                    <option value="ativa">Ativa</option>
                  </select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
};
