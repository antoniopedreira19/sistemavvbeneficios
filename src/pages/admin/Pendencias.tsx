import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Clock, AlertCircle, Filter, Check, ChevronsUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const Pendencias = () => {
  const [lotes, setLotes] = useState<any[]>([]);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>("todas");
  const [openEmpresa, setOpenEmpresa] = useState(false);

  useEffect(() => {
    fetchLotes();
    fetchEmpresas();
  }, []);

  useEffect(() => {
    fetchLotes();
  }, [filtroEmpresa]);

  const fetchEmpresas = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome, cnpj")
        .order("nome");

      if (error) throw error;
      setEmpresas(data || []);
    } catch (error) {
      console.error("Erro ao buscar empresas:", error);
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
        `)
        .in("status", ["rascunho" as const, "validando" as const, "em_cotacao" as const]);

      // Filtro por empresa
      if (filtroEmpresa !== "todas") {
        query = query.eq("empresa_id", filtroEmpresa);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;
      setLotes(data || []);
    } catch (error) {
      console.error("Erro ao buscar lotes:", error);
      toast.error("Erro ao carregar pendências");
    } finally {
      setLoading(false);
    }
  }, [filtroEmpresa]);

  const { aguardandoValidacao, aguardandoConfirmacao, atrasadas, seteDiasAtras } = useMemo(() => {
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
    
    return {
      aguardandoValidacao: lotes.filter(l => l.status === "rascunho" || l.status === "validando").length,
      aguardandoConfirmacao: lotes.filter(l => l.status === "em_cotacao").length,
      atrasadas: lotes.filter(l => 
        (l.status === "rascunho" || l.status === "validando") && 
        new Date(l.created_at) < seteDiasAtras
      ).length,
      seteDiasAtras
    };
  }, [lotes]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Pendências</h1>
        <p className="text-muted-foreground">Acompanhe as empresas e ciclos pendentes</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aguardando Validação</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aguardandoValidacao}</div>
            <p className="text-xs text-muted-foreground">lotes pendentes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aguardando Confirmação</CardTitle>
            <AlertCircle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aguardandoConfirmacao}</div>
            <p className="text-xs text-muted-foreground">confirmações em andamento</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atrasadas</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{atrasadas}</div>
            <p className="text-xs text-muted-foreground">lotes em atraso (+7 dias)</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Pendências</CardTitle>
          <CardDescription>Lotes aguardando validação e confirmação</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
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
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Carregando...</p>
            </div>
          ) : lotes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Nenhuma pendência no momento</p>
              <p className="text-sm mt-2">As empresas aparecerão aqui quando enviarem dados para confirmação</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Obra</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Competência</TableHead>
                    <TableHead>Colaboradores</TableHead>
                    <TableHead>Data Criação</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lotes.map((lote) => {
                    const isAtrasado = (lote.status === "rascunho" || lote.status === "validando") && 
                                       new Date(lote.created_at) < seteDiasAtras;
                    
                    return (
                      <TableRow key={lote.id}>
                        <TableCell className="font-medium">
                          {lote.empresas?.nome || "N/A"}
                        </TableCell>
                        <TableCell>
                          {lote.obras?.nome || "-"}
                        </TableCell>
                        <TableCell>{lote.empresas?.cnpj || "N/A"}</TableCell>
                        <TableCell>{lote.competencia}</TableCell>
                        <TableCell>{lote.total_colaboradores}</TableCell>
                        <TableCell>
                          {format(new Date(lote.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              isAtrasado ? "destructive" : 
                              lote.status === "em_cotacao" ? "default" : "secondary"
                            }
                          >
                            {isAtrasado && "⚠️ "}
                            {lote.status === "rascunho" ? "Rascunho" :
                             lote.status === "validando" ? "Validando" :
                             lote.status === "em_cotacao" ? "Aguardando Confirmação" : lote.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Pendencias;
