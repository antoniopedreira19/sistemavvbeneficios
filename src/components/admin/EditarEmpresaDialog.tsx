import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { validateCNPJ, formatCNPJ, formatTelefone } from "@/lib/validators";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X, UploadCloud, FileText, Loader2, ExternalLink } from "lucide-react";

const empresaSchema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório").max(200, "Nome muito longo"),
  nome_responsavel: z.string().trim().max(200, "Nome muito longo").optional().or(z.literal("")),
  cnpj: z
    .string()
    .trim()
    .min(1, "CNPJ é obrigatório")
    .refine((val) => validateCNPJ(val), "CNPJ inválido"),
  email_contato: z.string().trim().email("Email inválido").max(255, "Email muito longo").optional().or(z.literal("")),
  telefone_contato: z.string().trim().optional().or(z.literal("")),
  status: z.enum(["ativa", "em_implementacao", "inativa", "cancelada"]),
});

type EmpresaFormData = z.infer<typeof empresaSchema>;

interface EditarEmpresaDialogProps {
  empresa: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const EditarEmpresaDialog = ({ empresa, open, onOpenChange, onSuccess }: EditarEmpresaDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [emails, setEmails] = useState<string[]>([]);
  const [telefones, setTelefones] = useState<string[]>([]);
  const [contratoUrl, setContratoUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<EmpresaFormData>({
    resolver: zodResolver(empresaSchema),
    defaultValues: {
      nome: "",
      cnpj: "",
      status: "ativa",
    },
  });

  useEffect(() => {
    if (empresa) {
      form.reset({
        nome: empresa.nome,
        nome_responsavel: empresa.nome_responsavel || "",
        cnpj: empresa.cnpj,
        email_contato: empresa.email_contato || "",
        telefone_contato: empresa.telefone_contato || "",
        status: empresa.status,
      });

      const existingEmails = empresa.emails_contato || [];
      const existingTelefones = empresa.telefones_contato || [];

      setEmails(existingEmails.filter((e: string) => e !== empresa.email_contato));
      setTelefones(existingTelefones.filter((t: string) => t !== empresa.telefone_contato));
      setContratoUrl(empresa.contrato_url);
    }
  }, [empresa, form]);

  const handleContractUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Limite de 15MB.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("empresaId", empresa.id);
      formData.append("empresaNome", empresa.nome);

      const { data, error } = await supabase.functions.invoke("upload-contract", {
        body: formData,
      });

      if (error) throw error;

      setContratoUrl(data.url); // Atualiza visualmente na hora
      toast({ title: "Contrato enviado!", description: "Salvo no Google Drive com sucesso." });
      onSuccess?.();
    } catch (error: any) {
      console.error(error);
      toast({ title: "Erro no upload", description: "Falha na conexão com o servidor.", variant: "destructive" });
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const onSubmit = async (data: EmpresaFormData) => {
    setLoading(true);
    try {
      const validEmails = emails.filter((e) => e.trim() !== "");
      const validTelefones = telefones.filter((t) => t.trim() !== "");

      let statusCrmUpdate = {};
      if (data.status === "ativa") statusCrmUpdate = { status_crm: "empresa_ativa" };
      if (data.status === "inativa" || data.status === "cancelada") statusCrmUpdate = { status_crm: "cancelada" };

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
          ...statusCrmUpdate,
        })
        .eq("id", empresa.id);

      if (error) throw error;

      toast({ title: "Empresa atualizada!", description: "Dados salvos com sucesso." });
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const addEmail = () => setEmails((p) => [...p, ""]);
  const removeEmail = (i: number) => setEmails(emails.filter((_, idx) => idx !== i));
  const updateEmail = (i: number, v: string) => {
    const n = [...emails];
    n[i] = v;
    setEmails(n);
  };

  const addTelefone = () => setTelefones((p) => [...p, ""]);
  const removeTelefone = (i: number) => setTelefones(telefones.filter((_, idx) => idx !== i));
  const updateTelefone = (i: number, v: string) => {
    const n = [...telefones];
    n[i] = v;
    setTelefones(n);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Editar Empresa</DialogTitle>
          <DialogDescription>Gerencie dados cadastrais e contratos.</DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 px-1 pr-2 space-y-6">
          {/* CARD DE CONTRATO */}
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 shadow-sm mt-2">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-slate-700">
              <FileText className="h-4 w-4 text-primary" />
              Contrato Digital
            </h3>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="flex-1 w-full">
                {contratoUrl ? (
                  <div className="flex items-center justify-between p-2.5 bg-white border border-green-200 rounded-md text-sm shadow-sm">
                    <div className="flex items-center gap-2 text-green-700 font-medium truncate">
                      <FileText className="h-4 w-4 shrink-0" />
                      <span className="truncate">Contrato Anexado</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      className="h-7 px-2 hover:bg-green-50 text-green-700 ml-2"
                    >
                      <a href={contratoUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Abrir no Drive
                      </a>
                    </Button>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground italic border border-dashed border-slate-300 rounded-md p-2.5 text-center bg-white">
                    Nenhum contrato disponível.
                  </div>
                )}
              </div>

              <div className="w-full sm:w-auto relative">
                <Input
                  id="contract-upload"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={handleContractUpload}
                  disabled={uploading}
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  className="w-full sm:w-auto border-dashed border-primary/50 text-primary hover:bg-primary/5"
                  onClick={() => document.getElementById("contract-upload")?.click()}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <UploadCloud className="h-4 w-4 mr-2" />
                  )}
                  {contratoUrl ? "Substituir" : "Anexar PDF"}
                </Button>
              </div>
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
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
                      <FormLabel>Responsável</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
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
                        <Input {...field} onChange={(e) => field.onChange(formatCNPJ(e.target.value))} maxLength={18} />
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
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="telefone_contato"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          onChange={(e) => field.onChange(formatTelefone(e.target.value))}
                          maxLength={15}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={field.value}
                      onChange={field.onChange}
                    >
                      <option value="em_implementacao">⚡ Em Implementação (CRM)</option>
                      <option value="ativa">✅ Ativa</option>
                      <option value="inativa">🚫 Inativa / Cancelada</option>
                    </select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4 border-t pt-4">
                <div className="space-y-2">
                  <span className="text-xs uppercase text-muted-foreground font-bold">Emails Adicionais</span>
                  {emails.map((email, i) => (
                    <div key={i} className="flex gap-2">
                      <Input value={email} onChange={(e) => updateEmail(i, e.target.value)} className="h-8" />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeEmail(i)}
                        className="h-8 w-8"
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
                    className="w-full h-8 border-dashed text-xs"
                  >
                    <Plus className="h-3 w-3 mr-2" /> Adicionar Email
                  </Button>
                </div>

                <div className="space-y-2">
                  <span className="text-xs uppercase text-muted-foreground font-bold">Telefones Adicionais</span>
                  {telefones.map((tel, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        value={tel}
                        onChange={(e) => updateTelefone(i, formatTelefone(e.target.value))}
                        className="h-8"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeTelefone(i)}
                        className="h-8 w-8"
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
                    className="w-full h-8 border-dashed text-xs"
                  >
                    <Plus className="h-3 w-3 mr-2" /> Adicionar Telefone
                  </Button>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
};
