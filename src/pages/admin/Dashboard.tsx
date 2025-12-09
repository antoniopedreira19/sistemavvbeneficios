import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Building2,
  Wallet,
  DollarSign,
  Users,
  PieChart as PieIcon,
  BarChart3,
  Filter,
  TrendingUp,
  Activity,
  CheckCircle2,
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
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

// Cores para gráficos
const COLORS_GENDER = ["#0088FE", "#FF8042", "#8884d8"]; // Azul (M), Laranja (F), Outro
const COLORS_SALARY = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#0088fe"];

export default function Dashboard() {
  const [selectedCompetencia, setSelectedCompetencia] = useState<string>("");

  // 1. BUSCAR LISTA DE COMPETÊNCIAS (Para o Filtro)
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
    queryKey: ["admin-dashboard-stats-v4", selectedCompetencia],
    enabled: !!selectedCompetencia,
    queryFn: async () => {
      console.log("Buscando dados para:", selectedCompetencia);

      // --- DADOS GLOBAIS (SISTEMA) ---

      // A. Empresas Ativas (Total na Carteira)
      const { count: empresasAtivas } = await supabase
        .from("empresas")
        .select("*", { count: "exact", head: true })
        .eq("status", "ativa");

      // B. Vidas Ativas Totais (Para Faturamento Esperado)
      const { count: totalVidasAtivas } = await supabase
        .from("colaboradores")
        .select("*", { count: "exact", head: true })
        .eq("status", "ativo");

      const faturamentoEsperado = (totalVidasAtivas || 0) * 50;

      // --- DADOS DA COMPETÊNCIA (FILTRO) ---

      // C. Lotes do Mês Selecionado
      const { data: lotesMes } = await supabase
        .from("lotes_mensais")
        .select("id, empresa_id, status, total_colaboradores, valor_total, total_aprovados")
        .eq("competencia", selectedCompetencia);

      const lotesIds = lotesMes?.map((l) => l.id) || [];

      // D. Dados Detalhados (Para gráficos)
      let colaboradoresDetalhados: any[] = [];
      if (lotesIds.length > 0) {
        const { data } = await supabase.from("colaboradores_lote").select("sexo, salario").in("lote_id", lotesIds);
        colaboradoresDetalhados = data || [];
      }

      // E. Faturamento Realizado (Notas do Mês)
      const { data: notasMes } = await supabase
        .from("notas_fiscais")
        .select("valor_total")
        .eq("competencia", selectedCompetencia)
        .eq("nf_emitida", true);

      // F. Histórico (Para gráfico de evolução)
      const { data: historicoLotes } = await supabase
        .from("lotes_mensais")
        .select("competencia, total_colaboradores, valor_total, created_at")
        .order("created_at", { ascending: true });

      return {
        empresasAtivas: empresasAtivas || 0,
        faturamentoEsperado,
        totalVidasAtivas: totalVidasAtivas || 0,
        lotesMes: lotesMes || [],
        colaboradores: colaboradoresDetalhados,
        notasMes: notasMes || [],
        historicoLotes: historicoLotes || [],
      };
    },
  });

  // --- CÁLCULOS ---

  // KPIs
  const totalEmpresasNoMes = new Set(dashboardData?.lotesMes.map((l) => l.empresa_id)).size || 0;
  const faturamentoRealizado = dashboardData?.notasMes.reduce((acc, nf) => acc + Number(nf.valor_total), 0) || 0;
  const totalVidasMes = dashboardData?.lotesMes.reduce((acc, l) => acc + (l.total_colaboradores || 0), 0) || 0;

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

      {/* KPI CARDS - GRID DE 5 (RESPONSIVO) */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {/* 1. GERAL: Empresas Ativas */}
        <KpiCard
          title="Empresas Ativas"
          value={dashboardData?.empresasAtivas}
          icon={Building2}
          description="Total na carteira"
        />

        {/* 2. GERAL: Faturamento Esperado */}
        <KpiCard
          title="Faturamento Esperado"
          value={`R$ ${dashboardData?.faturamentoEsperado.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`}
          icon={Wallet}
          description="Potencial (Vidas Totais)"
          iconColor="text-blue-600"
        />

        {/* 3. MÊS: Empresas que Enviaram */}
        <KpiCard
          title="Empresas no Mês"
          value={totalEmpresasNoMes}
          icon={CheckCircle2}
          description={`Enviaram em ${selectedCompetencia.split("/")[0]}`}
          iconColor="text-purple-600"
        />

        {/* 4. MÊS: Vidas Processadas */}
        <KpiCard
          title="Vidas no Mês"
          value={totalVidasMes}
          icon={Users}
          description="Total processado"
          iconColor="text-orange-600"
        />

        {/* 5. MÊS: Faturamento Realizado */}
        <KpiCard
          title="Faturamento Real"
          value={`R$ ${faturamentoRealizado.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`}
          icon={DollarSign}
          description="Notas Emitidas"
          iconColor="text-green-600"
          highlight
        />
      </div>

      {/* GRÁFICOS DETALHADOS */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* GÊNERO */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PieIcon className="h-5 w-5 text-primary" />
              Distribuição por Gênero
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
                      label={({ name, pct }) => `${name} (${pct})`}
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
                <div className="text-muted-foreground text-sm">Sem dados para este mês.</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* FAIXA SALARIAL */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-5 w-5 text-primary" />
              Faixa Salarial
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
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  Sem dados salariais.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* GRÁFICO DE EVOLUÇÃO */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-5 w-5 text-primary" />
            Histórico de Evolução (Geral)
          </CardTitle>
          <CardDescription>Comparativo dos últimos 6 meses</CardDescription>
        </CardHeader>
        <CardContent>
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
                <Tooltip />
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
    </div>
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
}: any) {
  return (
    <Card className={highlight ? "border-green-500 bg-green-50" : ""}>
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
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}
