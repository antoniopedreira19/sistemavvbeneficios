import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatCNPJ, formatCPF } from "@/lib/validators";

interface EditarEmpresaDialogProps {
  empresa: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // ADIÇÃO: Esta propriedade estava faltando
  onSuccess?: () => void;
}

export function EditarEmpresaDialog({ empresa, open, onOpenChange, onSuccess }: EditarEmpresaDialogProps) {
  const queryClient = useQueryClient();

  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [endereco, setEndereco] = useState("");
  const [responsavelNome, setResponsavelNome] = useState("");
  const [responsavelCpf, setResponsavelCpf] = useState("");

  // Carregar dados ao abrir
  useEffect(() => {
    if (empresa) {
      setNome(empresa.nome || "");
      setCnpj(formatCNPJ(empresa.cnpj || ""));
      setEndereco(empresa.endereco || "");
      setResponsavelNome(empresa.responsavel_nome || "");
      setResponsavelCpf(formatCPF(empresa.responsavel_cpf || ""));
    }
  }, [empresa, open]);

  const editarEmpresaMutation = useMutation({
    mutationFn: async () => {
      const cnpjLimpo = cnpj.replace(/\D/g, "");
      const cpfLimpo = responsavelCpf.replace(/\D/g, "");

      if (cnpjLimpo.length !== 14) {
        throw new Error("CNPJ inválido (deve ter 14 dígitos)");
      }

      const { error } = await supabase
        .from("empresas")
        .update({
          nome,
          cnpj: cnpjLimpo,
          endereco: endereco || null,
          responsavel_nome: responsavelNome || null,
          responsavel_cpf: cpfLimpo || null,
        })
        .eq("id", empresa.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Empresa atualizada com sucesso!");

      // Invalida cache global
      queryClient.invalidateQueries({ queryKey: ["admin-empresas"] });
      queryClient.invalidateQueries({ queryKey: ["crm-empresas"] }); // Garante refresh do CRM também

      // ADIÇÃO: Chama o callback do pai, se existir
      if (onSuccess) {
        onSuccess();
      }

      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao atualizar empresa");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    editarEmpresaMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Editar Empresa</DialogTitle>
            <DialogDescription>Atualize os dados cadastrais da empresa.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_nome" className="text-right">
                Nome
              </Label>
              <Input
                id="edit_nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="col-span-3"
                required
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_cnpj" className="text-right">
                CNPJ
              </Label>
              <Input
                id="edit_cnpj"
                value={cnpj}
                onChange={(e) => setCnpj(formatCNPJ(e.target.value))}
                className="col-span-3"
                maxLength={18}
                required
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_endereco" className="text-right">
                Endereço
              </Label>
              <Input
                id="edit_endereco"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                className="col-span-3"
                placeholder="Rua, Número, Bairro..."
              />
            </div>

            <div className="border-t my-2"></div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Dados do Responsável</p>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_resp_nome" className="text-right">
                Nome Resp.
              </Label>
              <Input
                id="edit_resp_nome"
                value={responsavelNome}
                onChange={(e) => setResponsavelNome(e.target.value)}
                className="col-span-3"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_resp_cpf" className="text-right">
                CPF Resp.
              </Label>
              <Input
                id="edit_resp_cpf"
                value={responsavelCpf}
                onChange={(e) => setResponsavelCpf(formatCPF(e.target.value))}
                className="col-span-3"
                maxLength={14}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={editarEmpresaMutation.isPending}>
              {editarEmpresaMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
