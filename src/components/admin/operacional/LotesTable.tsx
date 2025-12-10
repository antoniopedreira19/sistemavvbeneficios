import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Loader2, Send, FileCheck, AlertTriangle, CreditCard, FileDown, Pencil } from "lucide-react";

export interface LoteOperacional {
  id: string;
  competencia: string;
  total_colaboradores: number | null;
  total_reprovados: number | null;
  valor_total: number | null;
  created_at: string;
  status: string;
  empresa: { nome: string; cnpj?: string } | null;
  // ATUALIZADO: Incluímos o ID aqui
  obra: { id: string; nome: string } | null;
  empresa_id?: string;
}

interface LotesTableProps {
  lotes: LoteOperacional[];
  isLoading: boolean;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  actionType: "enviar" | "processar" | "pendencia" | "faturar" | "enviar_cliente";
  onAction: (lote: LoteOperacional) => void;
  onDownload?: (lote: LoteOperacional) => void;
  onEdit?: (lote: LoteOperacional) => void;
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
  onDownload,
  onEdit,
  actionLoading,
}: LotesTableProps) {
  const getActionButton = (lote: LoteOperacional) => {
    const isActionLoading = actionLoading === lote.id;

    let MainButton = null;

    switch (actionType) {
      case "enviar":
        MainButton = (
          <Button size="sm" onClick={() => onAction(lote)} disabled={isActionLoading}>
            {isActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
            Enviar
          </Button>
        );
        break;
      case "processar":
        MainButton = (
          <Button size="sm" variant="secondary" onClick={() => onAction(lote)} disabled={isActionLoading}>
            {isActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck className="h-4 w-4 mr-1" />}
            Processar
          </Button>
        );
        break;
      case "pendencia":
        MainButton = (
          <Button size="sm" variant="outline" onClick={() => onAction(lote)} disabled={isActionLoading}>
            {isActionLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <AlertTriangle className="h-4 w-4 mr-1" />
            )}
            Cobrar
          </Button>
        );
        break;
      case "enviar_cliente":
        MainButton = (
          <Button size="sm" variant="outline" className="border-orange-500 text-orange-600 hover:bg-orange-50" onClick={() => onAction(lote)} disabled={isActionLoading}>
            {isActionLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-1" />
            )}
            Enviar para Cliente
          </Button>
        );
        break;
      case "faturar":
        MainButton = (
          <Button size="sm" variant="default" onClick={() => onAction(lote)} disabled={isActionLoading}>
            {isActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4 mr-1" />}
            Faturar
          </Button>
        );
        break;
    }

    return (
      <div className="flex items-center justify-end gap-2">
        {onEdit && lote.status === "concluido" && (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onEdit(lote)}
            title="Editar Lote"
            className="text-muted-foreground hover:text-blue-600"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}

        {onDownload && (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onDownload(lote)}
            title="Baixar Lista"
            className="text-muted-foreground hover:text-primary"
          >
            <FileDown className="h-4 w-4" />
          </Button>
        )}
        {MainButton}
      </div>
    );
  };

  if (isLoading)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  if (lotes.length === 0)
    return (
      <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/10">
        Nenhum lote encontrado nesta etapa.
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Obra</TableHead>
              <TableHead>Competência</TableHead>
              <TableHead className="text-center">Vidas</TableHead>
              {actionType === "enviar_cliente" && (
                <TableHead className="text-center">Reprovados</TableHead>
              )}
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lotes.map((lote) => (
              <TableRow key={lote.id}>
                <TableCell className="font-medium">{lote.empresa?.nome?.toUpperCase() || "-"}</TableCell>
                <TableCell>{lote.obra?.nome?.toUpperCase() || "SEM OBRA"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-mono">
                    {lote.competencia}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">{lote.total_colaboradores || 0}</TableCell>
                {actionType === "enviar_cliente" && (
                  <TableCell className="text-center">
                    <Badge variant="destructive">{lote.total_reprovados || 0}</Badge>
                  </TableCell>
                )}
                <TableCell className="text-center text-xs">
                  {lote.status === "aguardando_processamento" && <Badge variant="secondary">Novo</Badge>}
                  {lote.status === "em_analise_seguradora" && <Badge variant="secondary">Na Seguradora</Badge>}
                  {lote.status === "concluido" && (lote.total_reprovados || 0) > 0 && (
                    <Badge className="bg-orange-500">Com Pendências</Badge>
                  )}
                  {lote.status === "concluido" && (lote.total_reprovados || 0) === 0 && (
                    <Badge className="bg-green-600">Concluído</Badge>
                  )}
                  {lote.status === "faturado" && <Badge className="bg-blue-600">Faturado</Badge>}
                </TableCell>
                <TableCell className="text-right">{getActionButton(lote)}</TableCell>
              </TableRow>
            ))}
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
            <span className="text-sm px-4 text-muted-foreground self-center">
              Página {currentPage} de {totalPages}
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
