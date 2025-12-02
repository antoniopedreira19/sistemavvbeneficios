import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
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
import { Building2, Mail, Phone, FileText, User, Pencil, Calendar } from "lucide-react";
import { EmpresaCRM } from "@/pages/admin/CRM";
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
  sem_retorno: "bg-red-500/10 text-red-600 border-red-500/30",
  tratativa: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  contrato_assinado: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  apolices_emitida: "bg-purple-500/10 text-purple-600 border-purple-500/30",
  acolhimento: "bg-cyan-500/10 text-cyan-600 border-cyan-500/30",
  empresa_ativa: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
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

  // Convert EmpresaCRM to Empresa format for EditarEmpresaDialog
  const empresaForEdit = {
    id: empresa.id,
    nome: empresa.nome,
    cnpj: empresa.cnpj,
    email_contato: empresa.email_contato,
    telefone_contato: empresa.telefone_contato,
    nome_responsavel: empresa.nome_responsavel,
    status: "em_implementacao" as const,
    emails_contato: (empresa as any).emails_contato || [],
    telefones_contato: (empresa as any).telefones_contato || [],
  };

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
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditDialogOpen(true)}
                className="ml-2"
              >
                <Pencil className="h-4 w-4 mr-1" />
                Editar
              </Button>
            </DialogTitle>
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
                  const emailsArray = (empresa as any).emails_contato || [];
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
                  const telefonesArray = (empresa as any).telefones_contato || [];
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
            </div>

            <div className="border-t pt-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">
                  Status no CRM
                </Label>
                <Select value={empresa.status_crm} onValueChange={handleStatusChange}>
                  <SelectTrigger>
                    <SelectValue>
                      <Badge
                        variant="outline"
                        className={STATUS_BADGE_VARIANTS[empresa.status_crm]}
                      >
                        {statusLabels[empresa.status_crm]}
                      </Badge>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        <Badge
                          variant="outline"
                          className={STATUS_BADGE_VARIANTS[value]}
                        >
                          {label}
                        </Badge>
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
                          {lote.status === "concluido" ? "Concluído" : 
                           lote.status === "enviado" ? "Enviado" :
                           lote.status === "aprovado" ? "Aprovado" :
                           lote.status === "cotado" ? "Cotado" :
                           lote.status === "em_cotacao" ? "Em Cotação" :
                           lote.status === "aguardando_correcao" ? "Aguard. Correção" :
                           lote.status === "aguardando_finalizacao" ? "Aguard. Finalização" :
                           lote.status}
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
