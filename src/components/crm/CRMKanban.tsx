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
  PhoneMissed,
  MessageSquare,
  FileSignature,
  ShieldCheck,
  Handshake,
  PartyPopper,
  ChevronLeft,
  ChevronRight,
  Building,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// Configuração Visual Rica das Colunas
const COLUMNS = {
  sem_retorno: {
    title: "Sem Retorno",
    color: "border-slate-300 bg-slate-50",
    headerColor: "text-slate-700",
    icon: PhoneMissed,
  },
  tratativa: {
    title: "Em Tratativa",
    color: "border-blue-300 bg-blue-50",
    headerColor: "text-blue-700",
    icon: MessageSquare,
  },
  contrato_assinado: {
    title: "Contrato Assinado",
    color: "border-purple-300 bg-purple-50",
    headerColor: "text-purple-700",
    icon: FileSignature,
  },
  apolices_emitida: {
    title: "Apólices Emitidas",
    color: "border-indigo-300 bg-indigo-50",
    headerColor: "text-indigo-700",
    icon: ShieldCheck,
  },
  acolhimento: {
    title: "Acolhimento",
    color: "border-orange-300 bg-orange-50",
    headerColor: "text-orange-700",
    icon: Handshake,
  },
  // Nova Coluna Final
  empresa_ativa: {
    title: "Ativar Cliente",
    color: "border-green-400 bg-green-50/80 dashed border-2", // Visual diferente para indicar "Final"
    headerColor: "text-green-700",
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

  // Busca empresas
  const { data: empresas, isLoading } = useQuery({
    queryKey: ["crm-empresas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("*")
        .eq("status", "em_implementacao") // Traz apenas quem está no CRM
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Mutação: Mover Card (Apenas troca de coluna no CRM)
  const moveCardMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      const { error } = await supabase.from("empresas").update({ status_crm: newStatus }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm-empresas"] }),
    onError: () => toast.error("Erro ao mover empresa"),
  });

  // Mutação: ATIVAR EMPRESA (Drop na última coluna)
  const ativarEmpresaMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("empresas")
        .update({
          status: "ativa",
          status_crm: "empresa_ativa",
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-empresas"] });
      queryClient.invalidateQueries({ queryKey: ["empresas-ativas"] }); // Atualiza a aba de lista
      toast.success("Empresa ativada! Movida para carteira de clientes.");
    },
    onError: () => toast.error("Erro ao ativar empresa"),
  });

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { draggableId, destination, source } = result;

    // Se soltou no mesmo lugar, não faz nada
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    // LÓGICA DE DROP:
    // Se soltou na coluna "empresa_ativa", ativamos a empresa.
    if (destination.droppableId === "empresa_ativa") {
      ativarEmpresaMutation.mutate(draggableId);
    } else {
      // Caso contrário, apenas move dentro do CRM
      moveCardMutation.mutate({ id: draggableId, newStatus: destination.droppableId });
    }
  };

  // Funções de Scroll Manual
  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 340; // Largura da coluna + gap
      scrollContainerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  if (isLoading)
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  if (!enabled) return null;

  const columnsList = Object.keys(COLUMNS) as CRMStatus[];

  // Agrupamento
  const groupedData = columnsList.reduce(
    (acc, col) => {
      // Filtra empresas para cada coluna.
      // Nota: A coluna 'empresa_ativa' sempre estará vazia na renderização inicial
      // pois o filtro da query pega apenas 'em_implementacao'.
      // Ela serve apenas como Zona de Drop.
      acc[col] = empresas?.filter((e) => (e.status_crm || "sem_retorno") === col) || [];
      return acc;
    },
    {} as Record<CRMStatus, typeof empresas>,
  );

  return (
    <div className="relative h-[calc(100vh-220px)] w-full group">
      {/* Botão Scroll Esquerda */}
      <Button
        variant="secondary"
        size="icon"
        className="absolute left-2 top-1/2 -translate-y-1/2 z-10 shadow-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 hover:bg-white"
        onClick={() => scroll("left")}
      >
        <ChevronLeft className="h-6 w-6 text-slate-700" />
      </Button>

      {/* Botão Scroll Direita */}
      <Button
        variant="secondary"
        size="icon"
        className="absolute right-2 top-1/2 -translate-y-1/2 z-10 shadow-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 hover:bg-white"
        onClick={() => scroll("right")}
      >
        <ChevronRight className="h-6 w-6 text-slate-700" />
      </Button>

      {/* Container do Kanban (Scroll Hidden) */}
      <div
        ref={scrollContainerRef}
        className="h-full overflow-x-auto pb-4 px-1"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }} // Esconde scrollbar nativa
      >
        <style>{`
          .hide-scrollbar::-webkit-scrollbar { display: none; }
        `}</style>

        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-4 min-w-max h-full hide-scrollbar">
            {columnsList.map((columnId) => {
              const colConfig = COLUMNS[columnId];
              const Icon = colConfig.icon;
              const isFinalColumn = columnId === "empresa_ativa";

              return (
                <div key={columnId} className="w-[340px] shrink-0 flex flex-col h-full">
                  {/* Header da Coluna */}
                  <div
                    className={`p-4 rounded-t-xl border-b-2 flex justify-between items-center bg-white shadow-sm mb-2 ${colConfig.color.replace("bg-", "border-b-").split(" ")[0]}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-md ${colConfig.color.split(" ")[1]}`}>
                        <Icon className={`h-4 w-4 ${colConfig.headerColor}`} />
                      </div>
                      <h3 className={`font-bold text-sm uppercase tracking-wide ${colConfig.headerColor}`}>
                        {colConfig.title}
                      </h3>
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
                          flex-1 p-2 rounded-xl border space-y-3 transition-all duration-200 overflow-y-auto
                          ${colConfig.color}
                          ${snapshot.isDraggingOver ? "ring-2 ring-primary/50 bg-white/50" : ""}
                          ${isFinalColumn ? "flex items-center justify-center opacity-70 hover:opacity-100" : ""}
                        `}
                      >
                        {/* Conteúdo Especial para Coluna Ativa */}
                        {isFinalColumn ? (
                          <div className="text-center text-green-600 p-4 border-2 border-dashed border-green-300 rounded-xl bg-green-50/50 w-full h-[150px] flex flex-col items-center justify-center gap-2">
                            <PartyPopper className="h-8 w-8 animate-bounce" />
                            <span className="text-sm font-medium">Solte aqui para Ativar</span>
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
                                  className={`
                                    cursor-grab active:cursor-grabbing border-l-4 transition-all duration-200 group
                                    hover:shadow-lg hover:-translate-y-1
                                    ${snapshot.isDragging ? "shadow-2xl ring-2 ring-primary rotate-2 scale-105 z-50" : "shadow-sm"}
                                    ${colConfig.color.split(" ")[0]}
                                  `}
                                >
                                  <CardContent className="p-4 space-y-3">
                                    {/* Header do Card */}
                                    <div className="flex justify-between items-start gap-3">
                                      <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8 border border-slate-200">
                                          <AvatarFallback
                                            className={`text-xs font-bold ${colConfig.headerColor.replace("text-", "bg-").replace("700", "100")}`}
                                          >
                                            {empresa.nome.substring(0, 2).toUpperCase()}
                                          </AvatarFallback>
                                        </Avatar>
                                        <div>
                                          <span className="font-semibold text-sm line-clamp-1 text-slate-800">
                                            {empresa.nome}
                                          </span>
                                          <span className="text-[10px] text-slate-500 font-mono">
                                            {empresa.cnpj.slice(0, 14)}...
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Dados de Contato */}
                                    <div className="space-y-1.5 pt-1 bg-white/50 p-2 rounded-md">
                                      <div className="flex items-center gap-2 text-xs text-slate-600">
                                        <User className="h-3 w-3 shrink-0 text-slate-400" />
                                        <span className="truncate">
                                          {empresa.nome_responsavel || "Sem responsável"}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2 text-xs text-slate-600">
                                        <Mail className="h-3 w-3 shrink-0 text-slate-400" />
                                        <span className="truncate">{empresa.email_contato || "Sem email"}</span>
                                      </div>
                                    </div>

                                    {/* Footer do Card */}
                                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] font-normal bg-white text-slate-500 border-slate-200"
                                      >
                                        <Building className="h-3 w-3 mr-1" />
                                        Obra Civil
                                      </Badge>

                                      <div
                                        className="flex items-center gap-1 text-[10px] text-slate-400 font-medium"
                                        title="Tempo no funil"
                                      >
                                        <Calendar className="h-3 w-3" />
                                        {formatDistanceToNow(new Date(empresa.created_at), {
                                          locale: ptBR,
                                          addSuffix: false,
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
