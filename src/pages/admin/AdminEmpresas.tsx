import { useState } from "react";
import { Building2, List, KanbanSquare, Plus, ArchiveX, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NovaEmpresaDialog } from "@/components/admin/NovaEmpresaDialog";
import { CRMList } from "@/components/crm/CRMList";
import { CRMKanban } from "@/components/crm/CRMKanban";
import { CRMInactiveList } from "@/components/crm/CRMInactiveList";
export default function AdminEmpresas() {
  const [isNovaEmpresaOpen, setIsNovaEmpresaOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleBaixarVidas = async () => {
    setIsDownloading(true);
    toast.info("Gerando relatório...");

    try {
      const { data, error } = await supabase
        .from("colaboradores")
        .select(`
          nome,
          sexo,
          salario,
          classificacao_salario,
          empresas!inner(nome),
          obras(nome)
        `)
        .eq("status", "ativo")
        .order("nome");

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.warning("Nenhuma vida ativa encontrada.");
        setIsDownloading(false);
        return;
      }

      const dadosFormatados = data.map((colab: any) => ({
        "Empresa": colab.empresas?.nome || "",
        "Obra": colab.obras?.nome || "Sem obra",
        "Nome": colab.nome || "",
        "Sexo": colab.sexo || "",
        "Salário": colab.salario 
          ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(colab.salario)
          : "",
        "Classificação do Salário": colab.classificacao_salario || "",
      }));

      // Ordenar por Empresa → Obra → Nome
      dadosFormatados.sort((a, b) => {
        if (a.Empresa !== b.Empresa) return a.Empresa.localeCompare(b.Empresa);
        if (a.Obra !== b.Obra) return a.Obra.localeCompare(b.Obra);
        return a.Nome.localeCompare(b.Nome);
      });

      const ws = XLSX.utils.json_to_sheet(dadosFormatados);
      ws["!cols"] = Array(6).fill({ wch: 35 });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Vidas Ativas");
      XLSX.writeFile(wb, "vidas_ativas.xlsx");

      toast.success(`${data.length} vidas exportadas com sucesso!`);
    } catch (error: any) {
      console.error("Erro ao exportar vidas:", error);
      toast.error("Erro ao gerar relatório: " + error.message);
    } finally {
      setIsDownloading(false);
    }
  };

  return <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Empresas</h1>
            <p className="text-muted-foreground">Gerencie sua carteira de clientes</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleBaixarVidas} disabled={isDownloading}>
            <Download className="mr-2 h-4 w-4" />
            Baixar Vidas
          </Button>
          <Button onClick={() => setIsNovaEmpresaOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Empresa
          </Button>
        </div>
      </div>

      <Tabs defaultValue="ativos" className="w-full">
        <TabsList className="grid w-full max-w-[600px] grid-cols-3">
          {/* 1. ATIVOS */}
          <TabsTrigger value="ativos" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            Ativos
          </TabsTrigger>

          {/* 2. INATIVOS (Movido para o meio) */}
          <TabsTrigger value="inativos" className="flex items-center gap-2 text-muted-foreground data-[state=active]:text-red-600">
            <ArchiveX className="h-4 w-4" />
            Inativas
          </TabsTrigger>

          {/* 3. CRM (Movido para o fim) */}
          <TabsTrigger value="crm" className="flex items-center gap-2">
            <KanbanSquare className="h-4 w-4" />
            CRM
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ativos" className="mt-6">
          <CRMList />
        </TabsContent>

        <TabsContent value="inativos" className="mt-6">
          <CRMInactiveList />
        </TabsContent>

        <TabsContent value="crm" className="mt-6">
          <CRMKanban />
        </TabsContent>
      </Tabs>

      <NovaEmpresaDialog open={isNovaEmpresaOpen} onOpenChange={setIsNovaEmpresaOpen} />
    </div>;
}