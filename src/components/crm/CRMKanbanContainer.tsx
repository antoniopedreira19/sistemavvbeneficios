import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import EmpresaDetailDialog from "@/components/crm/EmpresaDetailDialog";
import CRMKanban from "@/components/crm/CRMKanban";
import { EmpresaCRM } from "@/types/crm";

const STATUS_LABELS: Record<string, string> = {
  sem_retorno: "Sem Retorno",
  tratativa: "Em Tratativa",
  contrato_assinado: "Contrato Assinado",
  apolices_emitida: "Apólice Emitida",
  acolhimento: "Acolhimento",
  empresa_ativa: "Empresa Ativa",
};

const STATUS_ORDER = [
  "sem_retorno",
  "tratativa",
  "contrato_assinado",
  "apolices_emitida",
  "acolhimento",
  "empresa_ativa",
];

export function CRMKanbanContainer() {
  const [selectedEmpresa, setSelectedEmpresa] = useState<EmpresaCRM | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: empresas, isLoading } = useQuery({
    queryKey: ["empresas-crm"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("*")
        .neq("status_crm", "empresa_ativa")
        .order("nome");

      if (error) throw error;
      return data as EmpresaCRM[];
    },
  });

  const empresasByStatus = STATUS_ORDER.reduce((acc, status) => {
    acc[status] = empresas?.filter((e) => e.status_crm === status) || [];
    return acc;
  }, {} as Record<string, EmpresaCRM[]>);

  const handleSelectEmpresa = (empresa: EmpresaCRM) => {
    setSelectedEmpresa(empresa);
    setIsDetailOpen(true);
  };

  const handleUpdateStatus = async (empresaId: string, newStatus: string) => {
    const { error } = await supabase
      .from("empresas")
      .update({ status_crm: newStatus })
      .eq("id", empresaId);

    if (error) {
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["empresas-crm"] });
    toast({
      title: "Status atualizado",
      description: `Empresa movida para ${STATUS_LABELS[newStatus]}`,
    });
  };

  if (isLoading) {
    return (
      <div className="flex gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-96 w-72" />
        ))}
      </div>
    );
  }

  return (
    <>
      <CRMKanban
        empresasByStatus={empresasByStatus}
        statusLabels={STATUS_LABELS}
        onSelectEmpresa={handleSelectEmpresa}
        onUpdateStatus={handleUpdateStatus}
      />
      <EmpresaDetailDialog
        empresa={selectedEmpresa}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        statusLabels={STATUS_LABELS}
        onUpdateStatus={handleUpdateStatus}
        onEmpresaUpdated={() => queryClient.invalidateQueries({ queryKey: ["empresas-crm"] })}
      />
    </>
  );
}
