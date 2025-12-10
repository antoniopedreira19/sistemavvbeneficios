import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CorrigirPendenciasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loteId: string | null;
  obraNome: string;
  competencia: string;
}

interface ColaboradorReprovado {
  id: string;
  nome: string;
  cpf: string;
  motivo_reprovacao_seguradora: string | null;
}

export function CorrigirPendenciasDialog({
  open,
  onOpenChange,
  loteId,
  obraNome,
  competencia,
}: CorrigirPendenciasDialogProps) {
  // Buscar colaboradores reprovados do lote
  const { data: reprovados, isLoading } = useQuery({
    queryKey: ["colaboradores-reprovados", loteId],
    queryFn: async () => {
      if (!loteId) return [];
      const { data, error } = await supabase
        .from("colaboradores_lote")
        .select("id, nome, cpf, motivo_reprovacao_seguradora")
        .eq("lote_id", loteId)
        .eq("status_seguradora", "reprovado")
        .order("nome");

      if (error) throw error;
      return data as ColaboradorReprovado[];
    },
    enabled: open && !!loteId,
  });

  // Buscar totais do lote
  const { data: lote } = useQuery({
    queryKey: ["lote-detalhes", loteId],
    queryFn: async () => {
      if (!loteId) return null;
      const { data, error } = await supabase
        .from("lotes_mensais")
        .select("total_aprovados, total_reprovados, valor_total")
        .eq("id", loteId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: open && !!loteId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            Pendências do Lote
          </DialogTitle>
          <DialogDescription>
            {obraNome} - {competencia}
          </DialogDescription>
        </DialogHeader>

        {/* Resumo do Lote */}
        <Alert className="border-green-500/30 bg-green-500/5">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">
            <strong>{lote?.total_aprovados || 0} colaboradores foram aprovados</strong> e o lote foi processado com sucesso.
            O valor total aprovado é de <strong>R$ {(lote?.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>.
          </AlertDescription>
        </Alert>

        {reprovados && reprovados.length > 0 && (
          <Alert className="border-orange-500/30 bg-orange-500/5">
            <AlertCircle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-700">
              <strong>{reprovados.length} colaborador(es) foram reprovados</strong> pela seguradora. 
              Você receberá orientações por e-mail sobre como proceder.
            </AlertDescription>
          </Alert>
        )}

        <ScrollArea className="h-[300px] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin" />
            </div>
          ) : reprovados && reprovados.length > 0 ? (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Colaboradores reprovados:</h4>
              {reprovados.map((colaborador) => (
                <div key={colaborador.id} className="border rounded-lg p-3 space-y-2 bg-red-50/50">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{colaborador.nome}</span>
                    <Badge variant="destructive">Reprovado</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    CPF: {colaborador.cpf}
                  </div>
                  {colaborador.motivo_reprovacao_seguradora && (
                    <div className="bg-red-100 text-red-700 text-sm p-2 rounded">
                      <strong>Motivo:</strong> {colaborador.motivo_reprovacao_seguradora}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">Nenhuma pendência encontrada.</p>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
