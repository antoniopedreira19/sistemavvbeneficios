import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  closestCenter,
  DragStartEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects,
  DropAnimation,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import {
  Loader2,
  Calendar,
  User,
  Mail,
  PhoneMissed,
  MessageSquare,
  FileSignature,
  ShieldCheck,
  Handshake,
  PartyPopper,
  ChevronLeft,
  ChevronRight,
  Building2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EditarEmpresaDialog } from "@/components/admin/EditarEmpresaDialog";

// Configuração das Colunas
const COLUMNS = {
  sem_retorno: {
    title: "Sem Retorno",
    color: "border-slate-200 bg-slate-50/50",
    headerColor: "text-slate-600 bg-slate-100",
    icon: PhoneMissed,
  },
  tratativa: {
    title: "Em Tratativa",
    color: "border-blue-200 bg-blue-50/50",
    headerColor: "text-blue-600 bg-blue-100",
    icon: MessageSquare,
  },
  contrato_assinado: {
    title: "Contrato Assinado",
    color: "border-purple-200 bg-purple-50/50",
    headerColor: "text-purple-600 bg-purple-100",
    icon: FileSignature,
  },
  apolices_emitida: {
    title: "Apólices Emitidas",
    color: "border-indigo-200 bg-indigo-50/50",
    headerColor: "text-indigo-600 bg-indigo-100",
    icon: ShieldCheck,
  },
  acolhimento: {
    title: "Acolhimento",
    color: "border-orange-200 bg-orange-50/50",
    headerColor: "text-orange-600 bg-orange-100",
    icon: Handshake,
  },
  empresa_ativa: {
    title: "Ativar Cliente",
    color: "border-green-300 bg-green-50/80 dashed border-2",
    headerColor: "text-green-700 bg-green-100",
    icon: PartyPopper,
  },
};

type CRMStatus = keyof typeof COLUMNS;

// --- COMPONENTE CARD (Draggable) ---
function KanbanCard({ empresa, isOverlay = false, onClick, onAtivar }: any) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
    id: empresa.id,
    data: { empresa },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.3 : 1,
  };

  // Se for overlay, usamos um ref normal (não do sortable)
  const ref = isOverlay ? null : setNodeRef;
  const props = isOverlay ? {} : { ...attributes, ...listeners, style };

  const formatCNPJ = (val: string) =>
    val.replace(/\D/g, "").replace(/^(\d{2})(\d{3})?(\d{3})?(\d{4})?(\d{2})?/, "$1.$2.$3/$4-$5");
  const getInitials = (n: string) => n.substring(0, 2).toUpperCase();

  return (
    <div ref={ref} {...props} className="touch-none">
      <Card
        onClick={onClick}
        className={`
          bg-white border-none shadow-sm cursor-grab group relative transition-all duration-200
          ${isOverlay ? "shadow-2xl rotate-2 scale-105 z-50 ring-2 ring-primary cursor-grabbing" : "hover:shadow-md hover:-translate-y-0.5"}
        `}
      >
        <CardContent className="p-4 space-y-4">
          {/* Header */}
          <div className="flex justify-between items-start gap-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9 border border-slate-100">
                <AvatarFallback className="bg-slate-100 text-slate-600 text-xs font-bold">
                  {getInitials(empresa.nome)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-0.5">
                <span className="font-semibold text-sm line-clamp-1 text-slate-900">{empresa.nome}</span>
                {empresa.nome_responsavel && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <User className="h-3 w-3" /> {empresa.nome_responsavel}
                  </div>
                )}
              </div>
            </div>
            {/* Botão Ativar */}
            {onAtivar && !isOverlay && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50 -mt-1 -mr-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onAtivar();
                }}
                onPointerDown={(e) => e.stopPropagation()} // Importante para não draggar
              >
                <PartyPopper className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Info */}
          <div className="space-y-2 bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="truncate font-mono">{formatCNPJ(empresa.cnpj)}</span>
            </div>
            {empresa.email_contato && (
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="truncate">{empresa.email_contato}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium bg-white px-2 py-1 rounded-full border border-slate-100">
              <Calendar className="h-3 w-3" />
              {formatDistanceToNow(new Date(empresa.created_at), { locale: ptBR, addSuffix: true })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// --- COMPONENTE PRINCIPAL ---
export function CRMKanban() {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [empresaParaEditar, setEmpresaParaEditar] = useState<any | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { data: empresas = [], isLoading } = useQuery({
    queryKey: ["crm-empresas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("*")
        .eq("status", "em_implementacao")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const moveCardMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      const { error } = await supabase.from("empresas").update({ status_crm: newStatus }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, newStatus }) => {
      await queryClient.cancelQueries({ queryKey: ["crm-empresas"] });
      const previous = queryClient.getQueryData(["crm-empresas"]);
      queryClient.setQueryData(["crm-empresas"], (old: any[]) =>
        old.map((e) => (e.id === id ? { ...e, status_crm: newStatus } : e)),
      );
      return { previous };
    },
    onError: (err, vars, context: any) => queryClient.setQueryData(["crm-empresas"], context.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["crm-empresas"] }),
  });

  const ativarEmpresaMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("empresas")
        .update({ status: "ativa", status_crm: "empresa_ativa" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-empresas"] });
      queryClient.invalidateQueries({ queryKey: ["empresas-ativas"] });
      toast.success("Empresa ativada!");
    },
  });

  const handleDragStart = (event: DragStartEvent) => setActiveId(event.active.id as string);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    if (over.id === "empresa_ativa") {
      ativarEmpresaMutation.mutate(active.id as string);
    } else if (Object.keys(COLUMNS).includes(over.id as string)) {
      if (active.data.current?.empresa.status_crm !== over.id) {
        moveCardMutation.mutate({ id: active.id as string, newStatus: over.id as string });

        // Abre modal se for contrato assinado
        if (over.id === "contrato_assinado") {
          const emp = empresas.find((e: any) => e.id === active.id);
          if (emp) {
            setEmpresaParaEditar(emp);
            toast.info("Anexe o contrato assinado.");
          }
        }
      }
    }
  };

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: direction === "left" ? -350 : 350, behavior: "smooth" });
    }
  };

  const activeEmpresa = activeId ? empresas.find((e: any) => e.id === activeId) : null;
  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.5" } } }),
  };

  if (isLoading)
    return (
      <div className="flex justify-center p-20">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );

  return (
    <div className="relative h-[calc(100vh-220px)] w-full group">
      <Button
        variant="secondary"
        size="icon"
        className="absolute left-2 top-1/2 -translate-y-1/2 z-10 shadow-lg bg-white/90 hover:bg-white border opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => scroll("left")}
      >
        <ChevronLeft className="h-6 w-6 text-slate-700" />
      </Button>
      <Button
        variant="secondary"
        size="icon"
        className="absolute right-2 top-1/2 -translate-y-1/2 z-10 shadow-lg bg-white/90 hover:bg-white border opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => scroll("right")}
      >
        <ChevronRight className="h-6 w-6 text-slate-700" />
      </Button>

      <div ref={scrollContainerRef} className="h-full overflow-x-auto pb-4 px-1" style={{ scrollbarWidth: "none" }}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 min-w-max h-full">
            {(Object.keys(COLUMNS) as Array<keyof typeof COLUMNS>).map((colId) => {
              const col = COLUMNS[colId];
              const Icon = col.icon;
              const isFinal = colId === "empresa_ativa";
              const colItems = empresas.filter((e: any) => (e.status_crm || "sem_retorno") === colId);

              return (
                <div key={colId} className="w-[340px] shrink-0 flex flex-col h-full">
                  <div
                    className={`p-4 rounded-t-xl border-b flex justify-between items-center bg-white shadow-sm mb-3 ${col.color.replace("bg-", "border-")}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-md ${col.headerColor}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <h3 className="font-bold text-sm uppercase text-slate-700">{col.title}</h3>
                    </div>
                    {!isFinal && (
                      <Badge variant="secondary" className="bg-slate-100 text-slate-600">
                        {colItems.length}
                      </Badge>
                    )}
                  </div>

                  <Droppable droppableId={colId}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 p-2 rounded-xl border transition-colors duration-200 overflow-y-auto space-y-4 ${col.color} ${snapshot.isDraggingOver ? "bg-white/50 ring-2 ring-primary/50" : ""} ${isFinal ? "flex items-center justify-center cursor-pointer opacity-90 hover:opacity-100" : ""}`}
                      >
                        {isFinal ? (
                          <div className="text-center text-green-700 p-6 border-2 border-dashed border-green-400 rounded-xl bg-green-50 w-full flex flex-col items-center gap-3">
                            <div className="bg-green-100 p-3 rounded-full">
                              <PartyPopper className="h-8 w-8 animate-pulse text-green-600" />
                            </div>
                            <span className="text-sm font-medium">Solte aqui para Ativar</span>
                          </div>
                        ) : (
                          <SortableContext
                            items={colItems.map((e: any) => e.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            {colItems.map((empresa: any) => (
                              <KanbanCard
                                key={empresa.id}
                                empresa={empresa}
                                onClick={() => setEmpresaParaEditar(empresa)}
                                onAtivar={
                                  colId === "acolhimento" ? () => ativarEmpresaMutation.mutate(empresa.id) : undefined
                                }
                              />
                            ))}
                          </SortableContext>
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
          <DragOverlay dropAnimation={dropAnimation}>
            {activeEmpresa ? (
              <div className="rotate-2 cursor-grabbing">
                <KanbanCard empresa={activeEmpresa} isOverlay />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {empresaParaEditar && (
        <EditarEmpresaDialog
          open={!!empresaParaEditar}
          onOpenChange={(open) => !open && setEmpresaParaEditar(null)}
          empresa={empresaParaEditar}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["crm-empresas"] })}
        />
      )}
    </div>
  );
}
