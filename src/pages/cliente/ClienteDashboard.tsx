import { useState } from "react";
import { 
  Upload, 
  Users, 
  FileText, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  ArrowRight,
  Calendar
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Mock data
const MOCK_EMPRESA = "Construtora ABC Ltda";
const MOCK_CURRENT_DAY = 15; // Simular dia do mês (mude para > 20 para ver estado de atraso)

const MOCK_RESUMO = {
  totalVidas: 127,
  ultimaFatura: "R$ 6.350,00",
  statusAtual: "Em dia"
};

const MOCK_HISTORICO = [
  { id: 1, competencia: "Novembro/2024", dataEnvio: "18/11/2024", vidas: 125, status: "concluido" },
  { id: 2, competencia: "Outubro/2024", dataEnvio: "15/10/2024", vidas: 122, status: "faturado" },
  { id: 3, competencia: "Setembro/2024", dataEnvio: "12/09/2024", vidas: 120, status: "faturado" },
];

const ClienteDashboard = () => {
  const isJanelaAberta = MOCK_CURRENT_DAY <= 20;
  const competenciaAtual = "Dezembro/2024";

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "concluido":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Concluído</Badge>;
      case "faturado":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Faturado</Badge>;
      case "em_analise":
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Em Análise</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Bem-vindo, {MOCK_EMPRESA}</h1>
        <p className="text-muted-foreground">Central de ações e acompanhamento</p>
      </div>

      {/* Card Principal - Status do Mês */}
      {isJanelaAberta ? (
        <Card className="border-green-500/30 bg-gradient-to-br from-green-500/5 to-emerald-500/10">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <CardTitle className="text-green-700">Janela de Movimentação Aberta</CardTitle>
            </div>
            <CardDescription>
              Você tem até o dia 20 para enviar a lista de {competenciaAtual}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Dias restantes: {20 - MOCK_CURRENT_DAY}</span>
              </div>
              <Button size="lg" className="gap-2">
                <Upload className="h-4 w-4" />
                Enviar Lista de {competenciaAtual.split("/")[0]}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-yellow-500/30 bg-gradient-to-br from-yellow-500/5 to-orange-500/10">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <CardTitle className="text-yellow-700">Envio em Atraso</CardTitle>
            </div>
            <CardDescription>
              A janela de movimentação para {competenciaAtual} encerrou no dia 20
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Entre em contato com o suporte para regularizar</span>
              </div>
              <Button size="lg" variant="outline" className="gap-2 border-yellow-500/50 text-yellow-700 hover:bg-yellow-500/10">
                <Upload className="h-4 w-4" />
                Enviar Lista (Atrasado)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cards de Resumo */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Vidas Ativas</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{MOCK_RESUMO.totalVidas}</div>
            <p className="text-xs text-muted-foreground">colaboradores cadastrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Última Fatura</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{MOCK_RESUMO.ultimaFatura}</div>
            <p className="text-xs text-muted-foreground">Novembro/2024</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status Atual</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{MOCK_RESUMO.statusAtual}</div>
            <p className="text-xs text-muted-foreground">sem pendências</p>
          </CardContent>
        </Card>
      </div>

      {/* Histórico Recente */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Histórico Recente</CardTitle>
          <CardDescription>Últimos envios realizados</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {MOCK_HISTORICO.map((item) => (
              <div 
                key={item.id} 
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{item.competencia}</p>
                    <p className="text-sm text-muted-foreground">
                      Enviado em {item.dataEnvio} • {item.vidas} vidas
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusBadge(item.status)}
                  <Button variant="ghost" size="sm">
                    Ver detalhes
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClienteDashboard;
