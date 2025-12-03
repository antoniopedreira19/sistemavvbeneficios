import { useState } from "react";
import { 
  Users, 
  Search, 
  Plus, 
  Filter,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Mock data
const MOCK_OBRAS = [
  { id: "all", nome: "Todas as Obras" },
  { id: "obra-a", nome: "Obra A - Centro" },
  { id: "obra-b", nome: "Obra B - Zona Sul" },
  { id: "obra-c", nome: "Obra C - Industrial" },
];

const MOCK_COLABORADORES = [
  { id: 1, nome: "João Silva Santos", cpf: "123.456.789-00", cargo: "Profissional", salario: 3500, obra: "Obra A - Centro", status: "ativo" },
  { id: 2, nome: "Maria Oliveira", cpf: "234.567.890-11", cargo: "Ajudante", salario: 1800, obra: "Obra A - Centro", status: "ativo" },
  { id: 3, nome: "Carlos Pereira", cpf: "345.678.901-22", cargo: "Profissional", salario: 4200, obra: "Obra B - Zona Sul", status: "ativo" },
  { id: 4, nome: "Ana Costa Lima", cpf: "456.789.012-33", cargo: "Ajudante", salario: 1900, obra: "Obra B - Zona Sul", status: "afastado" },
  { id: 5, nome: "Pedro Souza", cpf: "567.890.123-44", cargo: "Profissional", salario: 3800, obra: "Obra C - Industrial", status: "ativo" },
  { id: 6, nome: "Fernanda Lima", cpf: "678.901.234-55", cargo: "Ajudante", salario: 1750, obra: "Obra A - Centro", status: "ativo" },
  { id: 7, nome: "Ricardo Alves", cpf: "789.012.345-66", cargo: "Profissional", salario: 4500, obra: "Obra C - Industrial", status: "ativo" },
  { id: 8, nome: "Juliana Martins", cpf: "890.123.456-77", cargo: "Ajudante", salario: 1850, obra: "Obra B - Zona Sul", status: "ativo" },
  { id: 9, nome: "Lucas Ferreira", cpf: "901.234.567-88", cargo: "Profissional", salario: 3600, obra: "Obra A - Centro", status: "afastado" },
  { id: 10, nome: "Camila Rodrigues", cpf: "012.345.678-99", cargo: "Ajudante", salario: 1950, obra: "Obra C - Industrial", status: "ativo" },
];

const ITEMS_PER_PAGE = 5;

const MinhaEquipe = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedObra, setSelectedObra] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Filtrar colaboradores
  const filteredColaboradores = MOCK_COLABORADORES.filter((colab) => {
    const matchesSearch = 
      colab.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      colab.cpf.includes(searchTerm);
    const matchesObra = selectedObra === "all" || colab.obra === MOCK_OBRAS.find(o => o.id === selectedObra)?.nome;
    return matchesSearch && matchesObra;
  });

  // Paginação
  const totalPages = Math.ceil(filteredColaboradores.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedColaboradores = filteredColaboradores.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const getStatusBadge = (status: string) => {
    if (status === "ativo") {
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Ativo</Badge>;
    }
    return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Afastado</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Minha Equipe</h1>
            <p className="text-muted-foreground">Gestão de obras e colaboradores</p>
          </div>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Colaborador
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Novo Colaborador</DialogTitle>
              <DialogDescription>
                Preencha os dados do colaborador para adicioná-lo à equipe.
              </DialogDescription>
            </DialogHeader>
            <div className="py-6 text-center text-muted-foreground">
              Formulário em desenvolvimento...
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Resumo */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Colaboradores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{MOCK_COLABORADORES.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {MOCK_COLABORADORES.filter(c => c.status === "ativo").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Afastados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {MOCK_COLABORADORES.filter(c => c.status === "afastado").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou CPF..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="sm:w-64">
              <Select 
                value={selectedObra} 
                onValueChange={(value) => {
                  setSelectedObra(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Filtrar por obra" />
                </SelectTrigger>
                <SelectContent>
                  {MOCK_OBRAS.map((obra) => (
                    <SelectItem key={obra.id} value={obra.id}>
                      {obra.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Salário</TableHead>
                <TableHead>Obra</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedColaboradores.length > 0 ? (
                paginatedColaboradores.map((colab) => (
                  <TableRow key={colab.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium">{colab.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{colab.cpf}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{colab.cargo}</Badge>
                    </TableCell>
                    <TableCell>{formatCurrency(colab.salario)}</TableCell>
                    <TableCell className="text-muted-foreground">{colab.obra}</TableCell>
                    <TableCell>{getStatusBadge(colab.status)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    Nenhum colaborador encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Paginação */}
          {filteredColaboradores.length > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Mostrando {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, filteredColaboradores.length)} de {filteredColaboradores.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MinhaEquipe;
