import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Mail, Phone, MoreHorizontal, FileText, Users, Eye } from "lucide-react";
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
import { toast } from "sonner";
import EmpresaDetailDialog from "./EmpresaDetailDialog";
import { EmpresaCRM, CRM_STATUS_LABELS } from "@/types/crm";

const ITEMS_PER_PAGE = 50;

export function CRMList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedEmpresa, setSelectedEmpresa] = useState<EmpresaCRM | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: empresas, isLoading } = useQuery({
    queryKey: ["empresas-ativas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresas").select("*").eq("status", "ativa").order("nome");

      if (error) throw error;
      return data as EmpresaCRM[];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ empresaId, newStatus }: { empresaId: string; newStatus: string }) => {
      const { error } = await supabase
        .from("empresas")
        .update({ status_crm: newStatus })
        .eq("id", empresaId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empresas-ativas"] });
      toast.success("Status atualizado com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao atualizar status");
    },
  });

  const handleUpdateStatus = (empresaId: string, newStatus: string) => {
    updateStatusMutation.mutate({ empresaId, newStatus });
  };

  const handleViewDetails = (empresa: EmpresaCRM) => {
    setSelectedEmpresa(empresa);
    setDetailDialogOpen(true);
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
    document.getElementById("crm-list-top")?.scrollIntoView({ behavior: "smooth" });
  };

  if (isLoading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );

  return (
    <>
      <Card id="crm-list-top">
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Carteira de Clientes ({empresas?.length || 0})
            </div>
            <div className="relative w-72">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou CNPJ..."
                className="pl-8"
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
                <TableRow>
                  <TableHead className="w-[35%]">Empresa</TableHead>
                  <TableHead className="w-[20%]">Responsável</TableHead>
                  <TableHead className="w-[25%]">Contato</TableHead>
                  <TableHead className="w-[10%] text-center">Status</TableHead>
                  <TableHead className="w-[10%] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedEmpresas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhuma empresa encontrada na carteira.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedEmpresas.map((empresa) => (
                    <TableRow key={empresa.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleViewDetails(empresa)}>
                      <TableCell>
                        <div className="flex flex-col max-w-[280px]">
                          <span className="font-medium text-base truncate" title={empresa.nome}>
                            {empresa.nome}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">{empresa.cnpj}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="truncate max-w-[180px]" title={empresa.nome_responsavel || ""}>
                          {empresa.nome_responsavel || <span className="text-muted-foreground">-</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-sm max-w-[220px]">
                          {empresa.email_contato && (
                            <div
                              className="flex items-center gap-1 text-muted-foreground truncate"
                              title={empresa.email_contato}
                            >
                              <Mail className="h-3 w-3 shrink-0" />
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
                        <Badge
                          variant="secondary"
                          className="bg-green-100 text-green-800 hover:bg-green-200 border-green-200"
                        >
                          Ativa
                        </Badge>
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
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewDetails(empresa); }}>
                              <Eye className="mr-2 h-4 w-4" /> Ver Detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(empresa.cnpj); toast.success("CNPJ copiado!"); }}>
                              Copiar CNPJ
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                              <FileText className="mr-2 h-4 w-4" /> Ver Contrato/Lotes
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
        </CardContent>
      </Card>

      <EmpresaDetailDialog
        empresa={selectedEmpresa}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        statusLabels={CRM_STATUS_LABELS}
        onUpdateStatus={handleUpdateStatus}
        onEmpresaUpdated={() => queryClient.invalidateQueries({ queryKey: ["empresas-ativas"] })}
      />
    </>
  );
}
