import { useState, useEffect, useRef } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Upload, FileSpreadsheet, CheckCircle, Plus, Building } from "lucide-react";
import * as XLSX from "xlsx";

// Reutilizando constantes de salário
const CLASSIFICACOES_SALARIO = [
  { label: "Ajudante Comum", minimo: 1454.2 },
  { label: "Ajudante Prático/Meio-Oficial", minimo: 1476.2 },
  { label: "Oficial", minimo: 2378.34 },
  { label: "Op. Qualificado I", minimo: 2637.8 },
  { label: "Op. Qualificado II", minimo: 3262.6 },
  { label: "Op. Qualificado III", minimo: 4037.0 },
];

const calcularClassificacao = (salario: number) => {
  if (salario < CLASSIFICACOES_SALARIO[0].minimo) return CLASSIFICACOES_SALARIO[0].label;
  const item = [...CLASSIFICACOES_SALARIO].reverse().find((c) => salario >= c.minimo);
  return item?.label || CLASSIFICACOES_SALARIO[0].label;
};

export function AdminImportarLoteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"selecao" | "upload" | "conclusao">("selecao");

  // Dados do Formulário
  const [empresas, setEmpresas] = useState<{ id: string; nome: string }[]>([]);
  const [obras, setObras] = useState<{ id: string; nome: string }[]>([]);

  const [selectedEmpresa, setSelectedEmpresa] = useState("");
  const [selectedObra, setSelectedObra] = useState("");
  const [competencia, setCompetencia] = useState("");

  // Dados do Arquivo
  const [colaboradores, setColaboradores] = useState<any[]>([]);

  // Carregar Empresas Ativas
  useEffect(() => {
    if (open) {
      supabase
        .from("empresas")
        .select("id, nome")
        .eq("status", "ativa")
        .order("nome")
        .then(({ data }) => setEmpresas(data || []));

      const data = new Date();
      const meses = [
        "Janeiro",
        "Fevereiro",
        "Março",
        "Abril",
        "Maio",
        "Junho",
        "Julho",
        "Agosto",
        "Setembro",
        "Outubro",
        "Novembro",
        "Dezembro",
      ];
      setCompetencia(`${meses[data.getMonth()]}/${data.getFullYear()}`);
    }
  }, [open]);

  // Carregar Obras
  useEffect(() => {
    if (selectedEmpresa) {
      setLoading(true);
      supabase
        .from("obras")
        .select("id, nome")
        .eq("empresa_id", selectedEmpresa)
        .eq("status", "ativa")
        .then(({ data }) => {
          setObras(data || []);
          setLoading(false);
        });
    } else {
      setObras([]);
    }
  }, [selectedEmpresa]);

  // --- NOVA FUNCIONALIDADE: CRIAR OBRA AUTOMÁTICA ---
  const createObraMutation = useMutation({
    mutationFn: async () => {
      const empresa = empresas.find((e) => e.id === selectedEmpresa);
      if (!empresa) throw new Error("Empresa inválida");

      const { data, error } = await supabase
        .from("obras")
        .insert({
          nome: empresa.nome, // Cria com o mesmo nome da empresa
          empresa_id: selectedEmpresa,
          status: "ativa",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (newObra) => {
      toast.success(`Obra "${newObra.nome}" criada com sucesso!`);
      // Atualiza a lista local e seleciona automaticamente
      setObras([newObra]);
      setSelectedObra(newObra.id);
    },
    onError: (error) => {
      toast.error("Erro ao criar obra: " + error.message);
    },
  });
  // --------------------------------------------------

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const validos = jsonData
        .map((row: any) => {
          const keys = Object.keys(row).reduce((acc, k) => ({ ...acc, [k.toLowerCase().trim()]: row[k] }), {} as any);

          const nome = keys["nome"] || keys["funcionario"] || keys["colaborador"];
          const cpfRaw = keys["cpf"] || keys["documento"];
          const salario = parseFloat(String(keys["salario"] || keys["vencimento"] || "0").replace(/[^\d.]/g, ""));
          const nascimento = keys["data nascimento"] || keys["nascimento"];

          if (!nome || !cpfRaw) return null;

          const cpfLimpo = String(cpfRaw).replace(/\D/g, "");

          return {
            nome: String(nome).toUpperCase(),
            cpf: cpfLimpo,
            sexo: keys["sexo"] ? String(keys["sexo"]).charAt(0).toUpperCase() : "M",
            data_nascimento: nascimento,
            salario: salario || 0,
            classificacao_salario: calcularClassificacao(salario || 0),
          };
        })
        .filter(Boolean);

      if (validos.length === 0) {
        toast.error("Nenhum colaborador válido encontrado na planilha.");
        return;
      }

      setColaboradores(validos);
      setStep("conclusao");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao ler arquivo.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmarImportacao = async () => {
    if (!selectedEmpresa || !selectedObra || colaboradores.length === 0) return;

    setLoading(true);
    try {
      const valorTotal = colaboradores.reduce((acc, c) => acc + 50, 0);

      const { data: lote, error: loteError } = await supabase
        .from("lotes_mensais")
        .insert({
          empresa_id: selectedEmpresa,
          obra_id: selectedObra,
          competencia: competencia,
          status: "concluido",
          total_colaboradores: colaboradores.length,
          total_aprovados: colaboradores.length,
          total_reprovados: 0,
          valor_total: valorTotal,
          enviado_seguradora_em: new Date().toISOString(),
          aprovado_em: new Date().toISOString(),
        })
        .select()
        .single();

      if (loteError) throw loteError;

      const BATCH_SIZE = 100;
      for (let i = 0; i < colaboradores.length; i += BATCH_SIZE) {
        const batch = colaboradores.slice(i, i + BATCH_SIZE);

        const mestraData = batch.map((c) => ({
          empresa_id: selectedEmpresa,
          obra_id: selectedObra,
          nome: c.nome,
          cpf: c.cpf,
          sexo: c.sexo,
          data_nascimento: c.data_nascimento,
          salario: c.salario,
          classificacao_salario: c.classificacao_salario,
          status: "ativo",
        }));

        const { error: upsertError } = await supabase
          .from("colaboradores")
          .upsert(mestraData, { onConflict: "cpf", ignoreDuplicates: false });

        if (upsertError) console.error("Erro upsert mestre", upsertError);

        const loteItemsData = batch.map((c) => ({
          lote_id: lote.id,
          nome: c.nome,
          cpf: c.cpf,
          sexo: c.sexo,
          data_nascimento: c.data_nascimento,
          salario: c.salario,
          classificacao_salario: c.classificacao_salario,
          status_seguradora: "aprovado",
        }));

        const { error: itemsError } = await supabase.from("colaboradores_lote").insert(loteItemsData);

        if (itemsError) throw itemsError;
      }

      toast.success("Lote importado e finalizado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["lotes-operacional"] });
      onOpenChange(false);

      setStep("selecao");
      setColaboradores([]);
      setSelectedEmpresa("");
      setSelectedObra("");
    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Importar Lote Pronto (Admin)</DialogTitle>
          <DialogDescription>Importe uma lista já aprovada diretamente para o status "Concluído".</DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {step === "selecao" && (
            <div className="space-y-4 animate-in fade-in">
              <div className="space-y-2">
                <Label>Empresa Cliente</Label>
                <Select value={selectedEmpresa} onValueChange={setSelectedEmpresa}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a empresa..." />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedEmpresa && (
                <div className="space-y-2">
                  <Label>Obra / Filial</Label>
                  {/* LÓGICA DE OBRA VAZIA */}
                  {obras.length === 0 && !loading ? (
                    <div className="border border-dashed border-yellow-300 bg-yellow-50 rounded-lg p-4 text-center space-y-3">
                      <div className="flex justify-center text-yellow-600">
                        <Building className="h-6 w-6" />
                      </div>
                      <p className="text-sm text-yellow-800 font-medium">
                        Esta empresa ainda não possui obras cadastradas.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="default"
                        className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
                        onClick={() => createObraMutation.mutate()}
                        disabled={createObraMutation.isPending}
                      >
                        {createObraMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="mr-2 h-4 w-4" />
                        )}
                        Criar Obra Padrão (Nome da Empresa)
                      </Button>
                    </div>
                  ) : (
                    <Select value={selectedObra} onValueChange={setSelectedObra}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a obra..." />
                      </SelectTrigger>
                      <SelectContent>
                        {obras.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {selectedObra && (
                <div className="space-y-2">
                  <Label>Competência (Mês/Ano)</Label>
                  <Input
                    value={competencia}
                    onChange={(e) => setCompetencia(e.target.value)}
                    placeholder="Ex: Janeiro/2025"
                  />
                </div>
              )}

              <div className="flex justify-end pt-4">
                <Button disabled={!selectedEmpresa || !selectedObra || !competencia} onClick={() => setStep("upload")}>
                  Próximo
                </Button>
              </div>
            </div>
          )}

          {step === "upload" && (
            <div className="space-y-4 animate-in fade-in text-center">
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 hover:bg-muted/10 transition-colors">
                <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
                <h3 className="font-medium">Carregar Planilha</h3>
                <p className="text-sm text-muted-foreground mb-4">Selecione o arquivo .xlsx com a lista final</p>

                <Input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleFileUpload} />
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={loading}>
                  {loading ? <Loader2 className="animate-spin mr-2" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
                  Selecionar Arquivo
                </Button>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setStep("selecao")}>
                Voltar
              </Button>
            </div>
          )}

          {step === "conclusao" && (
            <div className="space-y-4 animate-in fade-in">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 flex items-start gap-3">
                <CheckCircle className="h-5 w-5 mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold">Arquivo Processado!</p>
                  <p className="text-sm mt-1">
                    Detectamos <strong>{colaboradores.length} colaboradores</strong>.<br />
                    Ao confirmar, um lote será criado automaticamente como <strong>CONCLUÍDO</strong>.
                  </p>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep("upload");
                    setColaboradores([]);
                  }}
                >
                  Cancelar / Trocar
                </Button>
                <Button
                  onClick={handleConfirmarImportacao}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {loading ? <Loader2 className="animate-spin mr-2" /> : null}
                  Confirmar Importação
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
