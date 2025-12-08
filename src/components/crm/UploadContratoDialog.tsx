import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadCloud, Loader2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface UploadContratoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaId: string;
  empresaNome: string;
  onSuccess: () => void;
}

export function UploadContratoDialog({
  open,
  onOpenChange,
  empresaId,
  empresaNome,
  onSuccess,
}: UploadContratoDialogProps) {
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const queryClient = useQueryClient();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 15 * 1024 * 1024) {
        toast.error("Arquivo muito grande. Limite de 15MB.");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Selecione um arquivo para enviar.");
      return;
    }

    setUploading(true);
    try {
      const fileExt = selectedFile.name.split(".").pop();
      const cleanName = empresaNome.toUpperCase().replace(/[^A-Z0-9]/g, "_");
      const fileName = `CONTRATO_${cleanName}_${Date.now()}.${fileExt}`;

      // Upload para Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("contratos")
        .upload(fileName, selectedFile, { upsert: true });

      if (uploadError) throw uploadError;

      // Pegar URL pública
      const { data: { publicUrl } } = supabase.storage
        .from("contratos")
        .getPublicUrl(fileName);

      // Salvar no banco
      const { error: dbError } = await supabase
        .from("empresas")
        .update({ contrato_url: publicUrl })
        .eq("id", empresaId);

      if (dbError) throw dbError;

      // Invalidar queries
      queryClient.invalidateQueries({ queryKey: ["empresa-detail", empresaId] });
      queryClient.invalidateQueries({ queryKey: ["empresas-ativas"] });
      queryClient.invalidateQueries({ queryKey: ["crm-empresas"] });

      toast.success("Contrato enviado com sucesso!");
      setSelectedFile(null);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro ao enviar contrato. Tente novamente.");
    } finally {
      setUploading(false);
    }
  };

  const handleClose = (openState: boolean) => {
    if (!uploading) {
      setSelectedFile(null);
      onOpenChange(openState);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Anexar Contrato
          </DialogTitle>
          <DialogDescription>
            Anexe o contrato assinado da empresa <strong>{empresaNome}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="contract-file">Arquivo do Contrato (PDF, DOC, DOCX)</Label>
            <Input
              id="contract-file"
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleFileChange}
              disabled={uploading}
              className="cursor-pointer"
            />
          </div>

          {selectedFile && (
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-sm truncate flex-1">{selectedFile.name}</span>
              <span className="text-xs text-muted-foreground">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => handleClose(false)} disabled={uploading}>
            Cancelar
          </Button>
          <Button onClick={handleUpload} disabled={uploading || !selectedFile}>
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Enviando...
              </>
            ) : (
              <>
                <UploadCloud className="h-4 w-4 mr-2" />
                Enviar Contrato
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
