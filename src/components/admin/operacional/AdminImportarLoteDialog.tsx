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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  Loader2,
  Upload,
  FileSpreadsheet,
  CheckCircle,
  Plus,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Check,
  ChevronsUpDown,
  X,
  Save,
  Pencil,
} from "lucide-react";
import * as XLSX from "xlsx";
import { validateCPF, formatCNPJ } from "@/lib/validators";
import { cn } from "@/lib/utils";
import { EditableColaboradorRow } from "@/components/shared/EditableColaboradorRow";

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
  if (!valor) return 0;

  // Se já é número, retorna diretamente
  if (typeof valor === "number") return valor;

  let str = String(valor).replace(/R\$/g, "").replace(/\s/g, "").trim();

  // Detecta formato brasileiro: 3.500,00 ou 3500,00
  // Se tem vírgula como separador decimal
  if (str.includes(",")) {
    // Remove pontos de milhar e troca vírgula por ponto
    str = str.replace(/\./g, "").replace(",", ".");
  } else if (str.includes(".")) {
    // Formato pode ser 3500.00 (inglês) ou 3.500 (milhar BR sem decimal)
    // Se o ponto divide em grupos de 3, é separador de milhar
    const parts = str.split(".");
    if (parts.length === 2 && parts[1].length === 3) {
      // É separador de milhar brasileiro (ex: 3.500)
      str = str.replace(/\./g, "");
    }
    // Senão mantém como decimal (ex: 3500.00)
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

// Valida se uma data é válida
const isValidDate = (dateStr: string): boolean => {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  // Ano deve estar entre 1900 e 2100
  if (year < 1900 || year > 2100) return false;
  // Mês entre 1 e 12
  if (month < 1 || month > 12) return false;
  // Dia entre 1 e 31
  if (day < 1 || day > 31) return false;

  // Verifica se a data é válida criando um Date e comparando
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

const normalizarData = (valor: any): { date: string; valid: boolean } => {
  if (!valor) return { date: "", valid: false };

  const str = String(valor).trim();

  // Tenta formato DD/MM/YYYY
  const ddmmyyyy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (ddmmyyyy) {
    const day = ddmmyyyy[1].padStart(2, "0");
    const month = ddmmyyyy[2].padStart(2, "0");
    let year = ddmmyyyy[3];
    // Se ano tem 2 dígitos, assume século 19 ou 20
    if (year.length === 2) {
      year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
    } else if (year.length === 3) {
      // Ano inválido com 3 dígitos (ex: 193)
      return { date: str, valid: false };
    }
    const dateStr = `${year}-${month}-${day}`;
    return { date: dateStr, valid: isValidDate(dateStr) };
  }

  // Tenta formato serial Excel
  if (!isNaN(Number(valor))) {
    const excelDate = XLSX.SSF.parse_date_code(Number(valor));
    if (excelDate && excelDate.y >= 1900 && excelDate.y <= 2100) {
      const dateStr = `${excelDate.y}-${String(excelDate.m).padStart(2, "0")}-${String(excelDate.d).padStart(2, "0")}`;
      return { date: dateStr, valid: isValidDate(dateStr) };
    }
  }

  // Tenta formato YYYY-MM-DD
  const yyyymmdd = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (yyyymmdd) {
    return { date: str, valid: isValidDate(str) };
  }

  return { date: str, valid: false };
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

interface EmpresaComCNPJ {
  id: string;
  nome: string;
  cnpj: string;
}

export function AdminImportarLoteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"selecao" | "upload" | "conclusao">("selecao");

  const [empresas, setEmpresas] = useState<EmpresaComCNPJ[]>([]);
  const [obras, setObras] = useState<{ id: string; nome: string }[]>([]);

  const [selectedEmpresa, setSelectedEmpresa] = useState("");
  const [selectedObra, setSelectedObra] = useState("");
  const [competencia, setCompetencia] = useState("");
  const [openCombobox, setOpenCombobox] = useState(false);

  // Estados para criação de obra personalizada
  const [isCreatingObra, setIsCreatingObra] = useState(false);
  const [newObraName, setNewObraName] = useState("");

  const [colaboradores, setColaboradores] = useState<ValidatedRow[]>([]);

  useEffect(() => {
    if (open) {
      supabase
        .from("empresas")
        .select("id, nome, cnpj")
        .eq("status", "ativa")
        .order("nome")
        .then(({ data }) => setEmpresas((data as EmpresaComCNPJ[]) || []));

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

      // Resetar estados ao abrir
      setStep("selecao");
      setIsCreatingObra(false);
      setNewObraName("");
    }
  }, [open]);

  useEffect(() => {
    if (selectedEmpresa) {
      setLoading(true); // Feedback visual rápido
      supabase
        .from("obras")
        .select("id, nome")
        .eq("empresa_id", selectedEmpresa)
        .eq("status", "ativa")
        .order("nome")
        .then(({ data }) => {
          setObras(data || []);
          setSelectedObra(""); // Limpa seleção anterior
          setLoading(false);
        });
    } else {
      setObras([]);
    }
  }, [selectedEmpresa]);

  // Modificado: Agora aceita o nome como parâmetro
  const createObraMutation = useMutation({
    mutationFn: async (nomeDaObra: string) => {
      if (!nomeDaObra.trim()) throw new Error("Nome da obra é obrigatório.");

      const { data, error } = await supabase
        .from("obras")
        .insert({
          nome: nomeDaObra,
          empresa_id: selectedEmpresa,
          status: "ativa",
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") throw new Error("Já existe uma obra com este nome nesta empresa.");
        throw error;
      }
      return data;
    },
    onSuccess: (newObra) => {
      toast.success(`Obra "${newObra.nome}" criada!`);
      setObras((prev) => [...prev, newObra]);
      setSelectedObra(newObra.id);
      setIsCreatingObra(false);
      setNewObraName("");
    },
    onError: (error: any) => {
      toast.error(error.message);
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
        const tempJson = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: null }) as any[][];
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

        const cpfLimpoRaw = cpfRaw.replace(/\D/g, "");
        const cpfLimpo = cpfLimpoRaw.padStart(11, "0");

        if (!nome && cpfLimpo.length === 0 && salario === 0) continue;

        const erros: string[] = [];

        if (!nome) erros.push("Nome ausente");
        if (cpfLimpo.length !== 11) erros.push("CPF inválido (tamanho)");
        else if (!validateCPF(cpfLimpo)) erros.push("CPF inválido");

        if (cpfsVistos.has(cpfLimpo)) erros.push("Duplicado na planilha");
        if (cpfLimpo.length === 11) cpfsVistos.add(cpfLimpo);

        // Validação de data de nascimento
        const dataResult = idxNasc !== -1 ? normalizarData(row[idxNasc]) : { date: "", valid: false };
        if (!dataResult.valid) {
          erros.push(`Data nascimento inválida${dataResult.date ? `: ${dataResult.date}` : ""}`);
        }

        processados.push({
          linha: i + 1,
          nome: nome.toUpperCase(),
          cpf: cpfLimpo,
          sexo: idxSexo !== -1 ? normalizarSexo(row[idxSexo]) : "Masculino",
          data_nascimento: dataResult.valid ? dataResult.date : "2000-01-01", // Data placeholder para inválidos
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

      processados.sort((a, b) => {
        if (a.status === "erro" && b.status === "valido") return -1;
        if (a.status === "valido" && b.status === "erro") return 1;
        return a.linha - b.linha;
      });

      setColaboradores(processados);
      setStep("conclusao");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao ler arquivo.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadLote = () => {
    const validos = colaboradores.filter((c) => c.status === "valido");
    if (validos.length === 0) {
      toast.error("Não há dados válidos para baixar.");
      return;
    }

    const currentEmpresa = empresas.find((e) => e.id === selectedEmpresa);
    const empresaCNPJ = currentEmpresa?.cnpj ? currentEmpresa.cnpj.replace(/\D/g, "") : "00000000000000";

    const dataToExport = validos.map((c) => ({
      "NOME COMPLETO": c.nome,
      SEXO: c.sexo,
      CPF: c.cpf,
      "DATA NASCIMENTO": c.data_nascimento.split("-").reverse().join("/"),
      SALARIO: c.salario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
      "CLASSIFICACAO SALARIAL": c.classificacao_salario,
      "CNPJ DA EMPRESA": formatCNPJ(empresaCNPJ),
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);

    const wch = 37.11;
    worksheet["!cols"] = [{ wch }, { wch }, { wch }, { wch }, { wch }, { wch }, { wch }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Lista Seguradora");

    const empresaNomeLimpo = currentEmpresa?.nome.replace(/[^a-zA-Z0-9]/g, "") || "Lote";
    const fileName = `LOTE_SEGURADORA_${empresaNomeLimpo}_${competencia.replace("/", "-")}.xlsx`;

    XLSX.writeFile(workbook, fileName);

    toast.success("Download iniciado.");
  };

  const handleConfirmarImportacao = async () => {
    const validos = colaboradores.filter((c) => c.status === "valido");
    if (!selectedEmpresa || !selectedObra || validos.length === 0) return;

    setLoading(true);
    let loteIdCriado: string | null = null;

    try {
      const valorTotal = validos.reduce((acc, c) => acc + 50, 0);

      const { data: loteExistente } = await supabase
        .from("lotes_mensais")
        .select("id")
        .eq("empresa_id", selectedEmpresa)
        .eq("obra_id", selectedObra)
        .eq("competencia", competencia)
        .maybeSingle();

      if (loteExistente) {
        loteIdCriado = loteExistente.id;
        
        // Deleta colaboradores_lote antigos primeiro
        await supabase.from("colaboradores_lote").delete().eq("lote_id", loteIdCriado);
        
        // Reseta completamente o lote para o estado inicial (substituição completa)
        await supabase
          .from("lotes_mensais")
          .update({
            status: "aguardando_processamento",
            total_colaboradores: validos.length,
            total_aprovados: 0,
            total_reprovados: 0,
            total_novos: 0,
            total_alterados: 0,
            total_desligados: 0,
            valor_total: valorTotal,
            arquivo_url: null,
            motivo_reprovacao: null,
            observacoes: null,
            enviado_seguradora_em: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", loteIdCriado);
      } else {
        const { data: novoLote, error: createError } = await supabase
          .from("lotes_mensais")
          .insert({
            empresa_id: selectedEmpresa,
            obra_id: selectedObra,
            competencia: competencia,
            status: "aguardando_processamento",
            total_colaboradores: validos.length,
            total_aprovados: 0,
            total_reprovados: 0,
            valor_total: valorTotal,
            enviado_seguradora_em: new Date().toISOString(),
          })
          .select()
          .single();

        if (createError) throw createError;
        loteIdCriado = novoLote.id;
      }

      // Coletar CPFs da nova lista para identificar desligamentos
      const cpfsNaLista = new Set(validos.map((c) => c.cpf));

      // Buscar colaboradores ativos atuais desta empresa/obra
      const { data: colaboradoresAtuais } = await supabase
        .from("colaboradores")
        .select("id, cpf")
        .eq("empresa_id", selectedEmpresa)
        .eq("obra_id", selectedObra)
        .eq("status", "ativo");

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

        const { data: upsertedCols, error: upsertError } = await supabase
          .from("colaboradores")
          .upsert(mestraData, { onConflict: "empresa_id, cpf", ignoreDuplicates: false })
          .select("id, cpf");

        if (upsertError) throw new Error(`Erro ao salvar na base mestra: ${upsertError.message}`);

        const cpfToIdMap = new Map(upsertedCols?.map((c) => [c.cpf, c.id]));

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

      // Marcar colaboradores que NÃO estão na lista como "desligado" (em vez de deletar)
      const idsParaDesligar = (colaboradoresAtuais || [])
        .filter((c) => !cpfsNaLista.has(c.cpf))
        .map((c) => c.id);

      if (idsParaDesligar.length > 0) {
        for (let i = 0; i < idsParaDesligar.length; i += BATCH_SIZE) {
          const chunkIds = idsParaDesligar.slice(i, i + BATCH_SIZE);
          await supabase
            .from("colaboradores")
            .update({ status: "desligado", updated_at: new Date().toISOString() })
            .in("id", chunkIds);
        }
      }

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
      setSelectedEmpresa("");
      setSelectedObra("");
    } catch (error: any) {
      console.error(error);
      toast.error("Erro no processo: " + error.message);
      if (loteIdCriado) await supabase.from("lotes_mensais").delete().eq("id", loteIdCriado);
    } finally {
      setLoading(false);
    }
  };

  const totalValidos = colaboradores.filter((c) => c.status === "valido").length;
  const totalErros = colaboradores.filter((c) => c.status === "erro").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1400px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Lote Pronto (Admin)</DialogTitle>
          <DialogDescription>
            Importe uma lista já aprovada. O lote será criado APENAS ao clicar em "Confirmar e Finalizar".
          </DialogDescription>
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
                      <CommandList className="max-h-[300px]">
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

                  {/* LÓGICA DE CRIAÇÃO OU SELEÇÃO DE OBRA */}
                  {isCreatingObra ? (
                    <div className="flex gap-2 items-end animate-in fade-in slide-in-from-left-2">
                      <div className="flex-1 space-y-1">
                        <Input
                          placeholder="Nome da Nova Obra"
                          value={newObraName}
                          onChange={(e) => setNewObraName(e.target.value)}
                          className="bg-white border-blue-300 focus-visible:ring-blue-500"
                          autoFocus
                        />
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setIsCreatingObra(false)}
                        className="text-muted-foreground hover:text-red-500"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        className="bg-blue-600 hover:bg-blue-700"
                        onClick={() => createObraMutation.mutate(newObraName)}
                        disabled={!newObraName.trim() || createObraMutation.isPending}
                      >
                        {createObraMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      {obras.length > 0 ? (
                        <Select value={selectedObra} onValueChange={setSelectedObra}>
                          <SelectTrigger className="flex-1">
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
                      ) : (
                        <div className="flex-1 border border-dashed border-yellow-300 bg-yellow-50 rounded-md p-2 text-center text-sm text-yellow-800 flex items-center justify-center gap-2">
                          <AlertTriangle className="h-4 w-4" /> Nenhuma obra encontrada.
                        </div>
                      )}

                      <div className="flex gap-1">
                        {obras.length === 0 && (
                          <Button
                            type="button"
                            variant="secondary"
                            className="whitespace-nowrap"
                            onClick={() =>
                              createObraMutation.mutate(
                                empresas.find((e) => e.id === selectedEmpresa)?.nome || "Obra Padrão",
                              )
                            }
                            disabled={createObraMutation.isPending}
                            title="Criar com Nome da Empresa"
                          >
                            {createObraMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Padrão"}
                          </Button>
                        )}

                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            setNewObraName("");
                            setIsCreatingObra(true);
                          }}
                          title="Criar Nova Obra Personalizada"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
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

              {totalErros > 0 && (
                <Alert className="bg-blue-50 border-blue-200">
                  <Pencil className="h-4 w-4 text-blue-600" />
                  <AlertTitle className="text-blue-800">Edição Disponível</AlertTitle>
                  <AlertDescription className="text-blue-700">
                    Clique no ícone de lápis nas linhas inválidas para corrigir os dados diretamente.
                  </AlertDescription>
                </Alert>
              )}

              <div className="border rounded-lg max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">Ln</TableHead>
                      <TableHead className="w-[80px]">Status</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Sexo</TableHead>
                      <TableHead>Nascimento</TableHead>
                      <TableHead>Salário</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {colaboradores.slice(0, 200).map((colab, idx) => (
                      <EditableColaboradorRow
                        key={`${colab.cpf}-${colab.linha}-${idx}`}
                        colaborador={colab}
                        showSalary={true}
                        onSave={(updatedData) => {
                          const newColaboradores = [...colaboradores];
                          const originalIdx = colaboradores.findIndex((c) => c.linha === colab.linha);
                          if (originalIdx !== -1) {
                            newColaboradores[originalIdx] = {
                              ...newColaboradores[originalIdx],
                              ...updatedData,
                              classificacao_salario: calcularClassificacao(updatedData.salario),
                              status: "valido",
                              erros: [],
                            };
                            setColaboradores(newColaboradores);
                          }
                        }}
                        onDelete={(linha) => {
                          setColaboradores(colaboradores.filter((c) => c.linha !== linha));
                        }}
                      />
                    ))}
                    {colaboradores.length > 200 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-4 text-xs">
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
                  className="gap-2"
                >
                  <FileSpreadsheet className="h-4 w-4" /> Trocar Arquivo
                </Button>

                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={handleDownloadLote}
                    disabled={loading || totalValidos === 0}
                    className="gap-2"
                  >
                    <FileSpreadsheet className="h-4 w-4" /> Baixar Lista Seguradora
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
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
