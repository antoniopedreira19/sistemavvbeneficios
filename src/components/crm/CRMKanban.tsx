import { forwardRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar, User, Mail, ArrowRight, Building2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface KanbanCardProps {
  empresa: any;
  isOverlay?: boolean;
  onAtivar?: (id: string) => void;
  statusColor?: string; // Para colorir o avatar ou borda
  style?: React.CSSProperties;
  attributes?: any;
  listeners?: any;
}

export const KanbanCard = forwardRef<HTMLDivElement, KanbanCardProps>(
  ({ empresa, isOverlay, onAtivar, statusColor, style, attributes, listeners }, ref) => {
    // Formatação
    const formatCNPJ = (val: string) =>
      val.replace(/\D/g, "").replace(/^(\d{2})(\d{3})?(\d{3})?(\d{4})?(\d{2})?/, "$1.$2.$3/$4-$5");
    const getInitials = (name: string) => name.substring(0, 2).toUpperCase();

    return (
      <div ref={ref} style={style} {...attributes} {...listeners} className="touch-none">
        <Card
          className={`
          bg-white border-l-4 transition-shadow cursor-grab group relative
          ${isOverlay ? "shadow-2xl rotate-2 scale-105 z-50 cursor-grabbing ring-2 ring-primary" : "hover:shadow-md shadow-sm"}
        `}
          style={{ borderLeftColor: statusColor ? undefined : "transparent" }}
        >
          {/* Se tiver cor, aplica via style inline ou classe se preferir */}
          <CardContent className="p-4 space-y-3">
            {/* Header */}
            <div className="flex justify-between items-start gap-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9 border border-slate-100">
                  <AvatarFallback className={`${statusColor || "bg-slate-100 text-slate-600"} text-xs font-bold`}>
                    {getInitials(empresa.nome)}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-0.5">
                  <span className="font-semibold text-sm line-clamp-1 text-slate-900 leading-tight">
                    {empresa.nome}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono block">{formatCNPJ(empresa.cnpj)}</span>
                </div>
              </div>

              {/* Botão de Ativar (Apenas se passado e não for overlay) */}
              {onAtivar && !isOverlay && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50 -mt-1 -mr-2"
                  title="Ativar Cliente"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAtivar(empresa.id);
                  }}
                  onPointerDown={(e) => e.stopPropagation()} // Impede drag ao clicar no botão
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Contatos */}
            <div className="space-y-1.5 pt-1 bg-slate-50/50 p-2 rounded-md border border-slate-100/50">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <User className="h-3 w-3 shrink-0 text-slate-400" />
                <span className="truncate">{empresa.nome_responsavel || "Sem responsável"}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Mail className="h-3 w-3 shrink-0 text-slate-400" />
                <span className="truncate">{empresa.email_contato || "Sem email"}</span>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <Badge
                variant="outline"
                className="text-[10px] h-5 font-normal bg-white text-slate-500 border-slate-200 gap-1 px-1.5"
              >
                <Building2 className="h-3 w-3" /> Obra
              </Badge>
              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                <Calendar className="h-3 w-3" />
                {formatDistanceToNow(new Date(empresa.created_at), { locale: ptBR, addSuffix: false })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  },
);

KanbanCard.displayName = "KanbanCard";
