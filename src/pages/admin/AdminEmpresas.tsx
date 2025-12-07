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

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Empresas & CRM</h1>
            <p className="text-muted-foreground">Gerencie sua carteira de clientes, funil de vendas e histórico.</p>
          </div>
        </div>
        <Button onClick={() => setIsNovaEmpresaOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Empresa
        </Button>
      </div>

      <Tabs defaultValue="ativos" className="w-full">
        <TabsList className="grid w-full max-w-[600px] grid-cols-3">
          <TabsTrigger value="ativos" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            Ativos
          </TabsTrigger>
          <TabsTrigger value="crm" className="flex items-center gap-2">
            <KanbanSquare className="h-4 w-4" />
            CRM (Funil)
          </TabsTrigger>
          <TabsTrigger
            value="inativos"
            className="flex items-center gap-2 text-muted-foreground data-[state=active]:text-slate-900"
          >
            <ArchiveX className="h-4 w-4" />
            Outros Status
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ativos" className="mt-6">
          <CRMList />
        </TabsContent>

        <TabsContent value="crm" className="mt-6">
          <CRMKanban />
        </TabsContent>

        <TabsContent value="inativos" className="mt-6">
          <CRMInactiveList />
        </TabsContent>
      </Tabs>

      <NovaEmpresaDialog open={isNovaEmpresaOpen} onOpenChange={setIsNovaEmpresaOpen} />
    </div>
  );
}
