import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { MailWarning, Loader2, Send, Building2, Mail } from "lucide-react";
import { formatCNPJ } from "@/lib/validators";

// Gera competência atual no formato "Mês/Ano"
const getCompetenciaAtual = () => {
  const now = new Date();
  const mes = format(now, "MMMM", { locale: ptBR });
  const mesCapitalizado = mes.charAt(0).toUpperCase() + mes.slice(1);
  return `${mesCapitalizado}/${now.getFullYear()}`;
};

// Gera lista de competências (últimos 3 meses + próximos 3 meses)
const gerarCompetencias = () => {
  const competencias: string[] = [];
  const now = new Date();
  
  for (let i = -3; i <= 3; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const mes = format(date, "MMMM", { locale: ptBR });
    const mesCapitalizado = mes.charAt(0).toUpperCase() + mes.slice(1);
    competencias.push(`${mesCapitalizado}/${date.getFullYear()}`);
  }
  
  return competencias;
};

export function CobrancaMassaDialog() {
  const [open, setOpen] = useState(false);
  const [competencia, setCompetencia] = useState(getCompetenciaAtual());
  const [disparando, setDisparando] = useState(false);

  const competencias = gerarCompetencias();

  interface EmpresaPendente {
    id: string;
    nome: string;
    cnpj: string;
    email: string;
    responsavel: string;
  }

  // 1. Busca prévia: Quem está pendente?
  const {
    data: pendentes = [] as EmpresaPendente[],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["empresas-pendentes", competencia],
    enabled: open, // Só busca quando abre o modal
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_empresas_pendentes", {
        p_competencia: competencia,
      });
      if (error) throw error;
      return (data || []) as EmpresaPendente[];
    },
  });

  // 2. Ação: Chamar edge function para enviar via n8n
  const handleDispararCobranca = async () => {
    if (pendentes.length === 0) return;

    if (!confirm(`Deseja realmente enviar e-mails de cobrança para ${pendentes.length} empresas?`)) return;

    setDisparando(true);
    try {
      // Envia apenas nome e email de cada empresa
      const empresasPayload = pendentes.map((emp) => ({
        nome: emp.nome,
        email: emp.email,
      }));

      const { data, error } = await supabase.functions.invoke("disparar-cobranca-massa", {
        body: { 
          competencia,
          empresas: empresasPayload,
        },
      });

      if (error) throw error;

      toast.success(`Cobrança enviada para ${pendentes.length} empresas!`);
      setOpen(false);
    } catch (error) {
      toast.error("Erro ao disparar cobrança.");
      console.error(error);
    } finally {
      setDisparando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" className="gap-2">
          <MailWarning className="h-4 w-4" />
          Cobrar Pendentes
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Disparo de Cobrança em Massa</DialogTitle>
          <DialogDescription>
            Envie e-mails automáticos para empresas ativas que ainda não enviaram a lista.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Selecione a Competência</Label>
            <Select
              value={competencia}
              onValueChange={(val) => {
                setCompetencia(val);
                setTimeout(() => refetch(), 100);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {competencias.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg border">
            {isLoading ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : pendentes.length === 0 ? (
              <div className="text-center py-6">
                <Building2 className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-muted-foreground">Nenhuma empresa pendente encontrada</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Todas as empresas ativas já enviaram a lista para {competencia}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Empresas Pendentes</p>
                  <span className="text-xs bg-destructive/10 text-destructive px-2 py-1 rounded-full font-medium">
                    {pendentes.length} {pendentes.length === 1 ? "empresa" : "empresas"}
                  </span>
                </div>
                
                <ScrollArea className="h-[250px] pr-3">
                  <div className="space-y-2">
                    {pendentes.map((emp) => (
                      <div
                        key={emp.id}
                        className="bg-background p-3 rounded-md border flex items-start gap-3"
                      >
                        <Building2 className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{emp.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatCNPJ(emp.cnpj || "")}
                          </p>
                          {emp.email && (
                            <div className="flex items-center gap-1 mt-1">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              <p className="text-xs text-muted-foreground truncate">
                                {emp.email}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleDispararCobranca}
            disabled={pendentes.length === 0 || disparando || isLoading}
            className="bg-red-600 hover:bg-red-700"
          >
            {disparando ? (
              <>
                Enviando... <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              </>
            ) : (
              <>
                Enviar {pendentes.length} E-mails <Send className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
