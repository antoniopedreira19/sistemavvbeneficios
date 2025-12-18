import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import {
  Building2,
  Wallet,
  DollarSign,
  Users,
  PieChart as PieIcon,
  BarChart3,
  Filter,
  TrendingUp,
  Trophy,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  ComposedChart,
  Line,
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LabelList,
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

// Cores para gráficos
const COLORS_GENDER = ["#1e3a5f", "#be185d"]; // Azul escuro, Rosa escuro
const COLORS_SALARY = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#0088fe"];
const COLORS_TOP5 = ["#22c55e", "#16a34a", "#15803d", "#166534", "#14532d"];
const COLORS_AGE = ["#06b6d4", "#0891b2", "#0e7490", "#155e75", "#164e63", "#134e4a"];

export default function Dashboard() {
  const [selectedCompetencia, setSelectedCompetencia] = useState<string>("");
  const [showCompaniesModal, setShowCompaniesModal] = useState(false);

  // 1. BUSCAR LISTA DE COMPETÊNCIAS
  const { data: competencias = [] } = useQuery({
    queryKey: ["dashboard-competencias-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("lotes_mensais")
        .select("competencia")
        .order("created_at", { ascending: false });

      const unique = Array.from(new Set(data?.map((d) => d.competencia))).filter(Boolean);

      if (unique.length === 0) {
        const hoje = new Date();
        const mesAtual = format(hoje, "MMMM/yyyy", { locale: ptBR });
        return [mesAtual.charAt(0).toUpperCase() + mesAtual.slice(1)];
      }
      return unique;
    },
  });

  useEffect(() => {
    if (!selectedCompetencia && competencias.length > 0) {
      setSelectedCompetencia(competencias[0]);
    }
  }, [competencias, selectedCompetencia]);

  // 2. QUERY PRINCIPAL
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ["admin-dashboard-stats-v6", selectedCompetencia],
    enabled: !!selectedCompetencia,
    queryFn: async () => {
      console.log("Buscando dados para:", selectedCompetencia);

      // A. Empresas Ativas
      const { count: empresasAtivas } = await supabase
        .from("empresas")
        .select("*", { count: "exact", head: true })
        .eq("status", "ativa");

      // B. Vidas Ativas Totais (para referência)
      const { count: totalVidasAtivas } = await supabase
        .from("colaboradores")
        .select("*", { count: "exact", head: true })
        .eq("status", "ativo");

      // C. Lotes do Mês Selecionado
      const { data: lotesMes } = await supabase
        .from("lotes_mensais")
        .select(
          `
          id, 
          empresa_id, 
          status, 
          total_colaboradores, 
          valor_total, 
          total_aprovados,
          empresa:empresas(nome), 
          obra:obras(nome)
        `,
        )
        .eq("competencia", selectedCompetencia);

      const lotesIds = lotesMes?.map((l) => l.id) || [];

      // D. Dados Detalhados dos Colaboradores
      let colaboradoresDetalhados: any[] = [];
      if (lotesIds.length > 0) {
        const { data } = await supabase.from("colaboradores_lote").select("sexo, salario, data_nascimento").in("lote_id", lotesIds);
        colaboradoresDetalhados = data || [];
      }

      // E. Faturamento Realizado
      const { data: notasMes } = await supabase
        .from("notas_fiscais")
        .select("valor_total")
        .eq("competencia", selectedCompetencia)
        .eq("nf_emitida", true);

      // F. Histórico
      const { data: historicoLotes } = await supabase
        .from("lotes_mensais")
        .select("competencia, total_colaboradores, valor_total, created_at")
        .order("created_at", { ascending: true });

      // G. TODAS AS EMPRESAS ATIVAS (Para calcular pendentes)
      const { data: allActiveCompanies } = await supabase
        .from("empresas")
        .select("id, nome, colaboradores(count)")
        .eq("status", "ativa")
        .eq("colaboradores.status", "ativo");

      return {
        empresasAtivas: empresasAtivas || 0,
        totalVidasAtivas: totalVidasAtivas || 0,
        lotesMes: lotesMes || [],
        colaboradores: colaboradoresDetalhados,
        notasMes: notasMes || [],
        historicoLotes: historicoLotes || [],
        allActiveCompanies: allActiveCompanies || [],
      };
    },
  });

  // --- CÁLCULOS ---

  // KPIs
  const totalEmpresasNoMes = new Set(dashboardData?.lotesMes.map((l) => l.empresa_id)).size || 0;
  const faturamentoRealizado = dashboardData?.notasMes.reduce((acc, nf) => acc + Number(nf.valor_total), 0) || 0;
  const totalVidasMes = dashboardData?.lotesMes.reduce((acc, l) => acc + (l.total_colaboradores || 0), 0) || 0;
  
  // Faturamento esperado = apenas vidas que ENVIARAM no mês * R$50
  const faturamentoEsperado = totalVidasMes * 50;

  // Gráfico Gênero
  const genderStats =
    dashboardData?.colaboradores.reduce((acc: any, curr) => {
      const sexo = curr.sexo ? curr.sexo.charAt(0).toUpperCase() : "N/A";
      acc[sexo] = (acc[sexo] || 0) + 1;
      return acc;
    }, {}) || {};

  const genderChartData = [
    { name: "Masculino", value: genderStats["M"] || 0 },
    { name: "Feminino", value: genderStats["F"] || 0 },
  ].filter((d) => d.value > 0);

  const genderTotal = genderChartData.reduce((acc, curr) => acc + curr.value, 0);
  const genderChartDataWithPct = genderChartData.map((d) => ({
    ...d,
    pct: genderTotal > 0 ? ((d.value / genderTotal) * 100).toFixed(1) + "%" : "0%",
  }));

  // Gráfico Salário
  const salaryRanges = [
    { label: "Até 1.5k", min: 0, max: 1500, count: 0 },
    { label: "1.5k - 2.5k", min: 1500, max: 2500, count: 0 },
    { label: "2.5k - 5k", min: 2500, max: 5000, count: 0 },
    { label: "5k - 10k", min: 5000, max: 10000, count: 0 },
    { label: "+10k", min: 10000, max: 9999999, count: 0 },
  ];

  dashboardData?.colaboradores.forEach((c) => {
    const sal = Number(c.salario) || 0;
    const range = salaryRanges.find((r) => sal >= r.min && sal < r.max);
    if (range) range.count++;
  });

  const salaryChartData = salaryRanges.map((r) => ({
    name: r.label,
    quantidade: r.count,
    pct: totalVidasMes > 0 ? ((r.count / totalVidasMes) * 100).toFixed(1) + "%" : "0%",
  }));

  // Função para calcular idade
  const calcularIdade = (dataNascimento: string) => {
    const hoje = new Date();
    const nascimento = new Date(dataNascimento);
    let idade = hoje.getFullYear() - nascimento.getFullYear();
    const mesAtual = hoje.getMonth();
    const mesNasc = nascimento.getMonth();
    if (mesAtual < mesNasc || (mesAtual === mesNasc && hoje.getDate() < nascimento.getDate())) {
      idade--;
    }
    return idade;
  };

  // Gráfico Idade
  const ageRanges = [
    { label: "18-25", min: 18, max: 25, count: 0 },
    { label: "26-35", min: 26, max: 35, count: 0 },
    { label: "36-45", min: 36, max: 45, count: 0 },
    { label: "46-55", min: 46, max: 55, count: 0 },
    { label: "56-65", min: 56, max: 65, count: 0 },
    { label: "65+", min: 66, max: 999, count: 0 },
  ];

  dashboardData?.colaboradores.forEach((c) => {
    if (c.data_nascimento) {
      const idade = calcularIdade(c.data_nascimento);
      const range = ageRanges.find((r) => idade >= r.min && idade <= r.max);
      if (range) range.count++;
    }
  });

  const ageChartData = ageRanges.map((r) => ({
    name: r.label,
    quantidade: r.count,
    pct: totalVidasMes > 0 ? ((r.count / totalVidasMes) * 100).toFixed(1) + "%" : "0%",
  }));

  const totalComIdade = ageChartData.reduce((acc, curr) => acc + curr.quantidade, 0);

  // Gráfico Evolução
  const evolutionMap = dashboardData?.historicoLotes?.reduce((acc: any, curr) => {
    if (!acc[curr.competencia]) {
      acc[curr.competencia] = { name: curr.competencia, vidas: 0, faturamento: 0 };
    }
    const valor = Number(curr.valor_total) || Number(curr.total_colaboradores) * 50;
    acc[curr.competencia].vidas += curr.total_colaboradores || 0;
    acc[curr.competencia].faturamento += valor;
    return acc;
  }, {});

  const evolutionChartData = Object.values(evolutionMap || {}).slice(-6) as any[];

  // Top 5 Faturamento
  const revenueByCompany: Record<string, number> = {};
  dashboardData?.lotesMes.forEach((lote: any) => {
    const nome = lote.empresa?.nome || "Desconhecida";
    const valor = Number(lote.valor_total) || Number(lote.total_colaboradores || 0) * 50;
    revenueByCompany[nome] = (revenueByCompany[nome] || 0) + valor;
  });

  const top5Revenue = Object.entries(revenueByCompany)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // --- PREPARAÇÃO DE DADOS PARA O MODAL ---

  // 1. Enviados
  const companiesSentIds = new Set(dashboardData?.lotesMes.map((l) => l.empresa_id));

  const companiesSentData =
    dashboardData?.lotesMes
      .map((lote: any) => ({
        empresa: lote.empresa?.nome.toUpperCase() || "DESCONHECIDA",
        obra: lote.obra?.nome.toUpperCase() || "OBRA PRINCIPAL",
        vidas: lote.total_colaboradores || 0,
        faturamento: Number(lote.valor_total) || Number(lote.total_colaboradores) * 50,
      }))
      .sort((a, b) => a.empresa.localeCompare(b.empresa)) || [];

  // 2. Pendentes
  const companiesPendingData =
    dashboardData?.allActiveCompanies
      .filter((empresa: any) => !companiesSentIds.has(empresa.id))
      .map((empresa: any) => {
        const vidasAtivas = empresa.colaboradores?.[0]?.count || 0;
        return {
          empresa: empresa.nome.toUpperCase(),
          vidas: vidasAtivas,
          previsao_faturamento: vidasAtivas * 50,
        };
      })
      .sort((a, b) => a.empresa.localeCompare(b.empresa)) || [];

  if (isLoading) return <DashboardSkeleton />;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* HEADER + FILTRO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard Analítico</h2>
          <p className="text-muted-foreground">Visão detalhada da competência selecionada</p>
        </div>

        <div className="flex items-center gap-2 bg-white p-2 rounded-lg border shadow-sm">
          <Filter className="h-4 w-4 text-muted-foreground ml-2" />
          <Select value={selectedCompetencia} onValueChange={setSelectedCompetencia}>
            <SelectTrigger className="w-[200px] border-0 focus:ring-0">
              <SelectValue placeholder="Selecione o Mês" />
            </SelectTrigger>
            <SelectContent>
              {competencias.map((comp: string) => (
                <SelectItem key={comp} value={comp}>
                  {comp}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          title="Empresas Ativas"
          value={dashboardData?.empresasAtivas}
          icon={Building2}
          description="Total na carteira"
        />

        <KpiCard
          title="Empresas no Mês"
          value={totalEmpresasNoMes}
          icon={CheckCircle2}
          description={`Enviaram em ${selectedCompetencia.split("/")[0]}`}
          iconColor="text-purple-600"
          className="cursor-pointer hover:shadow-md transition-shadow active:scale-95"
          onClick={() => setShowCompaniesModal(true)}
        />

        <KpiCard
          title="Vidas no Mês"
          value={totalVidasMes}
          icon={Users}
          description="Total processado"
          iconColor="text-orange-600"
        />

        <KpiCard
          title="Faturamento Esperado"
          value={`R$ ${faturamentoEsperado.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`}
          icon={Wallet}
          description="Vidas Enviadas × R$50"
          iconColor="text-blue-600"
        />

        <KpiCard
          title="Faturamento Real"
          value={`R$ ${faturamentoRealizado.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`}
          icon={DollarSign}
          description="Notas Emitidas"
          iconColor="text-green-600"
          highlight
        />
      </div>

      {/* GRÁFICOS */}
      <div className="grid gap-4 md:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5 text-primary" />
              Evolução Financeira & Vidas
            </CardTitle>
            <CardDescription>Últimos 6 meses</CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={evolutionChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis
                    yAxisId="left"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `R$${val / 1000}k`}
                  />
                  <YAxis yAxisId="right" orientation="right" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                    formatter={(value: any, name: any) => {
                      if (name === "Faturamento")
                        return [value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), name];
                      return [value, name];
                    }}
                  />
                  <Legend />
                  <Bar
                    yAxisId="left"
                    dataKey="faturamento"
                    name="Faturamento"
                    fill="#82ca9d"
                    barSize={30}
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="vidas"
                    name="Vidas"
                    stroke="#8884d8"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Top 5 Faturamento
            </CardTitle>
            <CardDescription>Maiores empresas em {selectedCompetencia}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {top5Revenue.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={top5Revenue} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={100}
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => (val.length > 15 ? val.slice(0, 15) + "..." : val)}
                    />
                    <Tooltip
                      cursor={{ fill: "transparent" }}
                      formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR")}`, "Faturamento"]}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={25}>
                      {top5Revenue.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS_TOP5[index % COLORS_TOP5.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  Sem dados financeiros.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PieIcon className="h-5 w-5 text-primary" /> Distribuição por Gênero
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full flex items-center justify-center">
              {genderChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={genderChartDataWithPct}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ pct }) => pct}
                    >
                      {genderChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS_GENDER[index % COLORS_GENDER.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [value, "Colaboradores"]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-muted-foreground text-sm">Sem dados.</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-5 w-5 text-primary" /> Faixa Salarial
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {totalVidasMes > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={salaryChartData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={80} fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip
                      cursor={{ fill: "transparent" }}
                      formatter={(value: number, name: string, props: any) => [
                        `${value} pessoas (${props.payload.pct})`,
                        "Quantidade",
                      ]}
                    />
                    <Bar dataKey="quantidade" fill="#8884d8" radius={[0, 4, 4, 0]} barSize={25}>
                      {salaryChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS_SALARY[index % COLORS_SALARY.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Sem dados.</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5 text-cyan-600" /> Distribuição por Idade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {totalComIdade > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={ageChartData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={50} fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip
                      cursor={{ fill: "transparent" }}
                      formatter={(value: number, name: string, props: any) => [
                        `${value} pessoas (${props.payload.pct})`,
                        "Quantidade",
                      ]}
                    />
                    <Bar dataKey="quantidade" fill="#06b6d4" radius={[0, 4, 4, 0]} barSize={25}>
                      {ageChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS_AGE[index % COLORS_AGE.length]} />
                      ))}
                      <LabelList dataKey="pct" position="right" fontSize={11} fill="#374151" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Sem dados.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* MODAL DE EMPRESAS ATUALIZADO */}
      <CompaniesInMonthModal
        open={showCompaniesModal}
        onOpenChange={setShowCompaniesModal}
        sentData={companiesSentData}
        pendingData={companiesPendingData}
        competencia={selectedCompetencia}
      />
    </div>
  );
}

// --- COMPONENTE DO MODAL COM ABAS E TOTALIZADORES ---
function CompaniesInMonthModal({ open, onOpenChange, sentData, pendingData, competencia }: any) {
  // Totais Enviados
  const totalSentVidas = sentData.reduce((acc: number, item: any) => acc + item.vidas, 0);
  const totalSentFat = sentData.reduce((acc: number, item: any) => acc + item.faturamento, 0);

  // Totais Pendentes
  const totalPendingVidas = pendingData.reduce((acc: number, item: any) => acc + item.vidas, 0);
  const totalPendingFat = pendingData.reduce((acc: number, item: any) => acc + item.previsao_faturamento, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Relatório de Envio: {competencia}</DialogTitle>
          <DialogDescription>Acompanhe quem já enviou e quem ainda está pendente.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="enviados" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2 mb-2">
            <TabsTrigger
              value="enviados"
              className="data-[state=active]:bg-green-100 data-[state=active]:text-green-800"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" /> Enviaram ({sentData.length})
            </TabsTrigger>
            <TabsTrigger value="pendentes" className="data-[state=active]:bg-red-100 data-[state=active]:text-red-800">
              <AlertCircle className="h-4 w-4 mr-2" /> Pendentes ({pendingData.length})
            </TabsTrigger>
          </TabsList>

          {/* ABA ENVIADOS */}
          <TabsContent value="enviados" className="flex-1 flex flex-col overflow-hidden border rounded-md p-0 m-0">
            {/* TOTALIZADOR ENVIADOS */}
            <div className="flex items-center justify-between p-3 bg-muted/20 border-b">
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 text-blue-600 rounded-full">
                    <Users className="h-3 w-3" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase">Total Vidas</p>
                    <p className="text-sm font-bold">{totalSentVidas}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-green-100 text-green-600 rounded-full">
                    <DollarSign className="h-3 w-3" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase">Total Faturamento</p>
                    <p className="text-sm font-bold">
                      {totalSentFat.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Obra</TableHead>
                    <TableHead className="text-center">Vidas</TableHead>
                    <TableHead className="text-right">Faturamento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sentData.length > 0 ? (
                    sentData.map((item: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{item.empresa}</TableCell>
                        <TableCell className="text-muted-foreground">{item.obra}</TableCell>
                        <TableCell className="text-center">
                          <span className="font-bold text-green-600">{item.vidas}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          {item.faturamento.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        Nenhuma empresa enviou nesta competência ainda.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ABA PENDENTES */}
          <TabsContent value="pendentes" className="flex-1 flex flex-col overflow-hidden border rounded-md p-0 m-0">
            {/* TOTALIZADOR PENDENTES */}
            <div className="flex items-center justify-between p-3 bg-red-50/50 border-b border-red-100">
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-red-100 text-red-600 rounded-full">
                    <Users className="h-3 w-3" />
                  </div>
                  <div>
                    <p className="text-[10px] text-red-600/80 font-bold uppercase">Vidas Pendentes</p>
                    <p className="text-sm font-bold text-red-700">{totalPendingVidas}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-red-100 text-red-600 rounded-full">
                    <DollarSign className="h-3 w-3" />
                  </div>
                  <div>
                    <p className="text-[10px] text-red-600/80 font-bold uppercase">Previsão Faturamento</p>
                    <p className="text-sm font-bold text-red-700">
                      {totalPendingFat.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead className="text-center">Vidas Importadas</TableHead>
                    <TableHead className="text-right">Previsão Faturamento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingData.length > 0 ? (
                    pendingData.map((item: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium text-red-700">{item.empresa}</TableCell>
                        <TableCell className="text-center">
                          {item.vidas > 0 ? (
                            <span className="font-bold">{item.vidas}</span>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              Sem dados
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {item.previsao_faturamento.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        Todas as empresas ativas já enviaram! 🎉
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helpers
function KpiCard({
  title,
  value,
  icon: Icon,
  description,
  highlight = false,
  iconColor = "text-muted-foreground",
  onClick,
  className = "",
}: any) {
  return (
    <Card className={cn(highlight ? "border-green-500 bg-green-50" : "", className)} onClick={onClick}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${highlight ? "text-green-600" : iconColor}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${highlight ? "text-green-700" : ""}`}>{value}</div>
        <p className="text-xs text-muted-foreground truncate">{description}</p>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8 p-6">
      <div className="flex justify-between">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-4 md:grid-cols-5">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      <div className="grid gap-4 md:grid-cols-7">
        <Skeleton className="col-span-4 h-80" />
        <Skeleton className="col-span-3 h-80" />
      </div>
    </div>
  );
}
