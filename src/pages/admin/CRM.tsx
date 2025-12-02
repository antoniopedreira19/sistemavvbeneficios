import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, LayoutGrid, List, Building2 } from "lucide-react";
import CRMKanban from "@/components/crm/CRMKanban";
import CRMList from "@/components/crm/CRMList";
import EmpresaDetailDialog from "@/components/crm/EmpresaDetailDialog";

export interface EmpresaCRM {
  id: string;
  nome: string;
  cnpj: string;
  email_contato: string | null;
  telefone_contato: string | null;
  emails_contato?: any;
  telefones_contato?: any;
  nome_responsavel: string | null;
  status_crm: string;
  created_at: string;
}

const CRM_STATUS_LABELS: Record<string, string> = {
  sem_retorno: "Sem Retorno",
  tratativa: "Tratativa",
  contrato_assinado: "Contrato Assinado",
  apolices_emitida: "Apólices Emitida",
  acolhimento: "Acolhimento",
  empresa_ativa: "Empresa Ativa",
};

const CRM = () => {
  const [empresas, setEmpresas] = useState<EmpresaCRM[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [selectedEmpresa, setSelectedEmpresa] = useState<EmpresaCRM | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchEmpresas = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome, cnpj, email_contato, telefone_contato, emails_contato, telefones_contato, nome_responsavel, status_crm, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEmpresas(data || []);
    } catch (error) {
      console.error("Erro ao buscar empresas:", error);
      toast.error("Erro ao carregar empresas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmpresas();

    const channel = supabase
      .channel("crm-empresas-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "empresas" },
        () => fetchEmpresas()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchEmpresas]);

  const handleUpdateStatus = async (empresaId: string, newStatus: string) => {
    // Optimistic update - update UI immediately
    const previousEmpresas = [...empresas];
    setEmpresas((prev) =>
      prev.map((empresa) =>
        empresa.id === empresaId
          ? { ...empresa, status_crm: newStatus }
          : empresa
      )
    );

    try {
      const { error } = await supabase
        .from("empresas")
        .update({ status_crm: newStatus })
        .eq("id", empresaId);

      if (error) throw error;
      toast.success("Status atualizado com sucesso");
    } catch (error) {
      // Revert on error
      setEmpresas(previousEmpresas);
      console.error("Erro ao atualizar status:", error);
      toast.error("Erro ao atualizar status");
    }
  };

  const handleSelectEmpresa = (empresa: EmpresaCRM) => {
    setSelectedEmpresa(empresa);
    setDialogOpen(true);
  };

  const filteredEmpresas = empresas.filter((empresa) =>
    empresa.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    empresa.cnpj.includes(searchTerm) ||
    empresa.email_contato?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const empresasByStatus = {
    sem_retorno: filteredEmpresas.filter((e) => e.status_crm === "sem_retorno"),
    tratativa: filteredEmpresas.filter((e) => e.status_crm === "tratativa"),
    contrato_assinado: filteredEmpresas.filter((e) => e.status_crm === "contrato_assinado"),
    apolices_emitida: filteredEmpresas.filter((e) => e.status_crm === "apolices_emitida"),
    acolhimento: filteredEmpresas.filter((e) => e.status_crm === "acolhimento"),
    empresa_ativa: filteredEmpresas.filter((e) => e.status_crm === "empresa_ativa"),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-8 w-8" />
            CRM
          </h1>
          <p className="text-muted-foreground">
            {filteredEmpresas.length} empresas cadastradas
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "kanban" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("kanban")}
          >
            <LayoutGrid className="h-4 w-4 mr-1" />
            Kanban
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4 mr-1" />
            Lista
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CNPJ ou e-mail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : viewMode === "kanban" ? (
        <CRMKanban
          empresasByStatus={empresasByStatus}
          statusLabels={CRM_STATUS_LABELS}
          onSelectEmpresa={handleSelectEmpresa}
          onUpdateStatus={handleUpdateStatus}
        />
      ) : (
        <CRMList
          empresas={filteredEmpresas}
          statusLabels={CRM_STATUS_LABELS}
          onSelectEmpresa={handleSelectEmpresa}
        />
      )}

      <EmpresaDetailDialog
        empresa={selectedEmpresa}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        statusLabels={CRM_STATUS_LABELS}
        onUpdateStatus={handleUpdateStatus}
        onEmpresaUpdated={fetchEmpresas}
      />
    </div>
  );
};

export default CRM;
