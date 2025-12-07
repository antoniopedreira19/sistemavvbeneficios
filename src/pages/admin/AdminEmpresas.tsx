import { useState } from "react";
import { Building2, List, KanbanSquare, Plus, ArchiveX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NovaEmpresaDialog } from "@/components/admin/NovaEmpresaDialog";
import { CRMList } from "@/components/crm/CRMList";
import { CRMKanban } from "@/components/crm/CRMKanban";
import { CRMInactiveList } from "@/components/crm/CRMInactiveList";
export default function AdminEmpresas() {
  const [isNovaEmpresaOpen, setIsNovaEmpresaOpen] = useState(false);
  return <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Empresas</h1>
            <p className="text-muted-foreground">Gerencie sua carteira de clientes, inativos e funil de vendas.</p>
          </div>
        </div>
        <Button onClick={() => setIsNovaEmpresaOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Empresa
        </Button>
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