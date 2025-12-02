import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Obra {
  id: string;
  nome: string;
  status: string;
  data_previsao_termino: string | null;
}

interface EditarObraDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  obra: Obra;
  onSuccess: () => void;
}

export function EditarObraDialog({
  open,
  onOpenChange,
  obra,
  onSuccess,
}: EditarObraDialogProps) {
  const [nome, setNome] = useState("");
  const [status, setStatus] = useState<"ativa" | "inativa">("ativa");
  const [dataPrevisaoTermino, setDataPrevisaoTermino] = useState<Date>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (obra) {
      setNome(obra.nome);
      setStatus(obra.status as "ativa" | "inativa");
      if (obra.data_previsao_termino) {
        setDataPrevisaoTermino(parseISO(obra.data_previsao_termino));
      } else {
        setDataPrevisaoTermino(undefined);
      }
    }
  }, [obra]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome.trim()) {
      toast.error("Nome da obra é obrigatório");
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase
        .from("obras")
        .update({
          nome: nome.trim(),
          status,
          data_previsao_termino: dataPrevisaoTermino ? format(dataPrevisaoTermino, "yyyy-MM-dd") : null,
        })
        .eq("id", obra.id);

      if (error) throw error;

      toast.success("Obra atualizada com sucesso");
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Erro ao atualizar obra:", error);
      if (error.code === "23505") {
        toast.error("Já existe uma obra com este nome");
      } else {
        toast.error("Erro ao atualizar obra");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Obra</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome da Obra *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Obra Centro"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={(v: any) => setStatus(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ativa">Ativa</SelectItem>
                <SelectItem value="inativa">Inativa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Previsão de Término</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dataPrevisaoTermino && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataPrevisaoTermino ? (
                    format(dataPrevisaoTermino, "PPP", { locale: ptBR })
                  ) : (
                    <span>Selecione uma data</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataPrevisaoTermino}
                  onSelect={setDataPrevisaoTermino}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
