import { Building2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const AdminEmpresas = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Building2 className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold">Empresas</h1>
      </div>

      <Tabs defaultValue="clientes" className="w-full">
        <TabsList>
          <TabsTrigger value="clientes">Clientes Ativos</TabsTrigger>
          <TabsTrigger value="crm">CRM / Funil</TabsTrigger>
        </TabsList>
        
        <TabsContent value="clientes" className="mt-6">
          <p className="text-muted-foreground">
            Lista de clientes ativos - em desenvolvimento.
          </p>
        </TabsContent>
        
        <TabsContent value="crm" className="mt-6">
          <p className="text-muted-foreground">
            Kanban CRM - em desenvolvimento.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminEmpresas;
