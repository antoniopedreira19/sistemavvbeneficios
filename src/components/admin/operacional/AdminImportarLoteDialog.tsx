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

// Helpers
const normalizarHeader = (h: string) =>
  h
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

const normalizarSexo = (valor: any): string => {
  if (!valor) return "Masculino";
  const str = String(valor).trim().toLowerCase();
  if (["masculino", "masc", "m"].includes(str)) return "Masculino";
  if (["feminino", "fem", "f"].includes(str)) return "Feminino";
  return "Masculino";
};

const normalizarSalario = (valor: any): number => {
  if (typeof valor === "number") return valor;
  if (!valor) return 0;
  const str = String(valor).replace(/R\$/g, "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

const normalizarData = (valor: any): string => {
  if (!valor) return new Date().toISOString().split("T")[0];
  const str = String(valor).trim();
  const ddmmyyyy = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
  if (!isNaN(Number(valor))) {
    const excelDate = XLSX.SSF.parse_date_code(Number(valor));
    if (excelDate)
      return `${excelDate.y}-${String(excelDate.m).padStart(2, "0")}-${String(excelDate.d).padStart(2, "0")}`;
  }
  return str;
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

      let targetSheetName = "";
      let jsonData: any[][] = [];

      // Procura inteligente da aba correta
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const tempJson = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        if (tempJson.length > 0) {
          const rawHeaders = tempJson[0].map((h: any) => String(h || "").trim());
          const headers = rawHeaders.map(normalizarHeader);
          const hasNome = headers.some((h) => ["nome", "funcionario", "colaborador"].some((n) => h.includes(n)));
          const hasCPF = headers.some((h) => ["cpf", "documento"].some((n) => h.includes(n)));

          if (hasNome && hasCPF) {
            targetSheetName = sheetName;
            jsonData = tempJson;
            break;
          }
        }
      }

      if (!targetSheetName) {
        toast.error("Não encontramos as colunas 'Nome' e 'CPF' em nenhuma aba.");
        setLoading(false);
        return;
      }

      toast.success(`Lendo aba: ${targetSheetName}`);

      const rawHeaders = jsonData[0].map((h: any) => String(h || "").trim());
      const headers = rawHeaders.map(normalizarHeader);
      const mapIndex = (possibleNames: string[]) =>
        headers.findIndex((h) => possibleNames.some((name) => h.includes(name)));

      const idxNome = mapIndex(["nome", "funcionario", "colaborador"]);
      const idxCPF = mapIndex(["cpf", "documento"]);
      const idxSalario = mapIndex(["salario", "vencimento", "remuneracao"]);
      const idxNasc = mapIndex(["nascimento", "data", "dtnasc"]);
      const idxSexo = mapIndex(["sexo", "genero"]);

      const validos = [];
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;

        const nome = row[idxNome];
        const cpfRaw = row[idxCPF];

        if (!nome || !cpfRaw) continue;

        const salario = idxSalario !== -1 ? normalizarSalario(row[idxSalario]) : 0;
        const cpfLimpo = String(cpfRaw).replace(/\D/g, "");

        if (cpfLimpo.length !== 11) continue;

        validos.push({
          nome: String(nome).toUpperCase().trim(),
          cpf: cpfLimpo,
          sexo: idxSexo !== -1 ? normalizarSexo(row[idxSexo]) : "Masculino",
          data_nascimento: idxNasc !== -1 ? normalizarData(row[idxNasc]) : new Date().toISOString().split("T")[0],
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
      // 1. Criar Lote
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

      // 2. Processar em Batches (Lotes de 100)
      const BATCH_SIZE = 100;
      for (let i = 0; i < colaboradores.length; i += BATCH_SIZE) {
        const batch = colaboradores.slice(i, i + BATCH_SIZE);

        // A. Upsert na Mestra e RETORNAR IDs
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

        // CORREÇÃO: Pegar os dados retornados (id, cpf) para vincular depois
        const { data: upsertedCols, error: upsertError } = await supabase
          .from("colaboradores")
          .upsert(mestraData, { onConflict: "cpf", ignoreDuplicates: false })
          .select("id, cpf"); // <--- Importante: Retorna o ID gerado/existente

        if (upsertError) {
          console.error("Erro upsert mestre", upsertError);
          throw new Error(`Erro ao salvar colaborador na base mestra: ${upsertError.message}`);
        }

        if (!upsertedCols) throw new Error("Erro: Nenhum dado retornado do upsert.");

        // Criar mapa CPF -> ID para vincular rápido
        const cpfToIdMap = new Map(upsertedCols.map((c) => [c.cpf, c.id]));

        // B. Insert na Tabela de Lote (Com vínculo correto)
        const loteItemsData = batch.map((c) => ({
          lote_id: lote.id,
          colaborador_id: cpfToIdMap.get(c.cpf), // <--- VÍNCULO CORRETO AQUI
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

      toast.success("Importação concluída e Lote Finalizado!");
      queryClient.invalidateQueries({ queryKey: ["lotes-operacional"] });
      onOpenChange(false);

      // Reset
      setStep("selecao");
      setColaboradores([]);
      setSelectedEmpresa("");
      setSelectedObra("");
    } catch (error: any) {
      console.error(error);
      toast.error("Erro no processo: " + error.message);
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
