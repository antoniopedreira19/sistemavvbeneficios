import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar, User, Mail, ArrowRight, Building2, Phone } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { EmpresaCRM, CRM_STATUS_LABELS } from "@/types/crm";
import EmpresaDetailDialog from "./EmpresaDetailDialog";

const CRM_COLUMNS = [
  { id: "sem_retorno", title: "Sem Retorno", color: "bg-slate-500" },
  { id: "tratativa", title: "Em Tratativa", color: "bg-amber-500" },
  { id: "contrato_assinado", title: "Contrato Assinado", color: "bg-blue-500" },
  { id: "apolices_emitida", title: "Apólices Emitida", color: "bg-purple-500" },
  { id: "acolhimento", title: "Acolhimento", color: "bg-teal-500" },
  { id: "empresa_ativa", title: "Empresa Ativa", color: "bg-green-500" },
];

interface KanbanCardProps {
  empresa: EmpresaCRM;
  index: number;
  onClick: () => void;
}

function KanbanCard({ empresa, index, onClick }: KanbanCardProps) {
  const formatCNPJ = (val: string) =>
    val.replace(/\D/g, "").replace(/^(\d{2})(\d{3})?(\d{3})?(\d{4})?(\d{2})?/, "$1.$2.$3/$4-$5");
  const getInitials = (name: string) => name.substring(0, 2).toUpperCase();

  return (
    <Draggable draggableId={empresa.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          className="mb-3"
        >
          <Card
            className={`
              bg-card border-l-4 border-l-primary/30 cursor-grab
              ${snapshot.isDragging ? "shadow-xl ring-2 ring-primary/50" : "shadow-sm hover:shadow-md"}
            `}
            style={{
              transform: snapshot.isDragging ? undefined : "none",
            }}
          >
            <CardContent className="p-4 space-y-3">
              {/* Header */}
              <div className="flex justify-between items-start gap-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9 border border-border">
                    <AvatarFallback className="bg-muted text-muted-foreground text-xs font-bold">
                      {getInitials(empresa.nome)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-0.5">
                    <span className="font-semibold text-sm line-clamp-1 text-foreground leading-tight">
                      {empresa.nome}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono block">
                      {formatCNPJ(empresa.cnpj)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Contatos */}
              <div className="space-y-1.5 pt-1 bg-muted/50 p-2 rounded-md border border-border/50">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <User className="h-3 w-3 shrink-0" />
                  <span className="truncate">{empresa.nome_responsavel || "Sem responsável"}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Mail className="h-3 w-3 shrink-0" />
                  <span className="truncate">{empresa.email_contato || "Sem email"}</span>
                </div>
                {empresa.telefone_contato && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3 shrink-0" />
                    <span className="truncate">{empresa.telefone_contato}</span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="pt-2 border-t border-border flex items-center justify-between">
                <Badge
                  variant="outline"
                  className="text-[10px] h-5 font-normal bg-background text-muted-foreground border-border gap-1 px-1.5"
                >
                  <Building2 className="h-3 w-3" /> Lead
                </Badge>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                  <Calendar className="h-3 w-3" />
                  {formatDistanceToNow(new Date(empresa.created_at), { locale: ptBR, addSuffix: false })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </Draggable>
  );
}

export function CRMKanban() {
  const queryClient = useQueryClient();
  const [selectedEmpresa, setSelectedEmpresa] = useState<EmpresaCRM | null>(null);

  const { data: empresas = [], isLoading } = useQuery({
    queryKey: ["empresas-crm"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("*")
        .eq("status", "em_implementacao")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as EmpresaCRM[];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status_crm }: { id: string; status_crm: string }) => {
      const { error } = await supabase.from("empresas").update({ status_crm }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empresas-crm"] });
      toast.success("Status atualizado com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao atualizar status");
    },
  });

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    // Update status in database
    updateStatusMutation.mutate({
      id: draggableId,
      status_crm: destination.droppableId,
    });
  };

  const getColumnEmpresas = (statusId: string) => {
    return empresas.filter((e) => e.status_crm === statusId);
  };

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {CRM_COLUMNS.map((col) => (
          <div key={col.id} className="min-w-[300px] bg-muted/30 rounded-lg p-4 animate-pulse">
            <div className="h-6 bg-muted rounded w-24 mb-4" />
            <div className="space-y-3">
              <div className="h-32 bg-muted rounded" />
              <div className="h-32 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {CRM_COLUMNS.map((column) => {
            const columnEmpresas = getColumnEmpresas(column.id);
            return (
              <div key={column.id} className="min-w-[300px] flex-shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-3 h-3 rounded-full ${column.color}`} />
                  <h3 className="font-semibold text-sm text-foreground">{column.title}</h3>
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {columnEmpresas.length}
                  </Badge>
                </div>
                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`
                        min-h-[500px] p-3 rounded-lg border border-border
                        ${snapshot.isDraggingOver ? "bg-primary/5 border-primary/30" : "bg-muted/30"}
                      `}
                    >
                      {columnEmpresas.map((empresa, index) => (
                        <KanbanCard
                          key={empresa.id}
                          empresa={empresa}
                          index={index}
                          onClick={() => setSelectedEmpresa(empresa)}
                        />
                      ))}
                      {provided.placeholder}
                      {columnEmpresas.length === 0 && (
                        <div className="text-center text-muted-foreground text-sm py-8">
                          Nenhuma empresa
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      <EmpresaDetailDialog
        empresa={selectedEmpresa}
        open={!!selectedEmpresa}
        onOpenChange={(open) => !open && setSelectedEmpresa(null)}
        statusLabels={CRM_STATUS_LABELS}
        onUpdateStatus={(empresaId, newStatus) => {
          updateStatusMutation.mutate({ id: empresaId, status_crm: newStatus });
        }}
        onEmpresaUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ["empresas-crm"] });
        }}
      />
    </>
  );
}
