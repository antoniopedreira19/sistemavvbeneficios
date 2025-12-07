import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

export function CRMInactiveList() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: empresas, isLoading } = useQuery({
    queryKey: ["empresas-inativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("*")
        .neq("status", "ativa") // Traz TUDO que não é 'ativa' (Inclui em_implementacao, cancelado, etc)
        .order("nome");
      
      if (error) throw error;
      return data;
    },
  });

  const filteredEmpresas = empresas?.filter(empresa => 
    empresa.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    empresa.cnpj.includes(searchTerm)
  );

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-12 w-full"/><Skeleton className="h-64 w-full"/></div>;

  return (
    <Card className="border-red-100/50">
      <CardHeader>
        <CardTitle className="flex justify-between items-center text-slate-700">
          <div className="flex items-center gap-2">
            <ArchiveX className="h-5 w-5 text-slate-500"/>
            Outros Status / Inativos ({empresas?.length || 0})
          </div>
          <div className="relative w-72">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por nome ou CNPJ..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Empresa</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmpresas?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhuma empresa encontrada com status diferente de ativo.
                  </TableCell>
                </TableRow>
              ) : (
                filteredEmpresas?.map((empresa) => (
                  <TableRow key={empresa.id}>
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
                      <div className="flex flex-col gap-1 text-sm">
                        {empresa.email_contato && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Mail className="h-3 w-3" /> {empresa.email_contato}
                          </div>
                        )}
                        {empresa.telefone_contato && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Phone className="h-3 w-3" /> {empresa.telefone_contato}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusBadge status={empresa.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Abrir menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Ações</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => navigator.clipboard.writeText(empresa.cnpj)}>
                            Copiar CNPJ
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-primary font-medium">
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
      </CardContent>
    </Card>
  );
}

// Helper para colorir os badges conforme o status
function StatusBadge({ status }: { status: string }) {
  if (status === 'em_implementacao') {
    return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Em Implementação</Badge>;
  }
  if (status === 'cancelada' || status === 'inativa') {
    return <Badge variant="destructive" className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100">Inativa</Badge>;
  }
  return <Badge variant="secondary">{status}</Badge>;
}
