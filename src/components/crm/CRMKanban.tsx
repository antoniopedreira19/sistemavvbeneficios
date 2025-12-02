import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Mail, Phone } from "lucide-react";
import { EmpresaCRM } from "@/types/crm";
import { formatTelefone, formatEmail } from "@/lib/validators";

interface CRMKanbanProps {
  empresasByStatus: Record<string, EmpresaCRM[]>;
  statusLabels: Record<string, string>;
  onSelectEmpresa: (empresa: EmpresaCRM) => void;
  onUpdateStatus: (empresaId: string, newStatus: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  sem_retorno: "bg-red-500/10 border-red-500/30 text-red-600",
  tratativa: "bg-amber-500/10 border-amber-500/30 text-amber-600",
  contrato_assinado: "bg-blue-500/10 border-blue-500/30 text-blue-600",
  apolices_emitida: "bg-purple-500/10 border-purple-500/30 text-purple-600",
  acolhimento: "bg-cyan-500/10 border-cyan-500/30 text-cyan-600",
  empresa_ativa: "bg-emerald-500/10 border-emerald-500/30 text-emerald-600",
};

const HEADER_COLORS: Record<string, string> = {
  sem_retorno: "bg-red-500",
  tratativa: "bg-amber-500",
  contrato_assinado: "bg-blue-500",
  apolices_emitida: "bg-purple-500",
  acolhimento: "bg-cyan-500",
  empresa_ativa: "bg-emerald-500",
};

const CRMKanban = ({
  empresasByStatus,
  statusLabels,
  onSelectEmpresa,
  onUpdateStatus,
}: CRMKanbanProps) => {
  const statusOrder = [
    "sem_retorno",
    "tratativa",
    "contrato_assinado",
    "apolices_emitida",
    "acolhimento",
    "empresa_ativa",
  ];

  const handleDragStart = (e: React.DragEvent, empresaId: string) => {
    e.dataTransfer.setData("empresaId", empresaId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const empresaId = e.dataTransfer.getData("empresaId");
    if (empresaId) {
      onUpdateStatus(empresaId, newStatus);
    }
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      {statusOrder.map((status) => (
        <div
          key={status}
          className="flex-shrink-0 w-72"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, status)}
        >
          <div className="bg-muted/50 rounded-lg border border-border overflow-hidden">
            <div className={`${HEADER_COLORS[status]} px-4 py-3`}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white text-sm">
                  {statusLabels[status]}
                </h3>
                <Badge variant="secondary" className="bg-white/20 text-white border-0">
                  {empresasByStatus[status]?.length || 0}
                </Badge>
              </div>
            </div>

            <div className="h-[calc(100vh-320px)] min-h-[400px] overflow-y-auto">
              <div className="p-3 space-y-2">
                {empresasByStatus[status]?.map((empresa) => (
                  <Card
                    key={empresa.id}
                    className="cursor-pointer hover:shadow-md transition-all duration-200 hover:border-primary/50"
                    draggable
                    onDragStart={(e) => handleDragStart(e, empresa.id)}
                    onClick={() => onSelectEmpresa(empresa)}
                  >
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <h4 className="font-medium text-xs text-foreground break-words leading-tight">
                            {empresa.nome}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            {empresa.cnpj}
                          </p>
                        </div>
                      </div>

                      {(() => {
                        const emailsArray: string[] = empresa.emails_contato || [];
                        const allEmails = empresa.email_contato 
                          ? [empresa.email_contato, ...emailsArray] 
                          : emailsArray;
                        const uniqueEmails: string[] = Array.from(new Set(allEmails.filter((e: string) => e && e.trim() !== "")));
                        
                        if (uniqueEmails.length === 0) return null;
                        
                        return (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Mail className="h-3 w-3 shrink-0" />
                              <span className="truncate">{formatEmail(uniqueEmails[0])}</span>
                            </div>
                            {uniqueEmails.length > 1 && (
                              <p className="text-xs text-muted-foreground pl-5">+{uniqueEmails.length - 1} mais</p>
                            )}
                          </div>
                        );
                      })()}

                      {(() => {
                        const telefonesArray: string[] = empresa.telefones_contato || [];
                        const allTelefones = empresa.telefone_contato 
                          ? [empresa.telefone_contato, ...telefonesArray] 
                          : telefonesArray;
                        const uniqueTelefones: string[] = Array.from(new Set(allTelefones.filter((t: string) => t && t.trim() !== "")));
                        
                        if (uniqueTelefones.length === 0) return null;
                        
                        return (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3 shrink-0" />
                              <span>{formatTelefone(uniqueTelefones[0])}</span>
                            </div>
                            {uniqueTelefones.length > 1 && (
                              <p className="text-xs text-muted-foreground pl-5">+{uniqueTelefones.length - 1} mais</p>
                            )}
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                ))}

                {(!empresasByStatus[status] || empresasByStatus[status].length === 0) && (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    Nenhuma empresa
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default CRMKanban;
