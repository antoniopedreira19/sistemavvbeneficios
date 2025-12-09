import { useState, useEffect, useRef } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Upload, FileSpreadsheet, CheckCircle, Plus, Building, AlertTriangle } from "lucide-react";
import * as XLSX from "xlsx";
import { validateCPF, formatCPF } from "@/lib/validators";
import { findHeaderRowIndex, mapColumnIndexes, validateRequiredColumns } from "@/lib/excelImportUtils";

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

// Helpers de normalização (Robustez para o Excel)
const normalizarSexo = (valor: any): string | null => {
  if (!valor) return "M"; // Default
  const str = String(valor).trim().toLowerCase();
  if (["masculino", "masc", "m"].includes(str)) return "Masculino";
  if (["feminino", "fem", "f"].includes(str)) return "Feminino";
  return "Masculino";
};

const normalizarSalario = (valor: any): number => {
  if (typeof valor === "number") return valor;
  if (!valor) return 0;
  // Remove R$, espaços e converte vírgula para ponto
  const str = String(valor).replace(/R\$/g, "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

const normalizarData = (valor: any): string => {
  if (!valor) return new Date().toISOString().split("T")[0]; // Fallback hoje

  const str = String(valor).trim();
  // DD/MM/AAAA
  const ddmmyyyy = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;

  // Excel Serial Date
  if (!isNaN(Number(valor))) {
    const excelDate = XLSX.SSF.parse_date_code(Number(valor));
    if (excelDate)
      return `${excelDate.y}-${String(excelDate.m).padStart(2, "0")}-${String(excelDate.d).padStart(2, "0")}`;
  }

  return str; // Tenta retornar como está se for ISO
};

export function AdminImportarLoteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"selecao" | "upload" | "conclusao">("selecao");

  const [empresas, setEmpresas] = useState<{ id: string; nome: string }[]>([]);
  const [obras, setObras] = useState<{ id: string; nome: string }[]>([]);

  const [selectedEmpresa, setSelectedEmpresa] = useState("");
  const [selectedObra, setSelectedObra] = useState("");
  const [competencia, setCompetencia] = useState("");

  const [colaboradores, setColaboradores] = useState<any[]>([]);

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

  const createObraMutation = useMutation({
    mutationFn: async () => {
      const empresa = empresas.find((e) => e.id === selectedEmpresa);
      if (!empresa) throw new Error("Empresa inválida");

      const { data, error } = await supabase
        .from("obras")
        .insert({
          nome: empresa.nome,
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
      setObras([newObra]);
      setSelectedObra(newObra.id);
    },
    onError: (error) => {
      toast.error("Erro ao criar obra: " + error.message);
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Lê como Matriz de Matrizes (mais seguro para achar cabeçalhos)
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (jsonData.length < 2) {
        toast.error("Arquivo vazio ou inválido.");
        setLoading(false);
        return;
      }

      // 1. Encontrar a linha de cabeçalho (pula linhas em branco no topo)
      const headerRowIndex = findHeaderRowIndex(jsonData);
      const rawHeaders = jsonData[headerRowIndex].map((h: any) => String(h || "").trim());

      // 2. Mapear Índices das Colunas usando utilitário
      const { idxNome, idxCPF, idxSalario, idxNasc, idxSexo } = mapColumnIndexes(rawHeaders);

      // 3. Validar colunas obrigatórias
      const missingColumns = validateRequiredColumns({ idxNome, idxCPF, idxSalario, idxNasc, idxSexo });
      if (missingColumns.length > 0) {
        toast.error(`Colunas não encontradas: ${missingColumns.join(", ")}. Verifique o arquivo.`);
        setLoading(false);
        return;
      }

      // 4. Processar Linhas (começa após o cabeçalho)
      const validos = [];
      for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        // Pula linhas vazias
        if (!row || row.length === 0 || row.every((cell: any) => !cell || String(cell).trim() === "")) continue;

        const nome = row[idxNome];
        const cpfRaw = row[idxCPF];

        // Pula linha se não tiver nome ou CPF
        if (!nome || !cpfRaw) continue;

        const salario = normalizarSalario(row[idxSalario]);
        const cpfLimpo = String(cpfRaw).replace(/\D/g, "");

        // Validação mínima de CPF
        if (cpfLimpo.length !== 11) continue;

        validos.push({
          nome: String(nome).toUpperCase().trim(),
          cpf: cpfLimpo,
          sexo: normalizarSexo(row[idxSexo]),
          data_nascimento: normalizarData(row[idxNasc]),
          salario: salario,
          classificacao_salario: calcularClassificacao(salario),
        });
      }

      if (validos.length === 0) {
        toast.error("Nenhum colaborador válido encontrado.");
        setLoading(false);
        return;
      }

      setColaboradores(validos);
      setStep("conclusao");
      toast.success(`${validos.length} colaboradores identificados!`);
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
          status: "ativo" as "ativo" | "desligado",
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
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Lote Pronto (Admin)</DialogTitle>
          <DialogDescription>Importe uma lista já aprovada diretamente para o status "Concluído".</DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4 flex-1 overflow-y-auto pr-2">
          {step === "selecao" && (
            <div className="space-y-4 animate-in fade-in">
              <div className="space-y-2">
                <Label>Empresa Cliente</Label>
                <Select value={selectedEmpresa} onValueChange={setSelectedEmpresa}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a empresa..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
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
                      <SelectContent className="max-h-[200px]">
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
              <div
                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 hover:bg-muted/10 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-medium text-lg">Carregar Planilha (.xlsx)</h3>
                <p className="text-sm text-muted-foreground">Clique para selecionar o arquivo do seu computador</p>

                <Input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleFileUpload} />
              </div>
              <Button variant="ghost" size="sm" onClick={() => setStep("selecao")}>
                Voltar
              </Button>
            </div>
          )}

          {step === "conclusao" && (
            <div className="space-y-6 animate-in fade-in">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 flex items-start gap-3">
                <CheckCircle className="h-5 w-5 mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold">Arquivo Processado com Sucesso!</p>
                  <p className="text-sm mt-1">
                    Detectamos <strong>{colaboradores.length} colaboradores</strong> válidos.
                  </p>
                </div>
              </div>

              {/* TABELA DE PRÉ-VISUALIZAÇÃO */}
              <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Cargo Estimado</TableHead>
                      <TableHead className="text-right">Salário</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {colaboradores.slice(0, 100).map((colab, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{colab.nome}</TableCell>
                        <TableCell className="font-mono text-xs">{formatCPF(colab.cpf)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                            {colab.classificacao_salario}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {colab.salario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </TableCell>
                      </TableRow>
                    ))}
                    {colaboradores.length > 100 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-4 text-xs">
                          ... e mais {colaboradores.length - 100} colaboradores.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertTriangle className="h-5 w-5 text-yellow-400" aria-hidden="true" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700">
                      Ao confirmar, este lote será criado com status <strong>CONCLUÍDO</strong> e estará pronto para
                      faturamento. Certifique-se de que a lista está correta.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep("upload");
                    setColaboradores([]);
                  }}
                >
                  Trocar Arquivo
                </Button>
                <Button
                  onClick={handleConfirmarImportacao}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
                >
                  {loading ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                  Confirmar e Finalizar
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
