import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MailWarning, Loader2, Send } from "lucide-react";

export function CobrancaMassaDialog() {
  const [open, setOpen] = useState(false);
  const [competencia, setCompetencia] = useState("Janeiro/2025"); // Padrão ou dinâmico
  const [disparando, setDisparando] = useState(false);

  // Lista de competências para facilitar (pode ser dinâmica no futuro)
  const competencias = [
    "Novembro/2024", "Dezembro/2024", "Janeiro/2025", "Fevereiro/2025", "Março/2025"
  ];

  // 1. Busca prévia: Quem está pendente?
  const { data: pendentes = [], isLoading, refetch } = useQuery({
    queryKey: ["empresas-pendentes", competencia],
    enabled: open, // Só busca quando abre o modal
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_empresas_pendentes", {
        p_competencia: competencia,
      });
      if (error) throw error;
      return data;
    },
  });

  // 2. Ação: Chamar o n8n para enviar os emails
  const handleDispararCobranca = async () => {
    if (pendentes.length === 0) return;

    if (!confirm(`Deseja realmente enviar e-mails de cobrança para ${pendentes.length} empresas?`)) return;

    setDisparando(true);
    try {
      // Substitua pela URL do seu Webhook do n8n criado na Parte 2
      const N8N_WEBHOOK_URL = "https://seu-n8n.com/webhook/disparar-cobranca";
      
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competencia }),
      });

      if (!response.ok) throw new Error("Erro ao comunicar com n8n");

      toast.success("Comando de cobrança enviado com sucesso!");
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
      <DialogContent className="sm:max-w-[500px]">
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
                setTimeout(() => refetch(), 100); // Atualiza a contagem ao mudar
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {competencias.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-center">
            {isLoading ? (
              <div className="flex justify-center items-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-3xl font-bold text-slate-800">{pendentes.length}</p>
                <p className="text-sm text-muted-foreground">Empresas pendentes encontradas</p>
                {pendentes.length > 0 && (
                  <p className="text-xs text-slate-400 mt-2">
                    Ex: {pendentes[0].nome}, {pendentes[1]?.nome}...
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button 
            onClick={handleDispararCobranca} 
            disabled={pendentes.length === 0 || disparando || isLoading}
            className="bg-red-600 hover:bg-red-700"
          >
            {disparando ? (
              <>Enviando... <Loader2 className="ml-2 h-4 w-4 animate-spin" /></>
            ) : (
              <>Enviar {pendentes.length} E-mails <Send className="ml-2 h-4 w-4" /></>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
