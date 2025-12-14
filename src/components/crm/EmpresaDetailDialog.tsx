import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Mail, Phone, FileText, User, Pencil, Calendar, ExternalLink, Download, Trash2, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { EmpresaCRM, LOTE_STATUS_LABELS, CRM_FUNNEL_STATUSES } from "@/types/crm";
import { EditarEmpresaDialog } from "@/components/admin/EditarEmpresaDialog";
import { supabase } from "@/integrations/supabase/client";

interface EmpresaDetailDialogProps {
  empresa: EmpresaCRM | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statusLabels: Record<string, string>;
  onUpdateStatus: (empresaId: string, newStatus: string) => void;
  onEmpresaUpdated: () => void;
}

interface LoteCompetencia {
  competencia: string;
  status: string;
}

const STATUS_BADGE_VARIANTS: Record<string, string> = {
  sem_retorno: "bg-slate-500/10 text-slate-600 border-slate-500/30",
  tratativa: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  contrato_assinado: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  apolices_emitida: "bg-purple-500/10 text-purple-600 border-purple-500/30",
  acolhimento: "bg-cyan-500/10 text-cyan-600 border-cyan-500/30",
  ativa: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  inativa: "bg-red-500/10 text-red-600 border-red-500/30",
  cancelada: "bg-orange-500/10 text-orange-600 border-orange-500/30",
};

const EmpresaDetailDialog = ({
  empresa,
  open,
  onOpenChange,
  statusLabels,
  onUpdateStatus,
  onEmpresaUpdated,
}: EmpresaDetailDialogProps) => {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [competencias, setCompetencias] = useState<LoteCompetencia[]>([]);
  const [loadingCompetencias, setLoadingCompetencias] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const queryClient = useQueryClient();

  const handleDownloadContrato = async () => {
    if (!empresa?.contrato_url) return;
    setDownloading(true);
    try {
      // Verifica se é URL do Supabase Storage
      if (empresa.contrato_url.includes("supabase.co/storage")) {
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
      } else {
        // URL do Google Drive ou outra - abre diretamente
        window.open(empresa.contrato_url, "_blank");
      }
    } catch (error) {
      console.error("Erro no download:", error);
      window.open(empresa.contrato_url, "_blank");
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    if (open && empresa) {
      fetchCompetencias();
    }
  }, [open, empresa?.id]);

  const fetchCompetencias = async () => {
    if (!empresa) return;
    
    setLoadingCompetencias(true);
    try {
      const { data, error } = await supabase
        .from("lotes_mensais")
        .select("competencia, status")
        .eq("empresa_id", empresa.id)
        .order("competencia", { ascending: false });

      if (error) throw error;
      setCompetencias(data || []);
    } catch (error) {
      console.error("Erro ao buscar competências:", error);
    } finally {
      setLoadingCompetencias(false);
    }
  };

  if (!empresa) return null;

  const handleStatusChange = (newStatus: string) => {
    onUpdateStatus(empresa.id, newStatus);
  };

  const handleEditSuccess = () => {
    setEditDialogOpen(false);
    onEmpresaUpdated();
  };

  const handleDeleteEmpresa = async () => {
    if (!empresa) return;
    if (!confirm(`Tem certeza que deseja excluir a empresa "${empresa.nome}"? Esta ação não pode ser desfeita.`)) return;

    setDeleting(true);
    try {
      // Remove contrato do Storage se existir
      if (empresa.contrato_url?.includes("supabase.co/storage")) {
        const path = empresa.contrato_url.split("/contratos/").pop();
        if (path) {
          await supabase.storage.from("contratos").remove([decodeURIComponent(path)]);
        }
      }

      const { error } = await supabase.from("empresas").delete().eq("id", empresa.id);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["empresas-ativas"] });
      queryClient.invalidateQueries({ queryKey: ["empresas-inativas"] });
      queryClient.invalidateQueries({ queryKey: ["crm-empresas"] });

      toast({ title: "Empresa excluída", description: "A empresa foi removida com sucesso." });
      onOpenChange(false);
    } catch (error: any) {
      console.error(error);
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const empresaForEdit = {
    id: empresa.id,
    nome: empresa.nome,
    cnpj: empresa.cnpj,
    email_contato: empresa.email_contato,
    telefone_contato: empresa.telefone_contato,
    nome_responsavel: empresa.nome_responsavel,
    status: empresa.status,
    emails_contato: empresa.emails_contato || [],
    telefones_contato: empresa.telefones_contato || [],
    contrato_url: empresa.contrato_url,
  };

  // Determinar se está no funil CRM ou é status final
  const isInFunnel = CRM_FUNNEL_STATUSES.includes(empresa.status as any);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Detalhes da Empresa
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditDialogOpen(true)}
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteEmpresa}
                  disabled={deleting}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"
                >
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </div>
            </DialogTitle>
            <DialogDescription>
              Visualize e gerencie informações da empresa
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">
                  Nome
                </Label>
                <p className="text-lg font-semibold text-foreground">{empresa.nome}</p>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wide flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Responsável
                </Label>
                <p className="text-foreground">
                  {empresa.nome_responsavel || (
                    <span className="text-muted-foreground italic">Não informado</span>
                  )}
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wide flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  CNPJ
                </Label>
                <p className="text-foreground">{empresa.cnpj}</p>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wide flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  E-mails para Contato
                </Label>
                {(() => {
                  const emailsArray = empresa.emails_contato || [];
                  const allEmails = empresa.email_contato 
                    ? [empresa.email_contato, ...emailsArray] 
                    : emailsArray;
                  const uniqueEmails = Array.from(new Set(allEmails.filter(e => e && e.trim() !== "")));
                  
                  return uniqueEmails.length > 0 ? (
                    <div className="space-y-1">
                      {uniqueEmails.map((email: string, idx: number) => (
                        <p key={idx} className="text-sm text-foreground">{email}</p>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground italic text-sm">Não informado</span>
                  );
                })()}
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wide flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  Telefones para Contato
                </Label>
                {(() => {
                  const telefonesArray = empresa.telefones_contato || [];
                  const allTelefones = empresa.telefone_contato 
                    ? [empresa.telefone_contato, ...telefonesArray] 
                    : telefonesArray;
                  const uniqueTelefones = Array.from(new Set(allTelefones.filter(t => t && t.trim() !== "")));
                  
                  return uniqueTelefones.length > 0 ? (
                    <div className="space-y-1">
                      {uniqueTelefones.map((telefone: string, idx: number) => (
                        <p key={idx} className="text-sm text-foreground">{telefone}</p>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground italic text-sm">Não informado</span>
                  );
                })()}
              </div>

              {/* Contrato Digital */}
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wide flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  Contrato
                </Label>
{empresa.contrato_url ? (
                  <div className="flex items-center gap-2 p-2.5 bg-green-50 border border-green-200 rounded-md dark:bg-green-900/20 dark:border-green-800">
                    <FileText className="h-4 w-4 text-green-600 shrink-0 dark:text-green-400" />
                    <span className="text-sm text-green-700 font-medium flex-1 dark:text-green-300">Contrato Anexado</span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(empresa.contrato_url!, "_blank")}
                        className="h-7 px-2 hover:bg-green-100 text-green-700 dark:hover:bg-green-800/50 dark:text-green-300"
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleDownloadContrato}
                        disabled={downloading}
                        className="h-7 px-2 hover:bg-green-100 text-green-700 dark:hover:bg-green-800/50 dark:text-green-300"
                      >
                        <Download className="h-3.5 w-3.5 mr-1" /> {downloading ? "..." : "Baixar"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Nenhum contrato anexado</p>
                )}
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">
                  Status no CRM
                </Label>
                <Select value={empresa.status} onValueChange={handleStatusChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o status">
                      {empresa.status && (
                        <Badge
                          variant="outline"
                          className={STATUS_BADGE_VARIANTS[empresa.status] || "bg-muted text-muted-foreground"}
                        >
                          {statusLabels[empresa.status] || empresa.status}
                        </Badge>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        <div className="flex items-center">
                          <Badge
                            variant="outline"
                            className={STATUS_BADGE_VARIANTS[value] || "bg-muted text-muted-foreground"}
                          >
                            {label}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="space-y-3">
                <Label className="text-muted-foreground text-xs uppercase tracking-wide flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Competências Enviadas
                </Label>
                
                {loadingCompetencias ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                  </div>
                ) : competencias.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    Nenhuma competência enviada
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {competencias.map((lote) => (
                      <div
                        key={lote.competencia}
                        className="flex items-center gap-3 p-2 rounded-md bg-muted/50"
                      >
                        <Checkbox checked disabled className="data-[state=checked]:bg-primary" />
                        <span className="text-sm font-medium text-foreground">
                          {lote.competencia}
                        </span>
                        <Badge variant="outline" className="ml-auto text-xs">
                          {LOTE_STATUS_LABELS[lote.status] || lote.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <EditarEmpresaDialog
        empresa={empresaForEdit}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={handleEditSuccess}
      />
    </>
  );
};

export default EmpresaDetailDialog;
