import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Calendar, User, Mail, ArrowRight, GripVertical } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

// Configuração Visual das Colunas
const COLUMNS = {
  sem_retorno: { title: "Sem Retorno", color: "border-gray-300 bg-gray-50/50" },
  tratativa: { title: "Em Tratativa", color: "border-blue-300 bg-blue-50/50" },
  contrato_assinado: { title: "Contrato Assinado", color: "border-purple-300 bg-purple-50/50" },
  apolices_emitida: { title: "Apólices Emitidas", color: "border-indigo-300 bg-indigo-50/50" },
  acolhimento: { title: "Acolhimento", color: "border-orange-300 bg-orange-50/50" },
};

type CRMStatus = keyof typeof COLUMNS;

export function CRMKanban() {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(false);

  // Fix para StrictMode do React com Drag&Drop
  useEffect(() => {
    const animation = requestAnimationFrame(() => setEnabled(true));
    return () => {
      cancelAnimationFrame(animation);
      setEnabled(false);
    };
  }, []);

  // Busca empresas em implementação
  const { data: empresas, isLoading } = useQuery({
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

  // Mutação: Mover Card
  const moveCardMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      const { error } = await supabase.from("empresas").update({ status_crm: newStatus }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm-empresas"] }),
    onError: () => toast.error("Erro ao mover empresa"),
  });

  // Mutação: Ativar Empresa (Sair do CRM)
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
      toast.success("Empresa ativada com sucesso! Movida para carteira.");
    },
    onError: () => toast.error("Erro ao ativar empresa"),
  });

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { draggableId, destination, source } = result;
    if (destination.droppableId !== source.droppableId) {
      moveCardMutation.mutate({ id: draggableId, newStatus: destination.droppableId });
    }
  };

  if (isLoading)
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  if (!enabled) return null;

  const columns = Object.keys(COLUMNS) as CRMStatus[];
  const groupedData = columns.reduce(
    (acc, col) => {
      acc[col] = empresas?.filter((e) => (e.status_crm || "sem_retorno") === col) || [];
      return acc;
    },
    {} as Record<CRMStatus, typeof empresas>,
  );

  return (
    // Container Principal com Scroll Horizontal
    <div className="h-[calc(100vh-220px)] w-full overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
      <DragDropContext onDragEnd={onDragEnd}>
        {/* Container Flex que cresce horizontalmente (min-w-max) */}
        <div className="flex gap-4 p-1 min-w-max h-full">
          {columns.map((columnId) => (
            <div
              key={columnId}
              // Largura Fixa (w-[320px]) e Não Encolher (shrink-0) para garantir o layout
              className="w-[320px] shrink-0 flex flex-col h-full"
            >
              {/* Header da Coluna */}
              <div
                className={`p-3 rounded-t-lg border-b-2 flex justify-between items-center bg-white shadow-sm ${COLUMNS[columnId].color.replace("bg-", "border-b-")}`}
              >
                <h3 className="font-bold text-xs uppercase tracking-wider text-gray-700 flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${COLUMNS[columnId].color.split(" ")[0].replace("border", "bg")}`}
                  />
                  {COLUMNS[columnId].title}
                </h3>
                <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                  {groupedData[columnId]?.length || 0}
                </Badge>
              </div>

              {/* Área Droppable */}
              <Droppable droppableId={columnId}>
                {(provided, snapshot) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={`flex-1 p-2 rounded-b-lg border border-t-0 space-y-3 transition-colors overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 ${
                      snapshot.isDraggingOver ? "bg-muted/80" : "bg-muted/30"
                    }`}
                  >
                    {groupedData[columnId]?.map((empresa, index) => (
                      <Draggable key={empresa.id} draggableId={empresa.id} index={index}>
                        {(provided, snapshot) => (
                          <Card
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`cursor-grab active:cursor-grabbing hover:shadow-md transition-all group relative border-l-4 ${
                              snapshot.isDragging ? "shadow-xl ring-2 ring-primary rotate-2" : "shadow-sm"
                            } ${COLUMNS[columnId].color.split(" ")[0]}`}
                          >
                            <CardContent className="p-3 space-y-3">
                              <div className="flex justify-between items-start gap-2">
                                <span className="font-semibold text-sm line-clamp-2 text-foreground/90 pr-6">
                                  {empresa.nome}
                                </span>

                                {/* Botão de Ativar só aparece na última coluna */}
                                {columnId === "acolhimento" && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-50 absolute top-2 right-2"
                                    title="Finalizar e Ativar"
                                    onClick={(e) => {
                                      e.stopPropagation(); // Evita drag
                                      ativarEmpresaMutation.mutate(empresa.id);
                                    }}
                                  >
                                    <ArrowRight className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>

                              <div className="space-y-1.5 pt-1">
                                {empresa.nome_responsavel && (
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <User className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{empresa.nome_responsavel}</span>
                                  </div>
                                )}
                                {empresa.email_contato && (
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Mail className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{empresa.email_contato}</span>
                                  </div>
                                )}
                              </div>

                              <div className="pt-2 border-t flex items-center justify-between mt-2">
                                <Badge variant="outline" className="text-[10px] h-5 font-normal bg-background/50">
                                  {empresa.cnpj.slice(0, 10)}...
                                </Badge>
                                <div
                                  className="flex items-center gap-1 text-[10px] text-muted-foreground"
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
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}
