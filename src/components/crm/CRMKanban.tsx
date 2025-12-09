import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { User, Mail, Phone, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { EmpresaCRM, CRM_STATUS_LABELS, CRM_FUNNEL_STATUSES } from "@/types/crm";
import EmpresaDetailDialog from "./EmpresaDetailDialog";
import { UploadContratoDialog } from "./UploadContratoDialog";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";

const CRM_COLUMNS = [
  { id: "sem_retorno", title: "Sem Retorno", color: "bg-slate-500" },
  { id: "tratativa", title: "Em Tratativa", color: "bg-amber-500" },
  { id: "contrato_assinado", title: "Contrato Assinado", color: "bg-blue-500" },
  { id: "apolices_emitida", title: "Apólices Emitida", color: "bg-purple-500" },
  { id: "acolhimento", title: "Acolhimento", color: "bg-teal-500" },
];

const formatCNPJ = (val: string) =>
  val?.replace(/\D/g, "").replace(/^(\d{2})(\d{3})?(\d{3})?(\d{4})?(\d{2})?/, "$1.$2.$3/$4-$5") || "";

const formatPhone = (val: string) => {
  if (!val) return null;
  const digits = val.replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return val;
};

const getInitials = (name: string) => name?.substring(0, 2).toUpperCase() || "??";

interface KanbanCardProps {
  empresa: EmpresaCRM;
  onClick: () => void;
}

function KanbanCard({ empresa, onClick }: KanbanCardProps) {
  return (
    <Card onClick={onClick} className="p-3 bg-card border shadow-sm cursor-pointer select-none">
      <div className="flex items-center gap-2 mb-2">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
            {getInitials(empresa.nome)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm text-foreground truncate leading-tight">{empresa.nome}</p>
          <p className="text-[10px] text-muted-foreground font-mono">{formatCNPJ(empresa.cnpj)}</p>
        </div>
      </div>

      <div className="space-y-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 truncate">
          <User className="h-3 w-3 shrink-0" />
          <span className="truncate">{empresa.nome_responsavel || "Sem responsável"}</span>
        </div>
        <div className="flex items-center gap-1.5 truncate">
          <Mail className="h-3 w-3 shrink-0" />
          <span className="truncate">{empresa.email_contato?.toLowerCase() || "Sem email"}</span>
        </div>
        {empresa.telefone_contato && (
          <div className="flex items-center gap-1.5 truncate">
            <Phone className="h-3 w-3 shrink-0" />
            <span className="truncate">{formatPhone(empresa.telefone_contato)}</span>
          </div>
        )}
      </div>
    </Card>
  );
}

export function CRMKanban() {
  const queryClient = useQueryClient();
  const [selectedEmpresa, setSelectedEmpresa] = useState<EmpresaCRM | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [empresaParaContrato, setEmpresaParaContrato] = useState<EmpresaCRM | null>(null);
  const [pendingDragResult, setPendingDragResult] = useState<DropResult | null>(null);

  // Realtime subscription for empresas
  useRealtimeSubscription({
    table: 'empresas',
    queryKeys: ['empresas-ativas', 'empresas-inativas', 'crm-empresas', 'empresas-crm'],
  });

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -300, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 300, behavior: "smooth" });
    }
  };

  const { data: empresas = [], isLoading } = useQuery({
    queryKey: ["empresas-crm"],
    queryFn: async () => {
      const statusList: ("sem_retorno" | "tratativa" | "contrato_assinado" | "apolices_emitida" | "acolhimento")[] = 
        ['sem_retorno', 'tratativa', 'contrato_assinado', 'apolices_emitida', 'acolhimento'];
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome, cnpj, email_contato, telefone_contato, nome_responsavel, status, emails_contato, telefones_contato, contrato_url, created_at")
        .in("status", statusList)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as EmpresaCRM[];
    },
  });

  // Filter empresas by search term
  const filteredEmpresas = useMemo(() => {
    if (!searchTerm.trim()) return empresas;
    const term = searchTerm.toLowerCase().replace(/\D/g, "");
    const termText = searchTerm.toLowerCase();
    return empresas.filter(
      (e) =>
        e.nome.toLowerCase().includes(termText) ||
        e.cnpj.replace(/\D/g, "").includes(term) ||
        e.cnpj.includes(searchTerm),
    );
  }, [empresas, searchTerm]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("empresas").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["empresas-crm"] });
      toast.error("Erro ao atualizar status");
    },
  });

  const executeDragUpdate = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    const newStatus = destination.droppableId;

    // Optimistic update with correct positioning
    queryClient.setQueryData<EmpresaCRM[]>(["empresas-crm"], (old) => {
      if (!old) return old;

      const updated = [...old];
      const movedEmpresa = updated.find((e) => e.id === draggableId);
      if (!movedEmpresa) return old;

      // Update the status
      movedEmpresa.status = newStatus as EmpresaCRM["status"];

      // Get items in destination column (excluding the moved item)
      const destItems = updated.filter((e) => e.status === newStatus && e.id !== draggableId);

      // Build new array maintaining order
      const resultArray: EmpresaCRM[] = [];

      for (const column of CRM_COLUMNS) {
        const columnItems =
          column.id === newStatus
            ? [...destItems.slice(0, destination.index), movedEmpresa, ...destItems.slice(destination.index)]
            : updated.filter((e) => e.status === column.id && e.id !== draggableId);

        resultArray.push(...columnItems);
      }

      return resultArray;
    });

    // Fire mutation
    updateStatusMutation.mutate({
      id: draggableId,
      status: newStatus,
    });
  };

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStatus = destination.droppableId;
    const empresa = filteredEmpresas.find((e) => e.id === draggableId);

    // Se está indo para "contrato_assinado", abre modal de upload
    if (newStatus === "contrato_assinado" && source.droppableId !== "contrato_assinado" && empresa) {
      setEmpresaParaContrato(empresa);
      setPendingDragResult(result);
      setUploadDialogOpen(true);
      return;
    }

    executeDragUpdate(result);
  };

  const handleUploadSuccess = () => {
    if (pendingDragResult) {
      executeDragUpdate(pendingDragResult);
      setPendingDragResult(null);
    }
    setEmpresaParaContrato(null);
    queryClient.invalidateQueries({ queryKey: ["empresas-crm"] });
  };

  const handleUploadCancel = () => {
    setPendingDragResult(null);
    setEmpresaParaContrato(null);
  };

  const getColumnEmpresas = (statusId: string) => {
    return filteredEmpresas.filter((e) => e.status === statusId);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="w-72 h-10 bg-muted rounded animate-pulse" />
        <div className="flex gap-3 overflow-x-auto pb-4">
          {CRM_COLUMNS.map((col) => (
            <div key={col.id} className="min-w-[280px] bg-muted/30 rounded-lg p-3 animate-pulse">
              <div className="h-5 bg-muted rounded w-24 mb-3" />
              <div className="space-y-2">
                <div className="h-24 bg-muted rounded" />
                <div className="h-24 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Search Bar and Navigation */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou CNPJ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Scroll Navigation Buttons */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={scrollLeft} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={scrollRight} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div
          ref={scrollContainerRef}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              scrollLeft();
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              scrollRight();
            }
          }}
          className="flex gap-3 overflow-x-auto pb-4 scroll-smooth focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-lg"
          style={{ scrollbarWidth: "thin" }}
        >
          {CRM_COLUMNS.map((column) => {
            const columnEmpresas = getColumnEmpresas(column.id);
            return (
              <div key={column.id} className="min-w-[280px] w-[280px] flex-shrink-0">
                {/* Column Header */}
                <div className="flex items-center gap-2 mb-2 px-1">
                  <div className={`w-2.5 h-2.5 rounded-full ${column.color}`} />
                  <h3 className="font-medium text-sm text-foreground">{column.title}</h3>
                  <Badge variant="secondary" className="ml-auto text-xs h-5 px-1.5">
                    {columnEmpresas.length}
                  </Badge>
                </div>

                {/* Droppable Area */}
                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`
                        min-h-[400px] p-2 rounded-lg border transition-colors
                        ${snapshot.isDraggingOver ? "bg-primary/5 border-primary/30" : "bg-muted/20 border-border/50"}
                      `}
                    >
                      <div className="space-y-2">
                        {columnEmpresas.map((empresa, index) => (
                          <Draggable key={empresa.id} draggableId={empresa.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                style={provided.draggableProps.style}
                                className={snapshot.isDragging ? "opacity-90" : ""}
                              >
                                <KanbanCard
                                  empresa={empresa}
                                  onClick={() => !snapshot.isDragging && setSelectedEmpresa(empresa)}
                                />
                              </div>
                            )}
                          </Draggable>
                        ))}
                      </div>
                      {provided.placeholder}
                      {columnEmpresas.length === 0 && !snapshot.isDraggingOver && (
                        <p className="text-center text-muted-foreground text-xs py-8">Nenhuma empresa</p>
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
          // Se está mudando para "contrato_assinado", abre modal de upload
          const empresa = filteredEmpresas.find((e) => e.id === empresaId);
          if (newStatus === "contrato_assinado" && empresa?.status !== "contrato_assinado" && empresa) {
            setEmpresaParaContrato(empresa);
            setPendingDragResult({
              destination: { droppableId: newStatus, index: 0 },
              source: { droppableId: empresa.status, index: 0 },
              draggableId: empresaId,
              type: "DEFAULT",
              mode: "FLUID",
              reason: "DROP",
              combine: null,
            });
            setUploadDialogOpen(true);
            setSelectedEmpresa(null);
            return;
          }
          
          queryClient.setQueryData<EmpresaCRM[]>(["empresas-crm"], (old) => {
            if (!old) return old;
            return old.map((e) => (e.id === empresaId ? { ...e, status: newStatus as any } : e));
          });
          updateStatusMutation.mutate({ id: empresaId, status: newStatus });
        }}
        onEmpresaUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ["empresas-crm"] });
        }}
      />

      <UploadContratoDialog
        open={uploadDialogOpen}
        onOpenChange={(open) => {
          setUploadDialogOpen(open);
          if (!open) handleUploadCancel();
        }}
        empresaId={empresaParaContrato?.id || ""}
        empresaNome={empresaParaContrato?.nome || ""}
        onSuccess={handleUploadSuccess}
      />
    </>
  );
}
