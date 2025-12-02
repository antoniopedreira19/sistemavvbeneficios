import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, Filter, Check, ChevronsUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { capitalize } from "@/lib/utils";

const Aprovacoes = () => {
  const [lotes, setLotes] = useState<any[]>([]);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroMes, setFiltroMes] = useState<string>("todos");
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>("todas");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [openEmpresa, setOpenEmpresa] = useState(false);

  useEffect(() => {
    fetchLotes();
    fetchEmpresas();
  }, []);

  useEffect(() => {
    fetchLotes();
  }, [filtroMes, filtroEmpresa, filtroStatus]);

  const fetchEmpresas = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome, cnpj")
        .order("nome");

      if (error) throw error;
      setEmpresas(data || []);
    } catch (error) {
      // Silently fail
    }
  }, []);

  const fetchLotes = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("lotes_mensais")
        .select(`
          *,
          empresas (
            nome,
            cnpj
          ),
          obras:obra_id (
            nome
          )
        `);

      // Filtro por status
      if (filtroStatus !== "todos") {
        query = query.eq("status", filtroStatus as any);
      } else {
        // Se "todos", mostrar cotado e aprovado
        query = query.in("status", ["cotado" as const, "aprovado" as const]);
      }

      // Filtro por empresa
      if (filtroEmpresa !== "todas") {
        query = query.eq("empresa_id", filtroEmpresa);
      }

      // Filtro por mês
      if (filtroMes !== "todos") {
        query = query.eq("competencia", filtroMes);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;
      setLotes(data || []);
    } catch (error) {
      toast.error("Erro ao carregar aprovações");
    } finally {
      setLoading(false);
    }
  }, [filtroEmpresa, filtroMes]);

  const aguardandoAprovacao = lotes.filter(l => l.status === "cotado").length;
  const aprovadas = lotes.filter(l => l.status === "aprovado").length;
  const hoje = new Date().toDateString();
  const aprovadasHoje = lotes.filter(l => 
    l.aprovado_em && new Date(l.aprovado_em).toDateString() === hoje
  ).length;

  // Gerar lista de meses disponíveis
  const mesesDisponiveis = Array.from(new Set(lotes.map(l => l.competencia))).sort().reverse();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Aprovações</h1>
        <p className="text-muted-foreground">Acompanhe as aprovações de preços pelos clientes</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aguardando Aprovação</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aguardandoAprovacao}</div>
            <p className="text-xs text-muted-foreground">listas confirmadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aprovadas</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aprovadas}</div>
            <p className="text-xs text-muted-foreground">já aprovadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aprovadas Hoje</CardTitle>
            <CheckCircle className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aprovadasHoje}</div>
            <p className="text-xs text-muted-foreground">aprovações do dia</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lotes.length}</div>
            <p className="text-xs text-muted-foreground">total de lotes</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Aprovações</CardTitle>
          <CardDescription>Listas confirmadas aguardando aprovação e já aprovadas pelos clientes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <Label htmlFor="filtro-status" className="text-sm mb-2 block">
                <Filter className="h-3 w-3 inline mr-1" />
                Status
              </Label>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger id="filtro-status">
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  <SelectItem value="cotado">Aguardando Aprovação</SelectItem>
                  <SelectItem value="aprovado">Aprovadas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <Label htmlFor="filtro-empresa" className="text-sm mb-2 block">
                <Filter className="h-3 w-3 inline mr-1" />
                Empresa
              </Label>
              <Popover open={openEmpresa} onOpenChange={setOpenEmpresa}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openEmpresa}
                    className="w-full justify-between"
                  >
                    {filtroEmpresa === "todas" 
                      ? "Todas as empresas" 
                      : empresas.find((emp) => emp.id === filtroEmpresa)?.nome || "Selecione..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Buscar por nome ou CNPJ..." />
                    <CommandList>
                      <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="todas"
                          onSelect={() => {
                            setFiltroEmpresa("todas");
                            setOpenEmpresa(false);
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${filtroEmpresa === "todas" ? "opacity-100" : "opacity-0"}`}
                          />
                          Todas as empresas
                        </CommandItem>
                        {empresas.map((emp) => (
                          <CommandItem
                            key={emp.id}
                            value={`${emp.nome} ${emp.cnpj}`}
                            onSelect={() => {
                              setFiltroEmpresa(emp.id);
                              setOpenEmpresa(false);
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${filtroEmpresa === emp.id ? "opacity-100" : "opacity-0"}`}
                            />
                            {emp.nome} - {emp.cnpj}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex-1">
              <Label htmlFor="filtro-mes" className="text-sm mb-2 block">
                <Filter className="h-3 w-3 inline mr-1" />
                Competência
              </Label>
              <Select value={filtroMes} onValueChange={setFiltroMes}>
                <SelectTrigger id="filtro-mes">
                  <SelectValue placeholder="Todos os meses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os meses</SelectItem>
                  {mesesDisponiveis.map((mes) => (
                    <SelectItem key={mes} value={mes}>
                      {mes}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Carregando...</p>
            </div>
          ) : lotes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Nenhum registro encontrado</p>
              <p className="text-sm mt-2">Ajuste os filtros para ver mais resultados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">Empresa</TableHead>
                    <TableHead className="text-center">Obra</TableHead>
                    <TableHead className="text-center">Competência</TableHead>
                    <TableHead className="text-center">Colaboradores</TableHead>
                    <TableHead className="text-center">Data Confirmação</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Data Aprovação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lotes.map((lote) => (
                    <TableRow key={lote.id}>
                      <TableCell className="text-center font-medium">
                        {lote.empresas?.nome || "N/A"}
                      </TableCell>
                      <TableCell className="text-center">
                        {lote.obras?.nome || "-"}
                      </TableCell>
                      <TableCell className="text-center">{lote.competencia}</TableCell>
                      <TableCell className="text-center">{lote.total_colaboradores}</TableCell>
                      <TableCell className="text-center">
                        {lote.cotado_em ? format(new Date(lote.cotado_em), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={lote.status === "aprovado" ? "default" : "secondary"}>
                          {capitalize(lote.status === "cotado" ? "Aguardando" : "Aprovado")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {lote.aprovado_em ? format(new Date(lote.aprovado_em), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Aprovacoes;
