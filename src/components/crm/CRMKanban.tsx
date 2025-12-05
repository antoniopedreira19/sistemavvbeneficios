import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Loader2,
  Calendar,
  User,
  Mail,
  Phone,
  PhoneMissed,
  MessageSquare,
  FileSignature,
  ShieldCheck,
  Handshake,
  PartyPopper,
  ChevronLeft,
  ChevronRight,
  Building2,
  ArrowRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// Cores mais vivas e profissionais para as colunas
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

export function CRMKanban() {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const animation = requestAnimationFrame(() => setEnabled(true));
    return () => {
      cancelAnimationFrame(animation);
      setEnabled(false);
    };
  }, []);

  // Busca inicial
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

  // Mutação com Optimistic UI
  const moveCardMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      const { error } = await supabase.from("empresas").update({ status_crm: newStatus }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, newStatus }) => {
      await queryClient.cancelQueries({ queryKey: ["crm-empresas"] });
      const previousEmpresas = queryClient.getQueryData(["crm-empresas"]);

      queryClient.setQueryData(["crm-empresas"], (old: any[]) => {
        return old.map((empresa) => (empresa.id === id ? { ...empresa, status_crm: newStatus } : empresa));
      });

      return { previousEmpresas };
    },
    onError: (err, newTodo, context: any) => {
      queryClient.setQueryData(["crm-empresas"], context.previousEmpresas);
      toast.error("Erro ao mover empresa");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-empresas"] });
    },
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
      toast.success("Empresa ativada com sucesso!");
    },
    onError: () => toast.error("Erro ao ativar empresa"),
  });

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { draggableId, destination, source } = result;

    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    if (destination.droppableId === "empresa_ativa") {
      ativarEmpresaMutation.mutate(draggableId);
    } else {
      moveCardMutation.mutate({ id: draggableId, newStatus: destination.droppableId });
    }
  };

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 340;
      scrollContainerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const formatCNPJ = (value: string) => {
    return value.replace(/\D/g, "").replace(/^(\d{2})(\d{3})?(\d{3})?(\d{4})?(\d{2})?/, "$1.$2.$3/$4-$5");
  };

  if (isLoading)
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  if (!enabled) return null;

  const columnsList = Object.keys(COLUMNS) as CRMStatus[];

  const groupedData = columnsList.reduce(
    (acc, col) => {
      acc[col] = empresas.filter((e: any) => (e.status_crm || "sem_retorno") === col);
      return acc;
    },
    {} as Record<CRMStatus, any[]>,
  );

  return (
    <div className="relative h-[calc(100vh-220px)] w-full group">
      {/* Botões de Navegação (Scroll) */}
      <Button
        variant="secondary"
        size="icon"
        className="absolute left-2 top-1/2 -translate-y-1/2 z-10 shadow-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 hover:bg-white border"
        onClick={() => scroll("left")}
      >
        <ChevronLeft className="h-6 w-6 text-slate-700" />
      </Button>

      <Button
        variant="secondary"
        size="icon"
        className="absolute right-2 top-1/2 -translate-y-1/2 z-10 shadow-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 hover:bg-white border"
        onClick={() => scroll("right")}
      >
        <ChevronRight className="h-6 w-6 text-slate-700" />
      </Button>

      <div
        ref={scrollContainerRef}
        className="h-full overflow-x-auto pb-4 px-1"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-4 min-w-max h-full">
            {columnsList.map((columnId) => {
              const colConfig = COLUMNS[columnId];
              const Icon = colConfig.icon;
              const isFinalColumn = columnId === "empresa_ativa";

              return (
                <div key={columnId} className="w-[340px] shrink-0 flex flex-col h-full">
                  {/* Header da Coluna */}
                  <div
                    className={`p-4 rounded-t-xl border-b flex justify-between items-center bg-white shadow-sm mb-3 ${colConfig.color.replace("bg-", "border-")}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-md ${colConfig.headerColor}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <h3 className={`font-bold text-sm uppercase tracking-wide text-slate-700`}>{colConfig.title}</h3>
                    </div>
                    {!isFinalColumn && (
                      <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-mono">
                        {groupedData[columnId]?.length || 0}
                      </Badge>
                    )}
                  </div>

                  {/* Área Droppable */}
                  <Droppable droppableId={columnId}>
                    {(provided, snapshot) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={`
                          flex-1 p-2 rounded-xl border transition-colors duration-200 overflow-y-auto 
                          /* AUMENTO DO ESPAÇAMENTO AQUI (space-y-4) */
                          space-y-4 
                          ${colConfig.color}
                          ${snapshot.isDraggingOver ? "ring-2 ring-primary/50 bg-white/50" : ""}
                          ${isFinalColumn ? "flex items-center justify-center opacity-90 hover:opacity-100 cursor-pointer" : ""}
                        `}
                      >
                        {/* Drop Zone para Ativação */}
                        {isFinalColumn ? (
                          <div className="text-center text-green-700 p-6 border-2 border-dashed border-green-400 rounded-xl bg-green-50 w-full h-full flex flex-col items-center justify-center gap-3">
                            <div className="bg-green-100 p-3 rounded-full">
                              <PartyPopper className="h-8 w-8 text-green-600 animate-pulse" />
                            </div>
                            <span className="text-sm font-medium">Solte aqui para Ativar o Cliente</span>
                          </div>
                        ) : (
                          // Cards Normais
                          groupedData[columnId]?.map((empresa, index) => (
                            <Draggable key={empresa.id} draggableId={empresa.id} index={index}>
                              {(provided, snapshot) => (
                                <Card
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  // REMOVIDO: transition-all duration-200 (Causa do glitch)
                                  // ADICIONADO: hover apenas quando não está arrastando
                                  className={`
                                    cursor-grab active:cursor-grabbing border-none shadow-sm group relative
                                    ${
                                      snapshot.isDragging
                                        ? "shadow-2xl ring-2 ring-primary scale-105 z-50 opacity-90"
                                        : "hover:shadow-md hover:-translate-y-0.5 transition-transform duration-200"
                                    }
                                    bg-white
                                  `}
                                >
                                  <CardContent className="p-4 space-y-4">
                                    {/* Topo: Nome e Responsável */}
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex items-center gap-3">
                                        <Avatar className="h-9 w-9 border border-slate-100">
                                          <AvatarFallback className={`text-xs font-bold ${colConfig.headerColor}`}>
                                            {empresa.nome.substring(0, 2).toUpperCase()}
                                          </AvatarFallback>
                                        </Avatar>
                                        <div className="space-y-0.5">
                                          <span
                                            className="font-semibold text-sm line-clamp-1 text-slate-900"
                                            title={empresa.nome}
                                          >
                                            {empresa.nome}
                                          </span>
                                          {empresa.nome_responsavel && (
                                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                              <User className="h-3 w-3" />
                                              {empresa.nome_responsavel}
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* Botão de Ativar atalho (na última coluna) */}
                                      {columnId === "acolhimento" && (
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50 -mt-1 -mr-2"
                                          title="Finalizar e Ativar"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            ativarEmpresaMutation.mutate(empresa.id);
                                          }}
                                        >
                                          <ArrowRight className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>

                                    {/* Info de Contato (Email / Telefone) */}
                                    <div className="space-y-2 bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
                                      <div className="flex items-center gap-2 text-xs text-slate-600">
                                        <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                        <span className="truncate font-mono">{formatCNPJ(empresa.cnpj)}</span>
                                      </div>

                                      {empresa.email_contato && (
                                        <div className="flex items-center gap-2 text-xs text-slate-600">
                                          <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                          <span className="truncate" title={empresa.email_contato}>
                                            {empresa.email_contato}
                                          </span>
                                        </div>
                                      )}

                                      {empresa.telefone_contato && (
                                        <div className="flex items-center gap-2 text-xs text-slate-600">
                                          <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                          <span className="truncate">{empresa.telefone_contato}</span>
                                        </div>
                                      )}
                                    </div>

                                    {/* Footer: Data e Status */}
                                    <div className="flex items-center justify-between pt-1">
                                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium bg-white px-2 py-1 rounded-full border border-slate-100">
                                        <Calendar className="h-3 w-3" />
                                        {formatDistanceToNow(new Date(empresa.created_at), {
                                          locale: ptBR,
                                          addSuffix: true,
                                        })}
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              )}
                            </Draggable>
                          ))
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      </div>
    </div>
  );
}
