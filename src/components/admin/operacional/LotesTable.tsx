import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Loader2, Send, FileCheck, AlertTriangle, CreditCard } from "lucide-react";

export interface LoteOperacional {
  id: string;
  competencia: string;
  total_colaboradores: number | null;
  total_reprovados: number | null;
  valor_total: number | null;
  created_at: string;
  status: string;
  empresa: { nome: string } | null;
  obra: { nome: string } | null;
}

interface LotesTableProps {
  lotes: LoteOperacional[];
  isLoading: boolean;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  actionType: "enviar" | "processar" | "pendencia" | "faturar";
  onAction: (lote: LoteOperacional) => void;
  actionLoading?: string | null;
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
  const getActionButton = (lote: LoteOperacional) => {
    const isLoading = actionLoading === lote.id;

    switch (actionType) {
      case "enviar":
        return (
          <Button size="sm" onClick={() => onAction(lote)} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
            Enviar
          </Button>
        );
      case "processar":
        return (
          <Button size="sm" variant="secondary" onClick={() => onAction(lote)} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck className="h-4 w-4 mr-1" />}
            Processar
          </Button>
        );
      case "pendencia":
        return (
          <Button size="sm" variant="outline" onClick={() => onAction(lote)} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4 mr-1" />}
            Cobrar
          </Button>
        );
      case "faturar":
        return (
          <Button size="sm" variant="default" onClick={() => onAction(lote)} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4 mr-1" />}
            Faturar
          </Button>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (lotes.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhum lote encontrado nesta etapa.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Empresa</TableHead>
            <TableHead>Obra</TableHead>
            <TableHead>Competência</TableHead>
            <TableHead className="text-center">Vidas</TableHead>
            {actionType === "pendencia" && (
              <TableHead className="text-center">Reprovados</TableHead>
            )}
            <TableHead>Data Envio</TableHead>
            <TableHead className="text-right">Ação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lotes.map((lote) => (
            <TableRow key={lote.id}>
              <TableCell className="font-medium">
                <div className="flex flex-col gap-1">
                  <span>{lote.empresa?.nome || "-"}</span>
                  {lote.status === "aguardando_processamento" && (
                    (lote.total_reprovados ?? 0) > 0 ? (
                      <Badge variant="outline" className="w-fit text-xs bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700">
                        ⚠️ Correção Enviada
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="w-fit text-xs bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700">
                        🆕 Novo Envio
                      </Badge>
                    )
                  )}
                </div>
              </TableCell>
              <TableCell>{lote.obra?.nome || "Sem obra"}</TableCell>
              <TableCell>
                <Badge variant="outline" className="font-mono">
                  {lote.competencia}
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                {lote.total_colaboradores || 0}
              </TableCell>
              {actionType === "pendencia" && (
                <TableCell className="text-center">
                  <Badge variant="destructive">
                    {lote.total_reprovados || 0}
                  </Badge>
                </TableCell>
              )}
              <TableCell>
                {format(new Date(lote.created_at), "dd/MM/yyyy HH:mm", {
                  locale: ptBR,
                })}
              </TableCell>
              <TableCell className="text-right">
                {getActionButton(lote)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <PaginationItem key={page}>
                <PaginationLink
                  onClick={() => onPageChange(page)}
                  isActive={currentPage === page}
                  className="cursor-pointer"
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            ))}
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
