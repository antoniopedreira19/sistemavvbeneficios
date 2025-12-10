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
import { Loader2, Send, FileCheck, AlertTriangle, CreditCard, RotateCcw, FileDown } from "lucide-react";

export interface LoteOperacional {
  id: string;
  competencia: string;
  total_colaboradores: number | null;
  total_reprovados: number | null;
  valor_total: number | null;
  created_at: string;
  status: string;
  empresa: { nome: string; cnpj?: string } | null; // Adicionado cnpj opcional na tipagem
  obra: { nome: string } | null;
  empresa_id?: string; // Útil para buscar dados
}

interface LotesTableProps {
  lotes: LoteOperacional[];
  isLoading: boolean;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  actionType: "enviar" | "processar" | "pendencia" | "faturar" | "reanalise";
  onAction: (lote: LoteOperacional) => void;
  onDownload?: (lote: LoteOperacional) => void; // Nova prop
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
  onDownload, // Recebe a função
  actionLoading,
}: LotesTableProps) {
  const getActionButton = (lote: LoteOperacional) => {
    const isActionLoading = actionLoading === lote.id;

    // Lógica interna de status
    const getInternalAction = () => {
      if (actionType === "reanalise") {
        if (lote.status === "aguardando_reanalise") return "enviar_reanalise";
        if (lote.status === "em_reanalise") return "processar";
        return "enviar_reanalise";
      }
      return actionType;
    };

    const currentAction = getInternalAction();

    let MainButton = null;

    switch (currentAction) {
      case "enviar":
        MainButton = (
          <Button size="sm" onClick={() => onAction(lote)} disabled={isActionLoading}>
            {isActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
            Enviar
          </Button>
        );
        break;
      case "enviar_reanalise":
        MainButton = (
          <Button
            size="sm"
            className="bg-orange-600 hover:bg-orange-700"
            onClick={() => onAction(lote)}
            disabled={isActionLoading}
          >
            {isActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-1" />}
            Reenviar
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
        {/* Botão de Download (Sempre visível se a função for passada) */}
        {onDownload && (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onDownload(lote)}
            title="Baixar Lista Padrão Seguradora"
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
              {(actionType === "pendencia" || actionType === "reanalise") && (
                <TableHead className="text-center">Reprovados</TableHead>
              )}
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lotes.map((lote) => (
              <TableRow key={lote.id}>
                <TableCell className="font-medium">{lote.empresa?.nome || "-"}</TableCell>
                <TableCell>{lote.obra?.nome || "Sem obra"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-mono">
                    {lote.competencia}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">{lote.total_colaboradores || 0}</TableCell>
                {(actionType === "pendencia" || actionType === "reanalise") && (
                  <TableCell className="text-center">
                    <Badge variant="destructive">{lote.total_reprovados || 0}</Badge>
                  </TableCell>
                )}
                <TableCell className="text-center text-xs">
                  {lote.status === "aguardando_reanalise" && (
                    <Badge variant="outline" className="border-orange-400 text-orange-600">
                      Aguardando Reanálise
                    </Badge>
                  )}
                  {lote.status === "em_reanalise" && (
                    <Badge variant="outline" className="border-blue-400 text-blue-600">
                      Em Análise (2ª)
                    </Badge>
                  )}
                  {lote.status === "com_pendencia" && <Badge variant="destructive">Pendente</Badge>}
                  {lote.status === "aguardando_processamento" && <Badge variant="secondary">Novo</Badge>}
                  {lote.status === "em_analise_seguradora" && <Badge variant="secondary">Na Seguradora</Badge>}
                  {lote.status === "concluido" && <Badge className="bg-green-600">Concluído</Badge>}
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
