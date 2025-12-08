import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Mail, Phone, MoreHorizontal, FileText, Users, Eye, FileCheck } from "lucide-react";
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
import { EditarEmpresaDialog } from "@/components/admin/EditarEmpresaDialog";
import EmpresaDetailDialog from "@/components/crm/EmpresaDetailDialog"; // Importando o modal de detalhes

// Mapa completo de status para o modal
const UNIFIED_STATUS_LABELS: Record<string, string> = {
  sem_retorno: "Sem Retorno",
  tratativa: "Em Tratativa",
  contrato_assinado: "Contrato Assinado",
  apolices_emitida: "Apólices Emitidas",
  acolhimento: "Acolhimento",
  ativa: "Ativa",
  inativa: "Inativa",
  cancelada: "Cancelada",
};

const ITEMS_PER_PAGE = 50;

export function CRMList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [empresaParaEditar, setEmpresaParaEditar] = useState<any | null>(null); // Para modal de edição direta
  const [selectedEmpresa, setSelectedEmpresa] = useState<any | null>(null); // Para modal de detalhes
  const queryClient = useQueryClient();

  const { data: empresas, isLoading } = useQuery({
    queryKey: ["empresas-ativas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresas").select("*").eq("status", "ativa").order("nome");
      if (error) throw error;
      return data;
    },
  });

  // Mutação para atualizar status via Modal de Detalhes
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("empresas")
        .update({ status: status as any })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empresas-ativas"] });
      queryClient.invalidateQueries({ queryKey: ["empresas-inativas"] });
      queryClient.invalidateQueries({ queryKey: ["crm-empresas"] });
      toast.success("Status atualizado!");
      setSelectedEmpresa(null); // Fecha o modal se o status mudar (pois sai da lista)
    },
    onError: () => toast.error("Erro ao atualizar status."),
  });

  const filteredEmpresas =
    empresas?.filter(
      (empresa) => empresa.nome.toLowerCase().includes(searchTerm.toLowerCase()) || empresa.cnpj.includes(searchTerm),
    ) || [];

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
                    Nenhuma empresa encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedEmpresas.map((empresa) => (
                  <TableRow
                    key={empresa.id}
                    className="hover:bg-muted/50 cursor-pointer" // Cursor pointer para indicar clique
                    onClick={() => setSelectedEmpresa(empresa)} // CLIQUE NA LINHA ABRE DETALHES
                  >
                    <TableCell>
                      <div className="flex flex-col max-w-[280px]">
                        <span className="font-medium text-base truncate" title={empresa.nome}>
                          {empresa.nome}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">{empresa.cnpj}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="truncate max-w-[180px]">{empresa.nome_responsavel || "-"}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-sm max-w-[220px]">
                        {empresa.email_contato && (
                          <div className="flex items-center gap-1 text-muted-foreground truncate">
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
                      <div className="flex flex-col items-center gap-1.5">
                        <Badge
                          variant="secondary"
                          className="bg-green-100 text-green-800 hover:bg-green-200 border-green-200"
                        >
                          Ativa
                        </Badge>
                        {empresa.contrato_url && (
                          <Badge
                            variant="outline"
                            className="text-[10px] h-5 px-1.5 gap-1 text-blue-700 border-blue-200 bg-blue-50"
                          >
                            <FileCheck className="h-3 w-3" /> Contrato
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Abrir menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuLabel>Ações</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => setSelectedEmpresa(empresa)}>
                            <Eye className="mr-2 h-4 w-4" /> Ver Detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEmpresaParaEditar(empresa)}>
                            <FileText className="mr-2 h-4 w-4" /> Editar / Contrato
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              navigator.clipboard.writeText(empresa.cnpj);
                              toast.success("CNPJ copiado!");
                            }}
                          >
                            Copiar CNPJ
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
                    className={currentPage === 1 ? "opacity-50 pointer-events-none" : "cursor-pointer"}
                  />
                </PaginationItem>
                <span className="text-sm px-4">
                  Página {currentPage} de {totalPages}
                </span>
                <PaginationItem>
                  <PaginationNext
                    onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                    className={currentPage === totalPages ? "opacity-50 pointer-events-none" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </CardContent>

      {/* MODAL DE EDIÇÃO DIRETA */}
      {empresaParaEditar && (
        <EditarEmpresaDialog
          open={!!empresaParaEditar}
          onOpenChange={(open) => !open && setEmpresaParaEditar(null)}
          empresa={empresaParaEditar}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["empresas-ativas"] })}
        />
      )}

      {/* MODAL DE DETALHES (Read-only + Ações) */}
      {selectedEmpresa && (
        <EmpresaDetailDialog
          open={!!selectedEmpresa}
          onOpenChange={(open) => !open && setSelectedEmpresa(null)}
          empresa={selectedEmpresa}
          statusLabels={UNIFIED_STATUS_LABELS}
          onUpdateStatus={(id, status) => updateStatusMutation.mutate({ id, status })}
          onEmpresaUpdated={() => queryClient.invalidateQueries({ queryKey: ["empresas-ativas"] })}
        />
      )}
    </Card>
  );
}
