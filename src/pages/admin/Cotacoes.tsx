import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FileText, Clock, DollarSign, Filter, Check, ChevronsUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const Cotacoes = () => {
  const [lotes, setLotes] = useState<any[]>([]);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cotandoLote, setCotandoLote] = useState<any>(null);
  const [valorCotacao, setValorCotacao] = useState("50");
  const [salvando, setSalvando] = useState(false);
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
      const { data, error } = await supabase.from("empresas").select("id, nome, cnpj").order("nome");

      if (error) throw error;
      setEmpresas(data || []);
    } catch (error) {
      // Silently fail
    }
  }, []);

  const fetchLotes = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase.from("lotes_mensais").select(`
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
        // Se "todos", mostrar em_cotacao e cotado
        query = query.in("status", ["em_cotacao" as const, "cotado" as const]);
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
      toast.error("Erro ao carregar cotações");
    } finally {
      setLoading(false);
    }
  }, [filtroEmpresa, filtroMes]);

  const handleCotar = useCallback(async () => {
    if (!cotandoLote) return;

    setSalvando(true);
    try {
      const valorNumerico = parseFloat(valorCotacao);

      if (isNaN(valorNumerico) || valorNumerico <= 0) {
        toast.error("Valor inválido");
        return;
      }

      // Calcular valor total: valor unitário × número de colaboradores
      const valorTotal = valorNumerico * cotandoLote.total_colaboradores;

      // Atualizar status do lote para "cotado" e gravar o valor_total
      const { error: updateError } = await supabase
        .from("lotes_mensais")
        .update({
          status: "cotado" as any,
          cotado_em: new Date().toISOString(),
          valor_total: valorTotal,
        })
        .eq("id", cotandoLote.id);

      if (updateError) throw updateError;

      // Salvar o preço na tabela precos_planos
      const { error: precoError } = await supabase.from("precos_planos").insert({
        lote_id: cotandoLote.id,
        plano: "Plano Padrão",
        faixa_etaria: "Geral",
        valor: valorNumerico,
      });

      if (precoError) throw precoError;

      toast.success(
        `Lote cotado com sucesso! Valor unitário: R$ ${valorNumerico.toFixed(2)} × ${cotandoLote.total_colaboradores} colaboradores = Valor Total: R$ ${valorTotal.toFixed(2)}`,
      );
      setCotandoLote(null);
      setValorCotacao("50");
      fetchLotes();
    } catch (error) {
      console.error("Erro ao confirmar lote:", error);
      toast.error("Erro ao processar confirmação");
    } finally {
      setSalvando(false);
    }
  }, [cotandoLote, valorCotacao, fetchLotes]);

  const aguardando = lotes.filter((l) => l.status === "em_cotacao").length;
  const cotadas = lotes.filter((l) => l.status === "cotado").length;
  const hoje = new Date().toDateString();
  const recebidasHoje = lotes.filter(
    (l) => new Date(l.enviado_cotacao_em || l.created_at).toDateString() === hoje && l.status === "em_cotacao",
  ).length;

  // Gerar lista de meses disponíveis
  const mesesDisponiveis = Array.from(new Set(lotes.map((l) => l.competencia)))
    .sort()
    .reverse();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Cotações</h1>
        <p className="text-muted-foreground">Gerencie as cotações recebidas dos clientes</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aguardando Cotação</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aguardando}</div>
            <p className="text-xs text-muted-foreground">lotes pendentes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cotadas</CardTitle>
            <DollarSign className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cotadas}</div>
            <p className="text-xs text-muted-foreground">já cotadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recebidas Hoje</CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recebidasHoje}</div>
            <p className="text-xs text-muted-foreground">cotações do dia</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lotes.length}</div>
            <p className="text-xs text-muted-foreground">total de cotações</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Cotações</CardTitle>
          <CardDescription>Todas as cotações recebidas e processadas</CardDescription>
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
                  <SelectItem value="em_cotacao">Aguardando Cotação</SelectItem>
                  <SelectItem value="cotado">Cotadas</SelectItem>
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
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Nenhuma cotação pendente</p>
              <p className="text-sm mt-2">As cotações aparecerão aqui quando forem enviadas pelos clientes</p>
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
                    <TableHead className="text-center">Data Envio</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Data Cotação</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lotes.map((lote) => (
                    <TableRow key={lote.id}>
                      <TableCell className="font-medium">{lote.empresas?.nome || "N/A"}</TableCell>
                      <TableCell>{lote.obras?.nome || "-"}</TableCell>
                      <TableCell>{lote.competencia}</TableCell>
                      <TableCell>{lote.total_colaboradores}</TableCell>
                      <TableCell>
                        {format(new Date(lote.enviado_cotacao_em || lote.created_at), "dd/MM/yyyy HH:mm", {
                          locale: ptBR,
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={lote.status === "cotado" ? "default" : "secondary"}>
                          {lote.status === "em_cotacao" ? "Aguardando" : "Cotado"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {lote.cotado_em ? format(new Date(lote.cotado_em), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {lote.status === "em_cotacao" ? (
                          <Button size="sm" onClick={() => setCotandoLote(lote)}>
                            Confirmar
                          </Button>
                        ) : (
                          <Badge variant="outline" className="text-success">
                            Cotado
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!cotandoLote} onOpenChange={(open) => !open && setCotandoLote(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Lote</DialogTitle>
            <DialogDescription>Defina o valor da cotação por colaborador</DialogDescription>
          </DialogHeader>

          {cotandoLote && (
            <div className="space-y-4 py-4">
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm font-medium mb-2">Informações do Lote:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Empresa: {cotandoLote.empresas?.nome}</li>
                  <li>• Competência: {cotandoLote.competencia}</li>
                  <li>• Colaboradores: {cotandoLote.total_colaboradores}</li>
                </ul>
              </div>

              <div className="space-y-2">
                <Label htmlFor="valor">Valor por Colaborador (R$)</Label>
                <Input
                  id="valor"
                  type="number"
                  step="0.01"
                  min="0"
                  value={valorCotacao}
                  onChange={(e) => setValorCotacao(e.target.value)}
                  placeholder="50.00"
                />
              </div>

              {valorCotacao && !isNaN(parseFloat(valorCotacao)) && (
                <div className="rounded-lg bg-primary/10 p-4">
                  <p className="text-sm font-medium mb-1">Valor Total:</p>
                  <p className="text-2xl font-bold text-primary">
                    R$ {(parseFloat(valorCotacao) * cotandoLote.total_colaboradores).toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {valorCotacao} × {cotandoLote.total_colaboradores} colaboradores
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCotandoLote(null)} disabled={salvando}>
              Cancelar
            </Button>
            <Button onClick={handleCotar} disabled={salvando}>
              {salvando ? "Salvando..." : "Confirmar Cotação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Cotacoes;
