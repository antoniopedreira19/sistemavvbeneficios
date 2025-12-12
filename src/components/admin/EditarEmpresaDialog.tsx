import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatCNPJ, formatCPF, formatTelefone } from "@/lib/validators";
import { Loader2, UploadCloud, Trash2, FileText, Download, ExternalLink, Plus, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface EditarEmpresaDialogProps {
  empresa: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditarEmpresaDialog({
  empresa: initialEmpresa,
  open,
  onOpenChange,
  onSuccess,
}: EditarEmpresaDialogProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Estados dos Campos
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [endereco, setEndereco] = useState("");
  const [responsavelNome, setResponsavelNome] = useState("");
  const [responsavelCpf, setResponsavelCpf] = useState("");
  const [emailContato, setEmailContato] = useState("");
  const [telefoneContato, setTelefoneContato] = useState("");
  const [status, setStatus] = useState("");

  // Listas de Contatos
  const [emails, setEmails] = useState<string[]>([]);
  const [telefones, setTelefones] = useState<string[]>([]);

  // Buscar dados atualizados (Realtime para contrato)
  const { data: empresa } = useQuery({
    queryKey: ["empresa-detail-edit", initialEmpresa.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresas").select("*").eq("id", initialEmpresa.id).single();
      if (error) throw error;
      return data;
    },
    initialData: initialEmpresa,
    enabled: open,
  });

  // Carregar dados ao abrir ou atualizar
  useEffect(() => {
    if (empresa) {
      setNome(empresa.nome || "");
      setCnpj(formatCNPJ(empresa.cnpj || ""));
      setEndereco(empresa.endereco || "");
      setResponsavelNome(empresa.responsavel_nome || "");
      setResponsavelCpf(formatCPF(empresa.responsavel_cpf || ""));
      setEmailContato(empresa.email_contato || "");
      setTelefoneContato(formatTelefone(empresa.telefone_contato || ""));
      setStatus(empresa.status || "ativa");

      // Carregar listas extras
      const existingEmails = (empresa.emails_contato as string[]) || [];
      const existingTelefones = (empresa.telefones_contato as string[]) || [];
      // Filtra para não duplicar o principal se ele estiver na lista
      setEmails(existingEmails.filter((e) => e !== empresa.email_contato));
      setTelefones(existingTelefones.filter((t) => t !== empresa.telefone_contato));
    }
  }, [empresa, open]);

  // --- LOGICA DE CONTRATO ---
  const handleDownload = async () => {
    if (!empresa.contrato_url) return;
    setDownloading(true);
    try {
      const path = empresa.contrato_url.split("/contratos/").pop();
      if (!path) throw new Error("Caminho inválido");

      const { data, error } = await supabase.storage.from("contratos").download(decodeURIComponent(path));
      if (error) throw error;

      const url = window.URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = path;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error(error);
      window.open(empresa.contrato_url, "_blank");
    } finally {
      setDownloading(false);
    }
  };

  const handleContractUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Arquivo muito grande (Máx 15MB)");
      return;
    }

    setUploading(true);
    try {
      // Remove anterior se existir
      if (empresa.contrato_url?.includes("supabase.co/storage")) {
        const oldPath = empresa.contrato_url.split("/contratos/").pop();
        if (oldPath) await supabase.storage.from("contratos").remove([decodeURIComponent(oldPath)]);
      }

      const fileExt = file.name.split(".").pop();
      const cleanName = nome.toUpperCase().replace(/[^A-Z0-9]/g, "_");
      const fileName = `CONTRATO_${cleanName}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from("contratos").upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("contratos").getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from("empresas")
        .update({ contrato_url: publicUrl })
        .eq("id", empresa.id);

      if (dbError) throw dbError;

      queryClient.invalidateQueries({ queryKey: ["empresa-detail-edit", empresa.id] });
      toast.success("Contrato anexado com sucesso!");
    } catch (error: any) {
      toast.error("Erro no upload: " + error.message);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleDeleteContract = async () => {
    if (!confirm("Excluir o contrato atual?")) return;
    setUploading(true);
    try {
      if (empresa.contrato_url?.includes("supabase.co/storage")) {
        const path = empresa.contrato_url.split("/contratos/").pop();
        if (path) await supabase.storage.from("contratos").remove([decodeURIComponent(path)]);
      }
      await supabase.from("empresas").update({ contrato_url: null }).eq("id", empresa.id);
      queryClient.invalidateQueries({ queryKey: ["empresa-detail-edit", empresa.id] });
      toast.success("Contrato removido.");
    } catch (error) {
      toast.error("Erro ao excluir contrato.");
    } finally {
      setUploading(false);
    }
  };

  // --- LOGICA DE UPDATE GERAL ---
  const editarEmpresaMutation = useMutation({
    mutationFn: async () => {
      const cnpjLimpo = cnpj.replace(/\D/g, "");
      const cpfLimpo = responsavelCpf.replace(/\D/g, "");

      if (cnpjLimpo.length !== 14) throw new Error("CNPJ inválido (14 dígitos)");

      const validEmails = emails.filter((e) => e.trim() !== "");
      const validTelefones = telefones.filter((t) => t.trim() !== "");

      const { error } = await supabase
        .from("empresas")
        .update({
          nome,
          cnpj: cnpjLimpo,
          endereco: endereco || null,
          responsavel_nome: responsavelNome || null,
          responsavel_cpf: cpfLimpo || null,
          email_contato: emailContato,
          telefone_contato: telefoneContato,
          emails_contato: validEmails,
          telefones_contato: validTelefones,
          status: status as any,
        })
        .eq("id", empresa.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Empresa atualizada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["admin-empresas"] });
      queryClient.invalidateQueries({ queryKey: ["crm-empresas"] });
      queryClient.invalidateQueries({ queryKey: ["empresas-ativas"] });
      if (onSuccess) onSuccess();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao atualizar empresa");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    editarEmpresaMutation.mutate();
  };

  // Helpers de Array
  const addEmail = () => setEmails([...emails, ""]);
  const updateEmail = (i: number, val: string) => {
    const n = [...emails];
    n[i] = val;
    setEmails(n);
  };
  const removeEmail = (i: number) => setEmails(emails.filter((_, idx) => idx !== i));

  const addTelefone = () => setTelefones([...telefones, ""]);
  const updateTelefone = (i: number, val: string) => {
    const n = [...telefones];
    n[i] = val;
    setTelefones(n);
  };
  const removeTelefone = (i: number) => setTelefones(telefones.filter((_, idx) => idx !== i));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>Editar Empresa</DialogTitle>
          <DialogDescription>Gerencie dados cadastrais, contatos e contrato.</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <form id="edit-form" onSubmit={handleSubmit} className="space-y-6 pb-6">
            {/* SEÇÃO 1: CONTRATO */}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 mt-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-2 text-slate-700">
                  <FileText className="h-4 w-4 text-primary" /> Contrato Digital
                </h3>
                {empresa.contrato_url && (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleDownload}
                      disabled={downloading}
                      className="h-7 text-green-700 hover:text-green-800 hover:bg-green-50"
                    >
                      {downloading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Download className="h-3 w-3 mr-1" />
                      )}{" "}
                      Baixar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-600 hover:bg-red-50"
                      onClick={handleDeleteContract}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  {empresa.contrato_url ? (
                    <div className="text-xs bg-white border border-green-200 text-green-700 p-2 rounded flex items-center gap-2">
                      <CheckCircleIcon className="h-3 w-3" /> Contrato anexado
                      <a
                        href={empresa.contrato_url}
                        target="_blank"
                        rel="noopener"
                        className="ml-auto hover:underline flex items-center gap-1"
                      >
                        Abrir <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground italic p-2 border border-dashed rounded bg-white text-center">
                      Nenhum contrato
                    </div>
                  )}
                </div>
                <div>
                  <Input
                    id="contract-up"
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    onChange={handleContractUpload}
                    disabled={uploading}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => document.getElementById("contract-up")?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <UploadCloud className="h-3 w-3 mr-2" />
                    )}
                    {empresa.contrato_url ? "Trocar" : "Anexar"}
                  </Button>
                </div>
              </div>
            </div>

            {/* SEÇÃO 2: DADOS CADASTRAIS */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium border-b pb-1 text-slate-500">Dados Cadastrais</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Nome da Empresa *</Label>
                  <Input value={nome} onChange={(e) => setNome(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <Label>CNPJ *</Label>
                  <Input value={cnpj} onChange={(e) => setCnpj(formatCNPJ(e.target.value))} maxLength={18} required />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label>Endereço Completo</Label>
                  <Input
                    value={endereco}
                    onChange={(e) => setEndereco(e.target.value)}
                    placeholder="Rua, Número, Bairro, Cidade - UF"
                  />
                </div>
              </div>
            </div>

            {/* SEÇÃO 3: RESPONSÁVEL */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium border-b pb-1 text-slate-500">Dados do Responsável (Assinatura)</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Nome Completo</Label>
                  <Input value={responsavelNome} onChange={(e) => setResponsavelNome(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>CPF</Label>
                  <Input
                    value={responsavelCpf}
                    onChange={(e) => setResponsavelCpf(formatCPF(e.target.value))}
                    maxLength={14}
                  />
                </div>
              </div>
            </div>

            {/* SEÇÃO 4: CONTATO & STATUS */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium border-b pb-1 text-slate-500">Contato & Status</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>E-mail Principal</Label>
                  <Input value={emailContato} onChange={(e) => setEmailContato(e.target.value)} type="email" />
                </div>
                <div className="space-y-1">
                  <Label>Telefone Principal</Label>
                  <Input value={telefoneContato} onChange={(e) => setTelefoneContato(formatTelefone(e.target.value))} />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label>Status do Cliente</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="ativa">✅ Ativa</option>
                    <option value="inativa">🔴 Inativa</option>
                    <option value="cancelada">🟠 Cancelada</option>
                    <option value="sem_retorno">🔘 Sem Retorno</option>
                    <option value="tratativa">🟡 Em Tratativa</option>
                    <option value="contrato_assinado">🔵 Contrato Assinado</option>
                    <option value="apolices_emitida">🟣 Apólices Emitida</option>
                    <option value="acolhimento">🩵 Acolhimento</option>
                  </select>
                </div>
              </div>

              {/* Contatos Extras */}
              <div className="space-y-3 pt-2">
                <Label className="text-xs uppercase text-muted-foreground">Contatos Adicionais</Label>
                {emails.map((email, i) => (
                  <div key={`e-${i}`} className="flex gap-2">
                    <Input
                      value={email}
                      onChange={(e) => updateEmail(i, e.target.value)}
                      placeholder="Email adicional"
                      className="h-8 text-sm"
                    />
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
                  className="h-7 text-xs w-full border-dashed"
                >
                  <Plus className="h-3 w-3 mr-1" /> Add Email
                </Button>

                {telefones.map((tel, i) => (
                  <div key={`t-${i}`} className="flex gap-2 mt-2">
                    <Input
                      value={tel}
                      onChange={(e) => updateTelefone(i, formatTelefone(e.target.value))}
                      placeholder="Tel adicional"
                      className="h-8 text-sm"
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
                  className="h-7 text-xs w-full border-dashed mt-2"
                >
                  <Plus className="h-3 w-3 mr-1" /> Add Telefone
                </Button>
              </div>
            </div>
          </form>
        </ScrollArea>

        <DialogFooter className="p-4 border-t bg-white">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="edit-form" disabled={editarEmpresaMutation.isPending}>
            {editarEmpresaMutation.isPending ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
