import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Loader2, Send, CheckCircle, AlertTriangle, FileText, RotateCcw } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

export interface LoteOperacional {
  id: string;
  competencia: string;
  total_colaboradores: number;
  total_reprovados: number;
  valor_total: number;
  created_at: string;
  // Atualizado com os novos status do banco
  status:
    | "aguardando_processamento"
    | "em_analise_seguradora"
    | "com_pendencia"
    | "aguardando_reanalise"
    | "em_reanalise"
    | "concluido"
    | "faturado";
  empresa: {
    nome: string;
  };
  obra: {
    nome: string;
  } | null;
}

interface LotesTableProps {
  lotes: LoteOperacional[];
  isLoading: boolean;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  // Adicionado 'reanalise' como tipo de ação
  actionType: "enviar" | "processar" | "pendencia" | "faturar" | "reanalise";
  onAction: (lote: LoteOperacional) => void;
  actionLoading: string | null;
}

export function LotesTable({
  lotes,
  isLoading,
  currentPage,
  totalPages,
  onPageChange,
  actionType,
  onAction,
  actionLoading,
}: LotesTableProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (lotes.length === 0) {
    return (
      <div className="text-center p-8 border rounded-lg bg-muted/20">
        <p className="text-muted-foreground">Nenhum lote encontrado nesta etapa.</p>
      </div>
    );
  }

  // Helper para decidir qual botão mostrar na aba de Reanálise
  const getDynamicAction = (lote: LoteOperacional) => {
    if (actionType === "reanalise") {
      // Se chegou do cliente (aguardando), preciso Enviar
      if (lote.status === "aguardando_reanalise") return "enviar_reanalise";
      // Se já enviei (em reanálise), preciso Processar
      if (lote.status === "em_reanalise") return "processar";
    }
    return actionType;
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa / Obra</TableHead>
              <TableHead>Competência</TableHead>
              <TableHead className="text-center">Vidas</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lotes.map((lote) => {
              const currentAction = getDynamicAction(lote);

              return (
                <TableRow key={lote.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{lote.empresa.nome}</span>
                      <span className="text-xs text-muted-foreground">{lote.obra?.nome || "Sem obra definida"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{lote.competencia}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center">
                      <span className="font-bold">{lote.total_colaboradores}</span>
                      {lote.total_reprovados > 0 && (
                        <span className="text-xs text-red-500 font-medium">({lote.total_reprovados} reprovados)</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {/* Badge de Status Visual */}
                    <StatusBadge status={lote.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant={currentAction === "pendencia" ? "outline" : "default"}
                      onClick={() => onAction(lote)}
                      disabled={actionLoading === lote.id}
                      className={
                        currentAction === "enviar_reanalise" ? "bg-orange-600 hover:bg-orange-700 text-white" : ""
                      }
                    >
                      {actionLoading === lote.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        getActionIcon(currentAction)
                      )}
                      <span className="ml-2">{getActionLabel(currentAction)}</span>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
            {/* Paginação simplificada para não quebrar layout */}
            <span className="px-4 text-sm text-muted-foreground">
              Pág {currentPage} de {totalPages}
            </span>
            <PaginationItem>
              <PaginationNext
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "aguardando_reanalise":
      return (
        <Badge variant="outline" className="border-orange-500 text-orange-600 bg-orange-50">
          Corrigido (Reenvio)
        </Badge>
      );
    case "em_reanalise":
      return (
        <Badge variant="outline" className="border-blue-500 text-blue-600 bg-blue-50">
          Em 2ª Análise
        </Badge>
      );
    case "com_pendencia":
      return <Badge variant="destructive">Pendente</Badge>;
    default:
      return <span className="text-muted-foreground text-xs">-</span>;
  }
}

function getActionLabel(type: string) {
  switch (type) {
    case "enviar":
      return "Enviar Seguradora";
    case "enviar_reanalise":
      return "Reenviar Seguradora";
    case "processar":
      return "Processar Retorno";
    case "pendencia":
      return "Cobrar Cliente";
    case "faturar":
      return "Liberar Faturamento";
    default:
      return "Ação";
  }
}

function getActionIcon(type: string) {
  switch (type) {
    case "enviar":
      return <Send className="h-4 w-4" />;
    case "enviar_reanalise":
      return <RotateCcw className="h-4 w-4" />;
    case "processar":
      return <CheckCircle className="h-4 w-4" />;
    case "pendencia":
      return <AlertTriangle className="h-4 w-4" />;
    case "faturar":
      return <FileText className="h-4 w-4" />;
    default:
      return null;
  }
}
