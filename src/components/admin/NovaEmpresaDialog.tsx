import { useState } from "react";
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
import { formatCNPJ, formatCPF } from "@/lib/validators"; // Certifique-se que formatCPF existe aqui ou em utils

interface NovaEmpresaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NovaEmpresaDialog({ open, onOpenChange }: NovaEmpresaDialogProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  // Campos
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [endereco, setEndereco] = useState("");
  const [responsavelNome, setResponsavelNome] = useState("");
  const [responsavelCpf, setResponsavelCpf] = useState("");

  const criarEmpresaMutation = useMutation({
    mutationFn: async () => {
      const cnpjLimpo = cnpj.replace(/\D/g, "");
      const cpfLimpo = responsavelCpf.replace(/\D/g, "");

      if (cnpjLimpo.length !== 14) {
        throw new Error("CNPJ inválido (deve ter 14 dígitos)");
      }

      const { error } = await supabase.from("empresas").insert({
        nome,
        cnpj: cnpjLimpo,
        endereco: endereco || null,
        responsavel_nome: responsavelNome || null,
        responsavel_cpf: cpfLimpo || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Empresa criada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["admin-empresas"] });
      onOpenChange(false);
      // Reset form
      setNome("");
      setCnpj("");
      setEndereco("");
      setResponsavelNome("");
      setResponsavelCpf("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao criar empresa");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !cnpj) {
      toast.error("Nome e CNPJ são obrigatórios");
      return;
    }
    criarEmpresaMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nova Empresa</DialogTitle>
            <DialogDescription>Cadastre uma nova empresa cliente no sistema.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Dados Principais */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="nome" className="text-right">
                Nome *
              </Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="col-span-3"
                placeholder="Razão Social ou Fantasia"
                required
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="cnpj" className="text-right">
                CNPJ *
              </Label>
              <Input
                id="cnpj"
                value={cnpj}
                onChange={(e) => setCnpj(formatCNPJ(e.target.value))}
                className="col-span-3"
                placeholder="00.000.000/0000-00"
                maxLength={18}
                required
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="endereco" className="text-right">
                Endereço
              </Label>
              <Input
                id="endereco"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                className="col-span-3"
                placeholder="Rua, Número, Bairro, Cidade - UF"
              />
            </div>

            <div className="border-t my-2"></div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Dados do Responsável (Contrato)</p>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="resp_nome" className="text-right">
                Nome Resp.
              </Label>
              <Input
                id="resp_nome"
                value={responsavelNome}
                onChange={(e) => setResponsavelNome(e.target.value)}
                className="col-span-3"
                placeholder="Nome completo do assinante"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="resp_cpf" className="text-right">
                CPF Resp.
              </Label>
              <Input
                id="resp_cpf"
                value={responsavelCpf}
                onChange={(e) => setResponsavelCpf(formatCPF(e.target.value))}
                className="col-span-3"
                placeholder="000.000.000-00"
                maxLength={14}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={criarEmpresaMutation.isPending}>
              {criarEmpresaMutation.isPending ? "Salvando..." : "Salvar Empresa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
