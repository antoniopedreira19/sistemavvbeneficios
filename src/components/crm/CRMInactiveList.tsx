import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Mail, Phone, MoreHorizontal, ArchiveX } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import EmpresaDetailDialog from "@/components/crm/EmpresaDetailDialog";
import { EmpresaCRM, CRM_STATUS_LABELS } from "@/types/crm";
import { toast } from "sonner";

const ITEMS_PER_PAGE = 50;

export function CRMInactiveList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedEmpresa, setSelectedEmpresa] = useState<EmpresaCRM | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: empresas, isLoading } = useQuery({
    queryKey: ["empresas-inativas"],
    queryFn: async () => {
      // Mostra todas empresas que NÃO são ativas
      const { data, error } = await supabase.from("empresas").select("*").neq("status", "ativa").order("nome");

      if (error) throw error;
      return (data || []) as EmpresaCRM[];
    },
  });

  const handleViewDetails = (empresa: EmpresaCRM) => {
    setSelectedEmpresa(empresa);
    setDetailDialogOpen(true);
  };

  const handleUpdateStatus = async (empresaId: string, newStatus: string) => {
    const { error } = await supabase
      .from("empresas")
      .update({ status: newStatus as any })
      .eq("id", empresaId);

    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }

    toast.success("Status atualizado com sucesso");
    queryClient.invalidateQueries({ queryKey: ["empresas-inativas"] });
  };

  const handleEmpresaUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ["empresas-inativas"] });
  };

  // Filtragem
  const filteredEmpresas =
    empresas?.filter(
      (empresa) => empresa.nome.toLowerCase().includes(searchTerm.toLowerCase()) || empresa.cnpj.includes(searchTerm),
    ) || [];

  // Lógica de Paginação
  const totalPages = Math.ceil(filteredEmpresas.length / ITEMS_PER_PAGE);
  const paginatedEmpresas = filteredEmpresas.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  if (isLoading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );

  return (
    <Card className="border-red-100/50">
      <CardHeader>
        <CardTitle className="flex justify-between items-center text-slate-700">
          <div className="flex items-center gap-2">
            <ArchiveX className="h-5 w-5 text-slate-500" />
            Empresas Inativas ({empresas?.length || 0})
          </div>
          <div className="relative w-72">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por nome ou CNPJ..."
              className="pl-8 border-red-200 focus-visible:ring-red-500"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-[30%]">Empresa</TableHead>
                <TableHead className="w-[20%]">Responsável</TableHead>
                <TableHead className="w-[25%]">Contato</TableHead>
                <TableHead className="w-[15%] text-center">Status</TableHead>
                <TableHead className="w-[10%] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedEmpresas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhuma empresa inativa ou cancelada encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedEmpresas.map((empresa) => (
                  <TableRow
                    key={empresa.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleViewDetails(empresa)}
                  >
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-base">{empresa.nome}</span>
                        <span className="text-xs text-muted-foreground font-mono">{empresa.cnpj}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {empresa.nome_responsavel || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-sm max-w-[200px]">
                        {empresa.email_contato && (
                          <div
                            className="flex items-center gap-1 text-muted-foreground truncate"
                            title={empresa.email_contato}
                          >
                            <Mail className="h-3 w-3 shrink-0" />{" "}
                            <span className="truncate">{empresa.email_contato}</span>
                          </div>
                        )}
                        {empresa.telefone_contato && (
                          <div className="flex items-center gap-1 text-muted-foreground truncate">
                            <Phone className="h-3 w-3 shrink-0" /> {empresa.telefone_contato}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusBadge status={empresa.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Abrir menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Ações</DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(empresa.cnpj);
                            }}
                          >
                            Copiar CNPJ
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-primary font-medium"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewDetails(empresa);
                            }}
                          >
                            Ver Detalhes
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="mt-4">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>

                <span className="text-sm text-muted-foreground px-4">
                  Página {currentPage} de {totalPages}
                </span>

                <PaginationItem>
                  <PaginationNext
                    onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}

        <EmpresaDetailDialog
          empresa={selectedEmpresa}
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
          statusLabels={CRM_STATUS_LABELS}
          onUpdateStatus={handleUpdateStatus}
          onEmpresaUpdated={handleEmpresaUpdated}
        />
      </CardContent>
    </Card>
  );
}

// Helper para colorir os badges conforme o status
function StatusBadge({ status }: { status: string }) {
  const STATUS_COLORS: Record<string, string> = {
    sem_retorno: "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200",
    tratativa: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
    contrato_assinado: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
    apolices_emitida: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100",
    acolhimento: "bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100",
    ativa: "bg-green-50 text-green-700 border-green-200 hover:bg-green-100",
    inativa: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100",
    cancelada: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100",
  };

  const label = CRM_STATUS_LABELS[status] || status;
  const colorClass = STATUS_COLORS[status] || "bg-muted text-muted-foreground";

  return (
    <Badge variant="outline" className={`whitespace-nowrap ${colorClass}`}>
      {label}
    </Badge>
  );
}
