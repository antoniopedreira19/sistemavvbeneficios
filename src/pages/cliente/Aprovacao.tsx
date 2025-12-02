import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle, Clock, X, DollarSign, FileText } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

const Aprovacao = () => {
  const { profile } = useUserRole();
  const [lotesPendentes, setLotesPendentes] = useState<any[]>([]);
  const [lotesAprovados, setLotesAprovados] = useState<any[]>([]);
  const [precos, setPrecos] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedLote, setSelectedLote] = useState<any>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [motivoReprovacao, setMotivoReprovacao] = useState("");
  const [processing, setProcessing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!profile?.empresa_id) return;
    
    setLoading(true);
    try {
      // Buscar lotes cotados aguardando aprovação
      const { data: pendentes, error: pendentesError } = await supabase
        .from("lotes_mensais")
        .select("*, obras(nome)")
        .eq("empresa_id", profile.empresa_id)
        .eq("status", "cotado")
        .order("cotado_em", { ascending: false });

      if (pendentesError) throw pendentesError;
      setLotesPendentes(pendentes || []);

      // Buscar lotes aprovados este mês (incluindo enviados e concluídos)
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);

      const { data: aprovados, error: aprovadosError } = await supabase
        .from("lotes_mensais")
        .select("*, obras(nome)")
        .eq("empresa_id", profile.empresa_id)
        .in("status", ["aprovado", "enviado", "concluido"])
        .gte("aprovado_em", inicioMes.toISOString())
        .order("aprovado_em", { ascending: false });

      if (aprovadosError) throw aprovadosError;
      setLotesAprovados(aprovados || []);

      // Buscar preços de todos os lotes (otimizado - uma query apenas)
      const todosLotes = [...(pendentes || []), ...(aprovados || [])];
      
      if (todosLotes.length > 0) {
        const loteIds = todosLotes.map(l => l.id);
        const { data: todosPrecos, error: precosError } = await supabase
          .from("precos_planos")
          .select("*")
          .in("lote_id", loteIds);

        if (!precosError && todosPrecos) {
          const precosMap: Record<string, any[]> = {};
          todosPrecos.forEach(preco => {
            if (!precosMap[preco.lote_id]) {
              precosMap[preco.lote_id] = [];
            }
            precosMap[preco.lote_id].push(preco);
          });
          setPrecos(precosMap);
        }
      }
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [profile?.empresa_id]);

  useEffect(() => {
    if (profile?.empresa_id) {
      fetchData();

      // Configurar realtime para atualização automática
      const channel = supabase
        .channel('cliente-aprovacao-lotes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'lotes_mensais'
          },
          () => {
            fetchData();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [profile?.empresa_id, fetchData]);

  const handleApprove = useCallback(async () => {
    if (!selectedLote) return;

    setProcessing(true);
    try {
      const { error } = await supabase
        .from("lotes_mensais")
        .update({
          status: "aprovado" as any,
          aprovado_em: new Date().toISOString()
        })
        .eq("id", selectedLote.id);

      if (error) throw error;

      toast.success("Lista aprovada com sucesso!");
      setShowApproveDialog(false);
      setSelectedLote(null);
      fetchData();
    } catch (error) {
      toast.error("Erro ao aprovar lista");
    } finally {
      setProcessing(false);
    }
  }, [selectedLote, fetchData]);

  const handleReject = async () => {
    if (!selectedLote || !motivoReprovacao.trim()) {
      toast.error("Informe o motivo da reprovação");
      return;
    }

    setProcessing(true);
    try {
      const { error } = await supabase
        .from("lotes_mensais")
        .update({
          status: "reprovado" as any,
          motivo_reprovacao: motivoReprovacao
        })
        .eq("id", selectedLote.id);

      if (error) throw error;

      toast.success("Lista reprovada");
      setShowRejectDialog(false);
      setSelectedLote(null);
      setMotivoReprovacao("");
      fetchData();
    } catch (error) {
      console.error("Erro ao reprovar:", error);
      toast.error("Erro ao reprovar lista");
    } finally {
      setProcessing(false);
    }
  };

  const calcularValorTotal = () => {
    let totalValor = 0;

    lotesPendentes.forEach(lote => {
      // Usar o valor_total já calculado e gravado no lote
      totalValor += Number(lote.valor_total || 0);
    });

    return totalValor;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Aprovação de Listas</h1>
        <p className="text-muted-foreground">Revise e aprove as listas confirmadas recebidas</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Listas Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lotesPendentes.length}</div>
            <p className="text-xs text-muted-foreground">aguardando aprovação</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
              }).format(calcularValorTotal())}
            </div>
            <p className="text-xs text-muted-foreground">listas pendentes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aprovadas</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lotesAprovados.length}</div>
            <p className="text-xs text-muted-foreground">este mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor das Aprovadas</CardTitle>
            <DollarSign className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
              }).format(
                lotesAprovados.reduce((sum, lote) => {
                  // Usar o valor_total já calculado e gravado no lote
                  return sum + Number(lote.valor_total || 0);
                }, 0)
              )}
            </div>
            <p className="text-xs text-muted-foreground">listas aprovadas</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listas para Aprovação</CardTitle>
          <CardDescription>Listas confirmadas recebidas aguardando sua aprovação</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Carregando...</p>
            </div>
          ) : lotesPendentes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Nenhuma lista confirmada recebida</p>
              <p className="text-sm mt-2">Os preços aparecerão aqui após retorno da seguradora</p>
            </div>
          ) : (
            <div className="space-y-4">
              {lotesPendentes.map((lote) => {
                // Usar o valor_total já calculado e gravado no lote
                const totalValor = Number(lote.valor_total || 0);
                
                return (
                  <Card key={lote.id} className="border-2">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">Competência: {lote.competencia}</CardTitle>
                          <CardDescription>
                            {lote.obras?.nome && <span className="mr-2">Obra: {lote.obras.nome}</span>}
                            {lote.obras?.nome && <span className="mr-2">•</span>}
                            Confirmado em {format(new Date(lote.cotado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </CardDescription>
                        </div>
                        <Badge>Confirmado</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Colaboradores</p>
                          <p className="font-semibold">{lote.total_colaboradores}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Valor Total</p>
                          <p className="font-semibold">
                            {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL'
                            }).format(totalValor)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Média por Colab.</p>
                          <p className="font-semibold">
                            {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL'
                            }).format(lote.total_colaboradores > 0 ? totalValor / lote.total_colaboradores : 0)}
                          </p>
                        </div>
                      </div>

                      {lote.observacoes && (
                        <div className="rounded-lg bg-muted p-3">
                          <p className="text-sm font-medium mb-1">Observações:</p>
                          <p className="text-sm text-muted-foreground">{lote.observacoes}</p>
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
                        <Button
                          className="flex-1"
                          onClick={() => {
                            setSelectedLote(lote);
                            setShowApproveDialog(true);
                          }}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Aprovar
                        </Button>
                        <Button
                          variant="destructive"
                          className="flex-1"
                          onClick={() => {
                            setSelectedLote(lote);
                            setShowRejectDialog(true);
                          }}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Reprovar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {lotesAprovados.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Listas Aprovadas</CardTitle>
            <CardDescription>Listas que você já aprovou este mês</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {lotesAprovados.map((lote) => {
                // Usar o valor_total já calculado e gravado no lote
                const totalValor = Number(lote.valor_total || 0);
                
                return (
                  <Card key={lote.id} className="border-2 border-success/20 bg-success/5">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">Competência: {lote.competencia}</CardTitle>
                          <CardDescription>
                            {lote.obras?.nome && <span className="mr-2">Obra: {lote.obras.nome}</span>}
                            {lote.obras?.nome && <span className="mr-2">•</span>}
                            Aprovado em {format(new Date(lote.aprovado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </CardDescription>
                        </div>
                        <Badge variant="default" className="bg-success text-success-foreground">Aprovado</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Colaboradores</p>
                          <p className="font-semibold">{lote.total_colaboradores}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Valor Total</p>
                          <p className="font-semibold">
                            {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL'
                            }).format(totalValor)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Média por Colab.</p>
                          <p className="font-semibold">
                            {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL'
                            }).format(lote.total_colaboradores > 0 ? totalValor / lote.total_colaboradores : 0)}
                          </p>
                        </div>
                      </div>

                      {lote.observacoes && (
                        <div className="rounded-lg bg-muted p-3">
                          <p className="text-sm font-medium mb-1">Observações:</p>
                          <p className="text-sm text-muted-foreground">{lote.observacoes}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog de Aprovação */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Aprovação</DialogTitle>
            <DialogDescription>
              Você confirma a aprovação desta lista?
            </DialogDescription>
          </DialogHeader>
          
          {selectedLote && (
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm font-medium">Detalhes da Lista:</p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                <li>• Competência: {selectedLote.competencia}</li>
                {selectedLote.obras?.nome && <li>• Obra: {selectedLote.obras.nome}</li>}
                <li>• Colaboradores: {selectedLote.total_colaboradores}</li>
                <li>• Valor total: {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL'
                }).format(Number(selectedLote.valor_total || 0))}</li>
              </ul>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)} disabled={processing}>
              Cancelar
            </Button>
            <Button onClick={handleApprove} disabled={processing}>
              {processing ? "Aprovando..." : "Confirmar Aprovação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Reprovação */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reprovar Cotação</DialogTitle>
            <DialogDescription>
              Informe o motivo da reprovação desta cotação
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo da Reprovação *</Label>
              <Textarea
                id="motivo"
                placeholder="Descreva o motivo da reprovação..."
                value={motivoReprovacao}
                onChange={(e) => setMotivoReprovacao(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowRejectDialog(false);
                setMotivoReprovacao("");
              }} 
              disabled={processing}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReject} 
              disabled={processing || !motivoReprovacao.trim()}
            >
              {processing ? "Reprovando..." : "Confirmar Reprovação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Aprovacao;
