import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, Wallet, DollarSign, AlertTriangle, TrendingUp, Activity } from "lucide-react";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

export default function Dashboard() {
  // 1. QUERY DE DADOS GERAIS
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ["admin-dashboard-stats-v2"],
    queryFn: async () => {
      const hoje = new Date();
      const mesAtual = format(hoje, "MMMM/yyyy", { locale: ptBR });
      const competenciaAtual = mesAtual.charAt(0).toUpperCase() + mesAtual.slice(1);

      // A. Empresas Ativas
      const { count: empresasAtivas } = await supabase
        .from("empresas")
        .select("*", { count: "exact", head: true })
        .eq("status", "ativa");

      // B. Faturamento Realizado (Notas Emitidas no Mês)
      const { data: notasMes } = await supabase
        .from("notas_fiscais")
        .select("valor_total")
        .eq("competencia", competenciaAtual)
        .eq("nf_emitida", true);

      const faturamentoRealizado = notasMes?.reduce((acc, nf) => acc + Number(nf.valor_total), 0) || 0;

      // C. Faturamento Esperado (Total Vidas Ativas * 50)
      const { count: totalVidasAtivas } = await supabase
        .from("colaboradores")
        .select("*", { count: "exact", head: true })
        .eq("status", "ativo");

      const faturamentoEsperado = (totalVidasAtivas || 0) * 50;

      // D. Ação Necessária (Lotes Pendentes)
      const { count: acaoNecessaria } = await supabase
        .from("lotes_mensais")
        .select("*", { count: "exact", head: true })
        .in("status", ["aguardando_processamento", "aguardando_reanalise"]);

      // E. Lotes do Mês (Para gráfico de Pizza)
      const { data: lotesMes } = await supabase
        .from("lotes_mensais")
        .select("status")
        .eq("competencia", competenciaAtual);

      // F. Histórico Evolutivo
      const { data: historicoLotes } = await supabase
        .from("lotes_mensais")
        .select("competencia, total_colaboradores, valor_total, created_at")
        .order("created_at", { ascending: true });

      return {
        empresasAtivas: empresasAtivas || 0,
        faturamentoRealizado,
        faturamentoEsperado,
        totalVidasAtivas: totalVidasAtivas || 0,
        acaoNecessaria: acaoNecessaria || 0,
        lotesMes: lotesMes || [],
        historicoLotes: historicoLotes || [],
        competenciaAtual,
      };
    },
  });

  // 2. PROCESSAMENTO DE DADOS

  const statusDist = [
    {
      name: "Na Seguradora",
      value:
        dashboardData?.lotesMes.filter((l) => l.status === "em_analise_seguradora" || l.status === "em_reanalise")
          .length || 0,
    },
    {
      name: "Com Pendência",
      value:
        dashboardData?.lotesMes.filter((l) => l.status === "com_pendencia" || l.status === "aguardando_reanalise")
          .length || 0,
    },
    {
      name: "Faturados/Concluídos",
      value: dashboardData?.lotesMes.filter((l) => ["concluido", "faturado"].includes(l.status)).length || 0,
    },
    {
      name: "Novos/Aguardando",
      value:
        dashboardData?.lotesMes.filter((l) => ["rascunho", "aguardando_processamento"].includes(l.status)).length || 0,
    },
  ].filter((item) => item.value > 0);

  const rawChartData =
    dashboardData?.historicoLotes?.reduce((acc: any[], curr) => {
      const existing = acc.find((item) => item.name === curr.competencia);
      const valor = Number(curr.valor_total) || Number(curr.total_colaboradores) * 50;

      if (existing) {
        existing.vidas += curr.total_colaboradores || 0;
        existing.faturamento += valor;
      } else {
        acc.push({
          name: curr.competencia,
          vidas: curr.total_colaboradores || 0,
          faturamento: valor,
        });
      }
      return acc;
    }, []) || [];

  const chartData = rawChartData.slice(-6);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Visão Geral</h2>
          <p className="text-muted-foreground">Resumo financeiro e operacional de {dashboardData?.competenciaAtual}</p>
        </div>
        <div className="flex items-center space-x-2 bg-muted/50 p-2 rounded-lg">
          <Activity className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Operação Ativa</span>
        </div>
      </div>

      {/* KPI CARDS (Reordenados) */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* 1. Empresas */}
        <KpiCard
          title="Empresas Ativas"
          value={dashboardData?.empresasAtivas}
          icon={Building2}
          description="Total na carteira"
        />

        {/* 2. Faturamento Realizado */}
        <KpiCard
          title="Faturamento (NFs)"
          value={`R$ ${dashboardData?.faturamentoRealizado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          icon={DollarSign}
          description="Confirmado no mês atual"
          iconColor="text-green-600"
        />

        {/* 3. Faturamento Esperado */}
        <KpiCard
          title="Faturamento Esperado"
          value={`R$ ${dashboardData?.faturamentoEsperado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          icon={Wallet}
          description={`${dashboardData?.totalVidasAtivas} vidas ativas x R$ 50,00`}
          iconColor="text-blue-600"
        />

        {/* 4. Ação Necessária */}
        <KpiCard
          title="Ação Necessária"
          value={dashboardData?.acaoNecessaria}
          icon={AlertTriangle}
          description="Lotes aguardando análise"
          highlight={dashboardData?.acaoNecessaria > 0}
        />
      </div>

      {/* GRÁFICOS */}
      <div className="grid gap-4 md:grid-cols-7">
        {/* GRÁFICO COMPOSTO */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Evolução Financeira & Vidas
            </CardTitle>
            <CardDescription>Faturamento (Barras) vs Vidas (Linha)</CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />

                  {/* Eixo Y Esquerdo: Faturamento (Dinheiro) */}
                  <YAxis
                    yAxisId="left"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `R$${val / 1000}k`}
                    label={{
                      value: "Faturamento",
                      angle: -90,
                      position: "insideLeft",
                      style: { fill: "#82ca9d" }, // Verde
                    }}
                  />

                  {/* Eixo Y Direito: Vidas (Números) - Afastado */}
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    label={{
                      value: "Vidas",
                      angle: 90,
                      position: "insideRight",
                      offset: 15, // Afasta o título do eixo
                      style: { fill: "#8884d8" }, // Roxo
                    }}
                  />

                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                    formatter={(value: any, name: any) => {
                      if (name === "Faturamento") return [`R$ ${value.toLocaleString("pt-BR")}`, name];
                      return [value, name];
                    }}
                  />
                  <Legend />

                  {/* Barras = Faturamento (Verde) */}
                  <Bar
                    yAxisId="left"
                    dataKey="faturamento"
                    name="Faturamento"
                    fill="#82ca9d"
                    barSize={30}
                    radius={[4, 4, 0, 0]}
                  />

                  {/* Linha = Vidas (Roxo) */}
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

        {/* GRÁFICO DE PIZZA */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Status Operacional do Mês</CardTitle>
            <CardDescription>{dashboardData?.competenciaAtual}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[350px] w-full flex items-center justify-center">
              {statusDist.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusDist}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {statusDist.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-muted-foreground">
                  <p>Sem dados operacionais neste mês.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// --- Componentes Auxiliares ---

function KpiCard({
  title,
  value,
  icon: Icon,
  description,
  highlight = false,
  iconColor = "text-muted-foreground",
}: any) {
  return (
    <Card className={highlight ? "border-red-500 bg-red-50 dark:bg-red-950/20" : ""}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${highlight ? "text-red-500" : iconColor}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${highlight ? "text-red-600" : ""}`}>{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8 p-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-7">
        <Skeleton className="col-span-4 h-[400px] rounded-xl" />
        <Skeleton className="col-span-3 h-[400px] rounded-xl" />
      </div>
    </div>
  );
}
