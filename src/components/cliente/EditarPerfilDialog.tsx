import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCNPJ, formatPhone, validateCNPJ } from "@/lib/validators";

interface EditarPerfilDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditarPerfilDialog({ open, onOpenChange }: EditarPerfilDialogProps) {
  const { profile } = useUserRole();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    telefone: "",
    nomeEmpresa: "",
    cnpj: "",
    telefoneEmpresa: "",
    emailEmpresa: "",
  });

  useEffect(() => {
    if (open && profile) {
      loadData();
    }
  }, [open, profile]);

  const loadData = async () => {
    try {
      if (!profile?.empresa_id) return;

      const { data: empresaData, error: empresaError } = await supabase
        .from("empresas")
        .select("*")
        .eq("id", profile.empresa_id)
        .single();

      if (empresaError) throw empresaError;

      setFormData({
        nome: profile.nome || "",
        telefone: (profile as any).celular || "",
        nomeEmpresa: empresaData?.nome || "",
        cnpj: empresaData?.cnpj || "",
        telefoneEmpresa: empresaData?.telefone_contato || "",
        emailEmpresa: empresaData?.email_contato || "",
      });
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados do perfil");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateCNPJ(formData.cnpj)) {
      toast.error("CNPJ inválido");
      return;
    }

    setLoading(true);
    try {
      // Atualizar perfil do usuário
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          nome: formData.nome,
          celular: formData.telefone,
        })
        .eq("id", profile?.id);

      if (profileError) throw profileError;

      // Atualizar dados da empresa
      const { error: empresaError } = await supabase
        .from("empresas")
        .update({
          nome: formData.nomeEmpresa,
          cnpj: formData.cnpj,
          telefone_contato: formData.telefoneEmpresa,
          email_contato: formData.emailEmpresa,
        })
        .eq("id", profile?.empresa_id);

      if (empresaError) throw empresaError;

      toast.success("Perfil atualizado com sucesso!");
      onOpenChange(false);
      window.location.reload();
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      toast.error("Erro ao atualizar perfil");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Editar Perfil</DialogTitle>
          <DialogDescription>
            Atualize suas informações pessoais e da empresa
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Dados Pessoais</h3>
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: formatPhone(e.target.value) })}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Dados da Empresa</h3>
              <div className="space-y-2">
                <Label htmlFor="nomeEmpresa">Nome da Empresa</Label>
                <Input
                  id="nomeEmpresa"
                  value={formData.nomeEmpresa}
                  onChange={(e) => setFormData({ ...formData, nomeEmpresa: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input
                  id="cnpj"
                  value={formData.cnpj}
                  onChange={(e) => setFormData({ ...formData, cnpj: formatCNPJ(e.target.value) })}
                  placeholder="00.000.000/0000-00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefoneEmpresa">Telefone</Label>
                <Input
                  id="telefoneEmpresa"
                  value={formData.telefoneEmpresa}
                  onChange={(e) => setFormData({ ...formData, telefoneEmpresa: formatPhone(e.target.value) })}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emailEmpresa">Email</Label>
                <Input
                  id="emailEmpresa"
                  type="email"
                  value={formData.emailEmpresa}
                  onChange={(e) => setFormData({ ...formData, emailEmpresa: e.target.value })}
                  placeholder="contato@empresa.com"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
