import { useState, useEffect, useRef } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  Loader2,
  Upload,
  FileSpreadsheet,
  CheckCircle,
  Plus,
  Building,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import * as XLSX from "xlsx";
import { validateCPF, formatCPF } from "@/lib/validators";
import { cn } from "@/lib/utils";

// --- CONSTANTES ---
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

// --- HELPERS DE NORMALIZAÇÃO ---
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

interface ValidatedRow {
  linha: number;
  nome: string;
  cpf: string;
  sexo: string;
  data_nascimento: string;
  salario: number;
  classificacao_salario: string;
  status: "valido" | "erro";
  erros: string[];
}

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
  const [openCombobox, setOpenCombobox] = useState(false);

  const [colaboradores, setColaboradores] = useState<ValidatedRow[]>([]);

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
      supabase
        .from("obras")
        .select("id, nome")
        .eq("empresa_id", selectedEmpresa)
        .eq("status", "ativa")
        .then(({ data }) => {
          setObras(data || []);
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

      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const tempJson = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        if (tempJson.length > 0) {
          for (let i = 0; i < Math.min(5, tempJson.length); i++) {
            const row = tempJson[i];
            const rawHeaders = row.map((h: any) => String(h || "").trim());
            const headers = rawHeaders.map(normalizarHeader);
            const hasNome = headers.some((h) => ["nome", "funcionario", "colaborador"].some((n) => h.includes(n)));
            const hasCPF = headers.some((h) => ["cpf", "documento"].some((n) => h.includes(n)));

            if (hasNome && hasCPF) {
              targetSheetName = sheetName;
              jsonData = tempJson.slice(i);
              break;
            }
          }
          if (targetSheetName) break;
        }
      }

      if (!targetSheetName) {
        toast.error("Colunas 'Nome' e 'CPF' não encontradas. Verifique a planilha.");
        setLoading(false);
        return;
      }

      const rawHeaders = jsonData[0].map((h: any) => String(h || "").trim());
      const headers = rawHeaders.map(normalizarHeader);

      const idxNome = headers.findIndex((h) => ["nome", "funcionario", "colaborador"].some((n) => h.includes(n)));
      const idxCPF = headers.findIndex((h) => ["cpf", "documento"].some((n) => h.includes(n)));
      const idxSalario = headers.findIndex((h) => ["salario", "vencimento", "remuneracao"].some((n) => h.includes(n)));
      const idxNasc = headers.findIndex((h) => ["nascimento", "data", "dtnasc"].some((n) => h.includes(n)));
      const idxSexo = headers.findIndex((h) => ["sexo", "genero"].some((n) => h.includes(n)));

      const processados: ValidatedRow[] = [];
      const cpfsVistos = new Set<string>();

      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;

        const nome = row[idxNome] ? String(row[idxNome]).trim() : "";
        const cpfRaw = row[idxCPF] ? String(row[idxCPF]) : "";
        const salario = idxSalario !== -1 ? normalizarSalario(row[idxSalario]) : 0;

        const cpfLimpo = cpfRaw.replace(/\D/g, "");
        const erros: string[] = [];

        if (!nome) erros.push("Nome ausente");
        if (cpfLimpo.length !== 11) erros.push("CPF tamanho inválido");
        else if (!validateCPF(cpfLimpo)) erros.push("CPF inválido");

        if (cpfsVistos.has(cpfLimpo)) erros.push("Duplicado na planilha");
        if (cpfLimpo) cpfsVistos.add(cpfLimpo);

        processados.push({
          linha: i + 1,
          nome: nome.toUpperCase(),
          cpf: cpfLimpo,
          sexo: idxSexo !== -1 ? normalizarSexo(row[idxSexo]) : "Masculino",
          data_nascimento: idxNasc !== -1 ? normalizarData(row[idxNasc]) : new Date().toISOString().split("T")[0],
          salario: salario,
          classificacao_salario: calcularClassificacao(salario),
          status: erros.length > 0 ? "erro" : "valido",
          erros: erros,
        });
      }

      if (processados.length === 0) {
        toast.error("Nenhum dado encontrado.");
        setLoading(false);
        return;
      }

      processados.sort((a, b) => (a.status === "erro" ? -1 : 1));
      setColaboradores(processados);
      setStep("conclusao");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao ler arquivo.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmarImportacao = async () => {
    const validos = colaboradores.filter((c) => c.status === "valido");
    if (!selectedEmpresa || !selectedObra || validos.length === 0) return;

    setLoading(true);
    let loteIdCriado: string | null = null;

    try {
      // 1. Verificar/Criar Lote com status PROVISÓRIO ('aguardando_processamento')
      // Isso evita travar o banco com gatilhos de faturamento antes da hora
      const { data: loteExistente } = await supabase
        .from("lotes_mensais")
        .select("id")
        .eq("empresa_id", selectedEmpresa)
        .eq("obra_id", selectedObra)
        .eq("competencia", competencia)
        .maybeSingle();

      const valorTotal = validos.reduce((acc, c) => acc + 50, 0);

      if (loteExistente) {
        loteIdCriado = loteExistente.id;
        // Reseta lote existente
        await supabase
          .from("lotes_mensais")
          .update({
            status: "aguardando_processamento", // Status seguro
            total_colaboradores: validos.length,
            valor_total: valorTotal,
            updated_at: new Date().toISOString(),
          })
          .eq("id", loteIdCriado);

        await supabase.from("colaboradores_lote").delete().eq("lote_id", loteIdCriado);
      } else {
        const { data: novoLote, error: createError } = await supabase
          .from("lotes_mensais")
          .insert({
            empresa_id: selectedEmpresa,
            obra_id: selectedObra,
            competencia: competencia,
            status: "aguardando_processamento", // Cria como seguro
            total_colaboradores: validos.length,
            total_aprovados: 0,
            total_reprovados: 0,
            valor_total: valorTotal,
          })
          .select()
          .single();

        if (createError) throw createError;
        loteIdCriado = novoLote.id;
      }

      // 2. Processar Upsert na Tabela Mestra (Lotes de 100)
      const BATCH_SIZE = 100;
      for (let i = 0; i < validos.length; i += BATCH_SIZE) {
        const batch = validos.slice(i, i + BATCH_SIZE);

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

        // CORREÇÃO: onConflict agora usa 'empresa_id, cpf' conforme a nova constraint do banco
        const { data: upsertedCols, error: upsertError } = await supabase
          .from("colaboradores")
          .upsert(mestraData, { onConflict: "empresa_id, cpf", ignoreDuplicates: false })
          .select("id, cpf");

        if (upsertError) throw new Error(`Erro ao salvar na base mestra: ${upsertError.message}`);

        const cpfToIdMap = new Map(upsertedCols?.map((c) => [c.cpf, c.id]));

        // Insert Tabela Histórica
        const loteItemsData = batch.map((c) => ({
          lote_id: loteIdCriado,
          colaborador_id: cpfToIdMap.get(c.cpf),
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

      // 3. Tudo salvo? Agora vira CONCLUÍDO
      const { error: finalError } = await supabase
        .from("lotes_mensais")
        .update({
          status: "concluido",
          total_aprovados: validos.length,
          aprovado_em: new Date().toISOString(),
        })
        .eq("id", loteIdCriado);

      if (finalError) throw finalError;

      toast.success("Sucesso! Lote importado e finalizado.");
      queryClient.invalidateQueries({ queryKey: ["lotes-operacional"] });
      onOpenChange(false);
      setStep("selecao");
      setColaboradores([]);
    } catch (error: any) {
      console.error(error);
      toast.error("Erro no processo: " + error.message);
      // Opcional: Se quiser apagar o lote em caso de erro, descomente:
      // if (loteIdCriado) await supabase.from("lotes_mensais").delete().eq("id", loteIdCriado);
    } finally {
      setLoading(false);
    }
  };

  const totalValidos = colaboradores.filter((c) => c.status === "valido").length;
  const totalErros = colaboradores.filter((c) => c.status === "erro").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Lote Pronto (Admin)</DialogTitle>
          <DialogDescription>Importe uma lista já aprovada.</DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4 flex-1 overflow-y-auto pr-2">
          {step === "selecao" && (
            <div className="space-y-4 animate-in fade-in">
              <div className="space-y-2">
                <Label>Empresa Cliente</Label>
                <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openCombobox}
                      className="w-full justify-between"
                    >
                      {selectedEmpresa
                        ? empresas.find((e) => e.id === selectedEmpresa)?.nome
                        : "Selecione a empresa..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[460px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar empresa..." />
                      <CommandList>
                        <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
                        <CommandGroup>
                          {empresas.map((empresa) => (
                            <CommandItem
                              key={empresa.id}
                              value={empresa.nome}
                              onSelect={() => {
                                setSelectedEmpresa(empresa.id);
                                setOpenCombobox(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedEmpresa === empresa.id ? "opacity-100" : "opacity-0",
                                )}
                              />
                              {empresa.nome}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
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
                        )}{" "}
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
              <div className="flex gap-4">
                <Alert className="bg-green-50 border-green-200 flex-1">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-800">Prontos para Importar</AlertTitle>
                  <AlertDescription className="text-green-700">{totalValidos} colaboradores válidos.</AlertDescription>
                </Alert>
                {totalErros > 0 && (
                  <Alert className="bg-red-50 border-red-200 flex-1">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <AlertTitle className="text-red-800">Erros Encontrados</AlertTitle>
                    <AlertDescription className="text-red-700">{totalErros} linhas serão ignoradas.</AlertDescription>
                  </Alert>
                )}
              </div>

              <div className="border rounded-lg max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">Ln</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Salário</TableHead>
                      <TableHead>Mensagem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {colaboradores.slice(0, 200).map((colab, idx) => (
                      <TableRow key={idx} className={colab.status === "erro" ? "bg-red-50/50" : ""}>
                        <TableCell className="text-xs text-muted-foreground">{colab.linha}</TableCell>
                        <TableCell>
                          {colab.status === "valido" ? (
                            <Badge className="bg-green-500 hover:bg-green-600 text-[10px]">Válido</Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px]">
                              Inválido
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-medium text-xs truncate max-w-[150px]" title={colab.nome}>
                          {colab.nome}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {colab.status === "valido" ? formatCPF(colab.cpf) : colab.cpf}
                        </TableCell>
                        <TableCell className="text-xs">
                          {colab.salario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </TableCell>
                        <TableCell className="text-xs text-red-600 font-medium">{colab.erros.join(", ")}</TableCell>
                      </TableRow>
                    ))}
                    {colaboradores.length > 200 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-4 text-xs">
                          ... e mais {colaboradores.length - 200} linhas.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
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
                  disabled={loading || totalValidos === 0}
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
