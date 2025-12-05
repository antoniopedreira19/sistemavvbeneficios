import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, Users, DollarSign, AlertTriangle, TrendingUp, Activity } from "lucide-react";
import {
  BarChart,
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
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

// Cores para o gráfico de pizza
const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

export default function Dashboard() {
  // 1. QUERY DE DADOS GERAIS (KPIs e Gráficos)
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ["admin-dashboard-stats"],
    queryFn: async () => {
      const hoje = new Date();
      const mesAtual = format(hoje, "MMMM/yyyy", { locale: ptBR });
      // Primeira letra maiúscula para bater com o padrão "Dezembro/2025"
      const competenciaAtual = mesAtual.charAt(0).toUpperCase() + mesAtual.slice(1);

      // A. Buscar Empresas Ativas
      const { count: empresasAtivas } = await supabase
        .from("empresas")
        .select("*", { count: "exact", head: true })
        .eq("status", "ativa");

      // B. Buscar Lotes do Mês Atual (para KPIs financeiros e operacionais)
      const { data: lotesMes } = await supabase
        .from("lotes_mensais")
        .select("id, status, total_colaboradores, valor_total, total_aprovados")
        .eq("competencia", competenciaAtual);

      // C. Buscar Lotes Pendentes (Ação Necessária - Geral)
      const { count: acaoNecessaria } = await supabase
        .from("lotes_mensais")
        .select("*", { count: "exact", head: true })
        .in("status", ["aguardando_processamento", "aguardando_reanalise"]);

      // D. Dados para Gráfico de Evolução (Últimos 6 meses)
      // Nota: Buscamos tudo e filtramos no JS para simplificar a query,
      // mas em escala ideal seria uma RPC function no banco.
      const { data: historicoLotes } = await supabase
        .from("lotes_mensais")
        .select("competencia, total_colaboradores, created_at")
        .order("created_at", { ascending: true });

      return {
        empresasAtivas: empresasAtivas || 0,
        lotesMes: lotesMes || [],
        acaoNecessaria: acaoNecessaria || 0,
        historicoLotes: historicoLotes || [],
        competenciaAtual,
      };
    },
  });

  // 2. CÁLCULOS DERIVADOS (Processamento no Front para economizar requests)

  // KPI: Vidas Ativas no Mês
  const totalVidasMes = dashboardData?.lotesMes.reduce((acc, lote) => acc + (lote.total_colaboradores || 0), 0) || 0;

  // KPI: Faturamento Previsto (Soma valor_total ou calcula estimado)
  const faturamentoPrevisto =
    dashboardData?.lotesMes.reduce((acc, lote) => {
      const valor = lote.valor_total || (lote.total_aprovados || lote.total_colaboradores || 0) * 50;
      return acc + valor;
    }, 0) || 0;

  // CHART 1: Distribuição de Status (Pizza)
  const statusDist = [
    {
      name: "Na Seguradora",
      value: dashboardData?.lotesMes.filter((l) => l.status === "em_analise_seguradora").length || 0,
    },
    { name: "Pendentes", value: dashboardData?.lotesMes.filter((l) => l.status === "com_pendencia").length || 0 },
    {
      name: "Concluídos",
      value: dashboardData?.lotesMes.filter((l) => ["concluido", "faturado"].includes(l.status)).length || 0,
    },
    {
      name: "Em Aberto",
      value:
        dashboardData?.lotesMes.filter((l) => ["rascunho", "aguardando_processamento"].includes(l.status)).length || 0,
    },
  ].filter((item) => item.value > 0);

  // CHART 2: Evolução de Vidas (Barras - Últimos 6 meses)
  // Agrupamos os lotes históricos por competência
  const chartData =
    dashboardData?.historicoLotes
      ?.reduce((acc: any[], curr) => {
        const existing = acc.find((item) => item.name === curr.competencia);
        if (existing) {
          existing.vidas += curr.total_colaboradores || 0;
        } else {
          // Limita aos últimos X meses se quiser, aqui pega tudo que veio ordenado
          acc.push({ name: curr.competencia, vidas: curr.total_colaboradores || 0 });
        }
        return acc;
      }, [])
      .slice(-6) || []; // Pega só os últimos 6

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* CABEÇALHO */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Visão Geral</h2>
          <p className="text-muted-foreground">Resumo da operação em {dashboardData?.competenciaAtual}</p>
        </div>
        <div className="flex items-center space-x-2 bg-muted/50 p-2 rounded-lg">
          <Activity className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Sistema Operante</span>
        </div>
      </div>

      {/* GRID DE KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Empresas Ativas"
          value={dashboardData?.empresasAtivas}
          icon={Building2}
          description="Clientes na base"
        />

        <KpiCard title="Vidas Processadas" value={totalVidasMes} icon={Users} description="Neste mês" />

        <KpiCard
          title="Faturamento Previsto"
          value={`R$ ${faturamentoPrevisto.toLocaleString("pt-BR")}`}
          icon={DollarSign}
          description="Baseado nos lotes atuais"
        />

        <KpiCard
          title="Ação Necessária"
          value={dashboardData?.acaoNecessaria}
          icon={AlertTriangle}
          description="Lotes aguardando Admin"
          highlight={dashboardData?.acaoNecessaria > 0}
        />
      </div>

      {/* GRÁFICOS */}
      <div className="grid gap-4 md:grid-cols-7">
        {/* GRÁFICO DE BARRAS (Evolução) - Ocupa 4/7 */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Evolução de Vidas
            </CardTitle>
            <CardDescription>Total de colaboradores processados nos últimos 6 meses</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value}`}
                  />
                  <Tooltip
                    cursor={{ fill: "transparent" }}
                    contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                  />
                  <Bar dataKey="vidas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* GRÁFICO DE PIZZA (Status Atual) - Ocupa 3/7 */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Status da Operação</CardTitle>
            <CardDescription>Distribuição dos lotes de {dashboardData?.competenciaAtual}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {statusDist.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusDist}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {statusDist.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  Nenhum dado para exibir neste mês.
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

function KpiCard({ title, value, icon: Icon, description, highlight = false }: any) {
  return (
    <Card className={highlight ? "border-red-500 bg-red-50 dark:bg-red-950/20" : ""}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${highlight ? "text-red-500" : "text-muted-foreground"}`} />
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
