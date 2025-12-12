import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { validateCNPJ, formatCNPJ, formatTelefone } from "@/lib/validators";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X, UploadCloud, FileText, Loader2, Download, ExternalLink, Trash2 } from "lucide-react";

// Schema e Tipos
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
  status: z.enum([
    "sem_retorno",
    "tratativa",
    "contrato_assinado",
    "apolices_emitida",
    "acolhimento",
    "ativa",
    "inativa",
    "cancelada",
  ]),
});

type EmpresaFormData = z.infer<typeof empresaSchema>;

interface EditarEmpresaDialogProps {
  empresa: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const EditarEmpresaDialog = ({
  empresa: initialEmpresa,
  open,
  onOpenChange,
  onSuccess,
}: EditarEmpresaDialogProps) => {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [emails, setEmails] = useState<string[]>([]);
  const [telefones, setTelefones] = useState<string[]>([]);
  const { toast } = useToast();

  // 1. REALTIME: Busca dados frescos sempre que o modal abre
  const { data: empresa } = useQuery({
    queryKey: ["empresa-detail", initialEmpresa.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresas").select("*").eq("id", initialEmpresa.id).single();
      if (error) throw error;
      return data;
    },
    initialData: initialEmpresa, // Usa o que veio por prop enquanto carrega
    enabled: open, // Só busca se estiver aberto
  });

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
        status: empresa.status as any,
      });

      const existingEmails = empresa.emails_contato || [];
      const existingTelefones = empresa.telefones_contato || [];

      setEmails(existingEmails.filter((e: any) => e !== empresa.email_contato));
      setTelefones(existingTelefones.filter((t: any) => t !== empresa.telefone_contato));
    }
  }, [empresa, form]);

  // --- DOWNLOAD INTELIGENTE (Evita Bloqueio do Chrome) ---
  const handleDownload = async () => {
    if (!empresa.contrato_url) return;
    setDownloading(true);

    try {
      // Extrai o caminho do arquivo da URL pública
      // Ex: .../public/contratos/ARQUIVO.pdf -> ARQUIVO.pdf
      const path = empresa.contrato_url.split("/contratos/").pop();
      if (!path) throw new Error("Caminho do arquivo inválido");

      const { data, error } = await supabase.storage.from("contratos").download(decodeURIComponent(path));

      if (error) throw error;

      // Cria um link temporário para forçar o download
      const url = window.URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = path; // Nome do arquivo
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Erro no download:", error);
      // Fallback: tenta abrir em nova aba se o download falhar
      window.open(empresa.contrato_url, "_blank");
      toast({ title: "Erro no download", description: "Tentando abrir em nova aba...", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  // --- UPLOAD (Supabase Storage) ---
  const handleContractUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo 10MB.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      // Se já existe contrato, remove o arquivo antigo do Storage
      if (empresa.contrato_url?.includes("supabase.co/storage")) {
        const oldPath = empresa.contrato_url.split("/contratos/").pop();
        if (oldPath) {
          await supabase.storage.from("contratos").remove([decodeURIComponent(oldPath)]);
        }
      }

      const fileExt = file.name.split(".").pop();
      const cleanName = empresa.nome.toUpperCase().replace(/[^A-Z0-9]/g, "_");
      const fileName = `CONTRATO_${cleanName}_${Date.now()}.${fileExt}`;

      // Upload
      const { error: uploadError } = await supabase.storage.from("contratos").upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Pegar URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("contratos").getPublicUrl(fileName);

      // Salvar no Banco
      const { error: dbError } = await supabase
        .from("empresas")
        .update({ contrato_url: publicUrl })
        .eq("id", empresa.id);

      if (dbError) throw dbError;

      // Atualiza caches para refletir na hora (Realtime)
      queryClient.invalidateQueries({ queryKey: ["empresa-detail", empresa.id] });
      queryClient.invalidateQueries({ queryKey: ["empresas-ativas"] });
      queryClient.invalidateQueries({ queryKey: ["crm-empresas"] });

      toast({ title: "Contrato salvo!", description: "Arquivo armazenado com sucesso." });
      onSuccess?.();
    } catch (error: any) {
      console.error(error);
      toast({
        title: "Erro no upload",
        description: error.message || "Falha ao salvar arquivo.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  // --- EXCLUIR CONTRATO ---
  const handleDeleteContract = async () => {
    if (!empresa.contrato_url) return;

    if (!confirm("Tem certeza que deseja excluir o contrato?")) return;

    setUploading(true);
    try {
      // Remove do Storage se for URL do Supabase
      if (empresa.contrato_url.includes("supabase.co/storage")) {
        const path = empresa.contrato_url.split("/contratos/").pop();
        if (path) {
          const { error: deleteError } = await supabase.storage.from("contratos").remove([decodeURIComponent(path)]);
          if (deleteError) console.error("Erro ao remover arquivo:", deleteError);
        }
      }

      // Remove referência no banco
      const { error: dbError } = await supabase.from("empresas").update({ contrato_url: null }).eq("id", empresa.id);

      if (dbError) throw dbError;

      queryClient.invalidateQueries({ queryKey: ["empresa-detail", empresa.id] });
      queryClient.invalidateQueries({ queryKey: ["empresas-ativas"] });
      queryClient.invalidateQueries({ queryKey: ["crm-empresas"] });

      toast({ title: "Contrato excluído", description: "O arquivo foi removido com sucesso." });
    } catch (error: any) {
      console.error(error);
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  // --- SUBMIT DO FORMULÁRIO ---
  const onSubmit = async (data: EmpresaFormData) => {
    setLoading(true);
    try {
      const validEmails = emails.filter((e) => e.trim() !== "");
      const validTelefones = telefones.filter((t) => t.trim() !== "");

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

      toast({ title: "Empresa atualizada!", description: "Dados salvos com sucesso." });

      // Atualiza listas principais
      queryClient.invalidateQueries({ queryKey: ["empresas-ativas"] });
      queryClient.invalidateQueries({ queryKey: ["crm-empresas"] });

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Helpers de Array
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
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Editar Empresa</DialogTitle>
          <DialogDescription>Gerencie dados cadastrais e contratos.</DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 px-1 pr-2 space-y-6">
          {/* CARD DE CONTRATO (Área Realtime) */}
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 shadow-sm mt-2">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-slate-700">
              <FileText className="h-4 w-4 text-primary" />
              Contrato Digital
            </h3>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="flex-1 w-full">
                {empresa.contrato_url ? (
                  <div className="flex items-center justify-between p-2.5 bg-white border border-green-200 rounded-md text-sm shadow-sm transition-all hover:border-green-300">
                    <div className="flex items-center gap-2 text-green-700 font-medium truncate">
                      <FileText className="h-4 w-4 shrink-0" />
                      <span className="truncate">Contrato Anexado</span>
                    </div>

                    <div className="flex gap-1">
                      {/* Botão de Download Seguro */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 hover:bg-green-50 text-green-700"
                        onClick={handleDownload}
                        disabled={downloading}
                      >
                        {downloading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Baixar
                      </Button>

                      {/* Botão de Abrir Externo */}
                      <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-green-50 text-green-700" asChild>
                        <a href={empresa.contrato_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>

                      {/* Botão de Excluir */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 hover:bg-red-50 text-red-600"
                        onClick={handleDeleteContract}
                        disabled={uploading}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
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
                  {empresa.contrato_url ? "Substituir" : "Anexar PDF"}
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
                      <option value="sem_retorno">🔘 Sem Retorno</option>
                      <option value="tratativa">🟡 Em Tratativa</option>
                      <option value="contrato_assinado">🔵 Contrato Assinado</option>
                      <option value="apolices_emitida">🟣 Apólices Emitida</option>
                      <option value="acolhimento">🩵 Acolhimento</option>
                      <option value="ativa">✅ Empresa Ativa</option>
                      <option value="inativa">🔴 Inativa</option>
                      <option value="cancelada">🟠 Cancelada</option>
                    </select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Contatos Adicionais */}
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
