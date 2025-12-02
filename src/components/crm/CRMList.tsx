import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmpresaCRM } from "@/types/crm";
import { formatTelefone, formatEmail } from "@/lib/validators";

interface CRMListProps {
  empresas: EmpresaCRM[];
  statusLabels: Record<string, string>;
  onSelectEmpresa: (empresa: EmpresaCRM) => void;
}

const STATUS_BADGE_VARIANTS: Record<string, string> = {
  sem_retorno: "bg-red-500/10 text-red-600 border-red-500/30 hover:bg-red-500/20",
  tratativa: "bg-amber-500/10 text-amber-600 border-amber-500/30 hover:bg-amber-500/20",
  contrato_assinado: "bg-blue-500/10 text-blue-600 border-blue-500/30 hover:bg-blue-500/20",
  apolices_emitida: "bg-purple-500/10 text-purple-600 border-purple-500/30 hover:bg-purple-500/20",
  acolhimento: "bg-cyan-500/10 text-cyan-600 border-cyan-500/30 hover:bg-cyan-500/20",
  empresa_ativa: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20",
};

const CRMList = ({ empresas, statusLabels, onSelectEmpresa }: CRMListProps) => {
  return (
    <div className="border rounded-lg bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="font-semibold">Nome</TableHead>
            <TableHead className="font-semibold">Responsável</TableHead>
            <TableHead className="font-semibold">Contato</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {empresas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                Nenhuma empresa encontrada
              </TableCell>
            </TableRow>
          ) : (
            empresas.map((empresa) => (
              <TableRow
                key={empresa.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => onSelectEmpresa(empresa)}
              >
                <TableCell>
                  <div>
                    <p className="font-medium text-foreground">{empresa.nome}</p>
                    <p className="text-sm text-muted-foreground">{empresa.cnpj}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <p className="text-sm text-foreground">
                    {empresa.nome_responsavel || (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </p>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    {(() => {
                      const emailsArray = empresa.emails_contato || [];
                      const allEmails = empresa.email_contato 
                        ? [empresa.email_contato, ...emailsArray] 
                        : emailsArray;
                      const uniqueEmails = Array.from(new Set(allEmails.filter(e => e && e.trim() !== "")));
                      
                      return uniqueEmails.length > 0 && (
                        <div className="space-y-0.5">
                          {uniqueEmails.slice(0, 2).map((email: string, idx: number) => (
                            <p key={idx} className={idx === 0 ? "text-sm text-foreground" : "text-xs text-muted-foreground"}>{formatEmail(email)}</p>
                          ))}
                          {uniqueEmails.length > 2 && (
                            <p className="text-xs text-muted-foreground">+{uniqueEmails.length - 2} mais</p>
                          )}
                        </div>
                      );
                    })()}
                    
                    {(() => {
                      const telefonesArray = empresa.telefones_contato || [];
                      const allTelefones = empresa.telefone_contato 
                        ? [empresa.telefone_contato, ...telefonesArray] 
                        : telefonesArray;
                      const uniqueTelefones = Array.from(new Set(allTelefones.filter(t => t && t.trim() !== "")));
                      
                      return uniqueTelefones.length > 0 && (
                        <div className="space-y-0.5">
                          {uniqueTelefones.slice(0, 2).map((tel: string, idx: number) => (
                            <p key={idx} className="text-sm text-muted-foreground">{formatTelefone(tel)}</p>
                          ))}
                          {uniqueTelefones.length > 2 && (
                            <p className="text-xs text-muted-foreground">+{uniqueTelefones.length - 2} mais</p>
                          )}
                        </div>
                      );
                    })()}
                    
                    {(() => {
                      const emailsArray = empresa.emails_contato || [];
                      const telefonesArray = empresa.telefones_contato || [];
                      const allEmails = empresa.email_contato ? [empresa.email_contato, ...emailsArray] : emailsArray;
                      const allTelefones = empresa.telefone_contato ? [empresa.telefone_contato, ...telefonesArray] : telefonesArray;
                      const hasAnyContact = allEmails.some(e => e && e.trim() !== "") || allTelefones.some(t => t && t.trim() !== "");
                      
                      return !hasAnyContact && <p className="text-sm text-muted-foreground">-</p>;
                    })()}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge 
                    variant="outline" 
                    className={STATUS_BADGE_VARIANTS[empresa.status_crm]}
                  >
                    {statusLabels[empresa.status_crm]}
                  </Badge>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default CRMList;
