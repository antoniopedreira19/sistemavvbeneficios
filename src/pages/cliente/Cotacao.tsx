import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Send, Users, AlertCircle, FileText, Clock } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCPF } from "@/lib/validators";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

const Cotacao = () => {
  const { profile } = useUserRole();
  const [colaboradores, setColaboradores] = useState<any[]>([]);
  const [lotes, setLotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [alteracoes, setAlteracoes] = useState(0);
  const [showDialog, setShowDialog] = useState(false);
  const [sending, setSending] = useState(false);
  const [formData, setFormData] = useState({
    competencia: format(new Date(), "MM/yyyy", { locale: ptBR }),
    observacoes: ""
  });

  useEffect(() => {
    if (profile?.empresa_id) {
      fetchData();
    }
  }, [profile?.empresa_id]);

  const fetchData = useCallback(async () => {
    if (!profile?.empresa_id) return;
    
    setLoading(true);
    try {
      // Buscar colaboradores ativos
      const { data: colabs, error: colabsError } = await supabase
        .from("colaboradores")
        .select("*")
        .eq("empresa_id", profile.empresa_id)
        .eq("status", "ativo");

      if (colabsError) throw colabsError;
      setColaboradores(colabs || []);

      // Buscar lotes (histórico)
      const { data: lotesData, error: lotesError } = await supabase
        .from("lotes_mensais")
        .select("*")
        .eq("empresa_id", profile.empresa_id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (lotesError) throw lotesError;
      setLotes(lotesData || []);

      // Calcular alterações desde o último envio
      if (lotesData && lotesData.length > 0) {
        const ultimoLote = lotesData[0];
        const dataUltimoLote = new Date(ultimoLote.created_at);
        const novos = (colabs || []).filter(c => new Date(c.created_at) > dataUltimoLote);
        setAlteracoes(novos.length);
      } else {
        setAlteracoes(colabs?.length || 0);
      }
    } catch (error) {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [profile?.empresa_id]);

  const handleSendToQuote = useCallback(async () => {
    if (colaboradores.length === 0) {
      toast.error("Adicione colaboradores antes de enviar para cotação");
      return;
    }

    setSending(true);
    try {
      // Criar novo lote
      const { data: lote, error: loteError } = await supabase
        .from("lotes_mensais")
        .insert({
          empresa_id: profile?.empresa_id!,
          competencia: formData.competencia,
          status: "validando" as any,
          total_colaboradores: colaboradores.length,
          total_novos: alteracoes,
          observacoes: formData.observacoes,
          enviado_cotacao_em: new Date().toISOString()
        })
        .select()
        .single();

      if (loteError) throw loteError;

      // Criar snapshot dos colaboradores neste lote
      const colaboradoresLote = colaboradores.map(c => ({
        lote_id: lote.id,
        colaborador_id: c.id,
        nome: c.nome,
        cpf: c.cpf,
        sexo: c.sexo,
        data_nascimento: c.data_nascimento,
        salario: c.salario,
        classificacao: c.classificacao,
        classificacao_salario: c.classificacao_salario,
        aposentado: c.aposentado,
        afastado: c.afastado,
        cid: c.cid
      }));

      const { error: colabsError } = await supabase
        .from("colaboradores_lote")
        .insert(colaboradoresLote);

      if (colabsError) throw colabsError;

      toast.success("Lista enviada para cotação com sucesso!");
      setShowDialog(false);
      setFormData({
        competencia: format(new Date(), "MM/yyyy", { locale: ptBR }),
        observacoes: ""
      });
      fetchData();
    } catch (error) {
      console.error("Erro ao enviar para cotação:", error);
      toast.error("Erro ao enviar para cotação");
    } finally {
      setSending(false);
    }
  }, [colaboradores, formData, fetchData]);

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      rascunho: { label: "Rascunho", variant: "outline" },
      em_cotacao: { label: "Em Cotação", variant: "secondary" },
      cotado: { label: "Cotado", variant: "default" },
      aprovado: { label: "Aprovado", variant: "default" },
      enviado: { label: "Enviado", variant: "default" }
    };
    const config = statusMap[status] || { label: status, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Enviar Lista</h1>
          <p className="text-muted-foreground">Revise os dados e envie sua lista para cotação</p>
        </div>
        <Button 
          onClick={() => setShowDialog(true)} 
          disabled={colaboradores.length === 0 || loading}
        >
          <Send className="h-4 w-4 mr-2" />
          Enviar Lista
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Colaboradores Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{colaboradores.length}</div>
            <p className="text-xs text-muted-foreground">para enviar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alterações</CardTitle>
            <AlertCircle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{alteracoes}</div>
            <p className="text-xs text-muted-foreground">desde o último envio</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Último Envio</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {lotes.length > 0 ? format(new Date(lotes[0].created_at), "dd/MM", { locale: ptBR }) : "-"}
            </div>
            <p className="text-xs text-muted-foreground">
              {lotes.length > 0 ? lotes[0].competencia : "nenhum envio"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resumo para Cotação</CardTitle>
          <CardDescription>Lista atual de colaboradores que será enviada</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Carregando...</p>
            </div>
          ) : colaboradores.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Send className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Nenhum colaborador cadastrado</p>
              <p className="text-sm mt-2">Cadastre colaboradores antes de enviar para cotação</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Salário</TableHead>
                    <TableHead>Classificação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {colaboradores.map((colab) => (
                    <TableRow key={colab.id}>
                      <TableCell className="font-medium">{colab.nome}</TableCell>
                      <TableCell>{formatCPF(colab.cpf)}</TableCell>
                      <TableCell>
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL'
                        }).format(colab.salario)}
                      </TableCell>
                      <TableCell>{colab.classificacao_salario}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {lotes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Envios</CardTitle>
            <CardDescription>Envios anteriores para cotação</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Competência</TableHead>
                    <TableHead>Data Envio</TableHead>
                    <TableHead>Colaboradores</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Observações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lotes.map((lote) => (
                    <TableRow key={lote.id}>
                      <TableCell className="font-medium">{lote.competencia}</TableCell>
                      <TableCell>
                        {format(new Date(lote.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>{lote.total_colaboradores}</TableCell>
                      <TableCell>{getStatusBadge(lote.status)}</TableCell>
                      <TableCell className="max-w-xs truncate">{lote.observacoes || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Envio para Cotação</DialogTitle>
            <DialogDescription>
              Preencha os dados do lote antes de enviar
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="competencia">Competência (Mês/Ano)</Label>
              <Input
                id="competencia"
                placeholder="MM/AAAA"
                value={formData.competencia}
                onChange={(e) => setFormData({ ...formData, competencia: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações (Opcional)</Label>
              <Textarea
                id="observacoes"
                placeholder="Adicione observações relevantes..."
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                rows={3}
              />
            </div>

            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm font-medium">Resumo do Envio:</p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                <li>• {colaboradores.length} colaboradores ativos</li>
                <li>• {alteracoes} alterações desde o último envio</li>
                <li>• Competência: {formData.competencia}</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={sending}>
              Cancelar
            </Button>
            <Button onClick={handleSendToQuote} disabled={sending}>
              {sending ? "Enviando..." : "Confirmar Envio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Cotacao;
