import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileSpreadsheet, Upload, Download, AlertCircle, CheckCircle, FileWarning, UserMinus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { validateCPF, formatCPF } from "@/lib/validators";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { useImportarColaboradores } from "@/hooks/useImportarColaboradores";
import { findHeaderRowIndex, mapColumnIndexes, validateRequiredColumns } from "@/lib/excelImportUtils";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const ITEMS_PER_PAGE = 50;

const CLASSIFICACOES_SALARIO = [
  { label: "Ajudante Comum", minimo: 1454.2 },
  { label: "Ajudante Prático/Meio-Oficial", minimo: 1476.2 },
  { label: "Oficial", minimo: 2378.34 },
  { label: "Op. Qualificado I", minimo: 2637.8 },
  { label: "Op. Qualificado II", minimo: 3262.6 },
  { label: "Op. Qualificado III", minimo: 4037.0 },
];

interface ColaboradorRow {
  nome: string;
  sexo: string;
  cpf: string;
  data_nascimento: string;
  salario: number;
}

interface ValidatedRow extends ColaboradorRow {
  linha: number;
  status: "novo" | "atualizado" | "erro";
  erros?: string[];
  dadosAtuais?: any;
  alteracoes?: string[];
}

interface ImportarColaboradoresDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaId: string;
  obraId: string;
  competencia: string;
  onSuccess: () => void;
}

const calcularClassificacaoSalario = (valorSalario: number): string => {
  if (valorSalario < CLASSIFICACOES_SALARIO[0].minimo) {
    return CLASSIFICACOES_SALARIO[0].label;
  }

  const classificacao = [...CLASSIFICACOES_SALARIO].reverse().find((c) => valorSalario >= c.minimo);

  return classificacao?.label || CLASSIFICACOES_SALARIO[0].label;
};

const normalizarSexo = (valor: any): string | null => {
  if (!valor) return null;
  const str = String(valor).trim().toLowerCase();
  if (["masculino", "masc", "m"].includes(str)) return "Masculino";
  if (["feminino", "fem", "f", "femi"].includes(str)) return "Feminino";
  if (["outro", "o"].includes(str)) return "Outro";
  return null;
};

const normalizarSalario = (valor: any): number | null => {
  if (!valor) return null;
  
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
  return isNaN(num) ? null : num;
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

const normalizarData = (valor: any): string | null => {
  if (!valor) return null;
  
  const str = String(valor).trim();
  
  // Tenta formato DD/MM/YYYY (aceita 1 ou 2 dígitos para dia/mês)
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
      return null;
    }
    const dateStr = `${year}-${month}-${day}`;
    return isValidDate(dateStr) ? dateStr : null;
  }
  
  // Tenta formato YYYY-MM-DD
  const yyyymmddMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (yyyymmddMatch) {
    return isValidDate(str) ? str : null;
  }
  
  // Tenta formato serial Excel
  if (!isNaN(Number(valor))) {
    const excelDate = XLSX.SSF.parse_date_code(Number(valor));
    if (excelDate && excelDate.y >= 1900 && excelDate.y <= 2100) {
      const dateStr = `${excelDate.y}-${String(excelDate.m).padStart(2, "0")}-${String(excelDate.d).padStart(2, "0")}`;
      return isValidDate(dateStr) ? dateStr : null;
    }
  }
  
  return null;
};

export function ImportarColaboradoresDialog({
  open,
  onOpenChange,
  empresaId,
  obraId,
  competencia,
  onSuccess,
}: ImportarColaboradoresDialogProps) {
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([]);
  const [processing, setProcessing] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "novo" | "atualizado" | "erro">("todos");
  const [desligamentosPrevistos, setDesligamentosPrevistos] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { importing, atualizarColaboradores } = useImportarColaboradores();

  const baixarModelo = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Colaboradores");
    worksheet.addRow(["Nome", "Sexo", "CPF", "Data Nascimento", "Salário"]);
    worksheet.columns = [{ width: 35 }, { width: 15 }, { width: 18 }, { width: 20 }, { width: 15 }];
    worksheet.getRow(1).eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC0504D" } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "modelo_colaboradores.xlsx";
    link.click();
    window.URL.revokeObjectURL(url);
    toast.success("Modelo baixado com sucesso");
  };

  const validarArquivo = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo: 5 MB");
      return;
    }

    setProcessing(true);
    setValidatedRows([]); // Limpa anterior
    setCurrentPage(1); // Reseta paginação

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (jsonData.length < 2) {
        toast.error("Arquivo vazio ou sem dados");
        return;
      }

      // 1. Encontrar a linha de cabeçalho (pula linhas em branco no topo)
      const headerRowIndex = findHeaderRowIndex(jsonData);
      const rawHeaders = jsonData[headerRowIndex].map((h: any) => String(h || "").trim());

      // 2. Mapear Índices das Colunas usando utilitário
      const { idxNome, idxCPF, idxSalario, idxNasc, idxSexo } = mapColumnIndexes(rawHeaders);

      // 3. Validar colunas obrigatórias
      const missingCols = validateRequiredColumns({ idxNome, idxCPF, idxSalario, idxNasc, idxSexo });
      if (missingCols.length > 0) {
        toast.error(`Colunas obrigatórias não encontradas: ${missingCols.join(", ")}.`);
        setProcessing(false);
        return;
      }

      const { data: existentes } = await supabase
        .from("colaboradores")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("obra_id", obraId)
        .eq("status", "ativo");

      const existentesMap = new Map((existentes || []).map((c) => [c.cpf, c]));
      const cpfsNoArquivo = new Set<string>();
      const validated: ValidatedRow[] = [];

      // 4. Processamento das linhas (começa após o cabeçalho)
      for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        // Pula linhas vazias
        if (!row || row.length === 0 || row.every((cell: any) => !cell || String(cell).trim() === "")) continue;

        const rowData = {
          nome: row[idxNome],
          sexo: row[idxSexo],
          cpf: row[idxCPF],
          data_nascimento: row[idxNasc],
          salario: row[idxSalario],
        };

        const erros: string[] = [];
        const linha = i + 1;

        // Validações
        const nome = rowData.nome?.toString().trim();
        if (!nome) erros.push("Nome obrigatório");
        const sexoNormalizado = normalizarSexo(rowData.sexo);
        if (!sexoNormalizado) erros.push("Sexo inválido");
        const cpfRaw = rowData.cpf?.toString().replace(/\D/g, "");
        if (!cpfRaw || cpfRaw.length !== 11) erros.push("CPF deve ter 11 dígitos");
        else if (!validateCPF(cpfRaw)) erros.push("CPF inválido");
        else if (cpfsNoArquivo.has(cpfRaw)) erros.push("CPF duplicado");
        else cpfsNoArquivo.add(cpfRaw);
        const dataNascimento = normalizarData(rowData.data_nascimento);
        if (!dataNascimento) erros.push("Data inválida");
        const salario = normalizarSalario(rowData.salario);
        if (salario === null || salario < 0) erros.push("Salário inválido");

        let status: "novo" | "atualizado" | "erro" = "erro";
        let dadosAtuais: any = null;
        let alteracoes: string[] = [];

        if (erros.length === 0 && cpfRaw && sexoNormalizado) {
          const existente = existentesMap.get(cpfRaw);
          if (existente) {
            dadosAtuais = existente;
            if (existente.nome !== nome) alteracoes.push(`Nome`);
            if (existente.sexo !== sexoNormalizado) alteracoes.push(`Sexo`);
            if (existente.data_nascimento !== dataNascimento) alteracoes.push(`Data Nasc.`);
            if (Math.abs(existente.salario - salario!) > 0.01) alteracoes.push(`Salário`);
            status = alteracoes.length > 0 ? "atualizado" : "novo";
          } else {
            status = "novo";
          }
        }

        validated.push({
          linha,
          nome: nome || "",
          sexo: sexoNormalizado || "",
          cpf: cpfRaw || "",
          data_nascimento: dataNascimento || "",
          salario: salario || 0,
          status,
          erros: erros.length > 0 ? erros : undefined,
          dadosAtuais,
          alteracoes,
        });
      }

      setValidatedRows(validated);
      const cpfsValidados = new Set(validated.filter((v) => v.status !== "erro").map((v) => v.cpf));
      const desligamentos = (existentes || []).filter((e) => !cpfsValidados.has(e.cpf)).length;
      setDesligamentosPrevistos(desligamentos);
    } catch (error) {
      console.error("Erro ao processar:", error);
      toast.error("Erro ao processar arquivo");
    } finally {
      setProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validarArquivo(file);
  };

  const confirmarImportacao = async () => {
    try {
      const colaboradoresValidos = validatedRows.filter((r) => r.status !== "erro");
      if (colaboradoresValidos.length === 0) {
        toast.error("Nenhum colaborador válido");
        return;
      }

      const result = await atualizarColaboradores(
        colaboradoresValidos.map((r) => ({
          nome: r.nome,
          sexo: r.sexo,
          cpf: r.cpf,
          data_nascimento: r.data_nascimento,
          salario: r.salario,
          classificacao_salario: calcularClassificacaoSalario(r.salario),
        })),
        empresaId,
        obraId,
      );

      if (result) {
        const erros = validatedRows.filter((r) => r.status === "erro").length;
        toast.success(
          `Importação concluída: ${result.novos} novos, ${result.atualizados} atualizados, ${result.desligados} desligados.`,
        );
        setValidatedRows([]);
        setDesligamentosPrevistos(0);
        if (fileInputRef.current) fileInputRef.current.value = "";
        onSuccess();
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Erro:", error);
      toast.error("Erro ao importar");
    }
  };

  const rowsFiltradas =
    filtroStatus === "todos" ? validatedRows : validatedRows.filter((r) => r.status === filtroStatus);
  const totalPages = Math.ceil(rowsFiltradas.length / ITEMS_PER_PAGE);
  const paginatedRows = rowsFiltradas.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Lista de {competencia}</DialogTitle>
          <DialogDescription>Carregue o arquivo .xlsx. Esta lista será a verdade absoluta do mês.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          <div className="flex gap-3 flex-wrap">
            <Button onClick={baixarModelo} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" /> Baixar Modelo
            </Button>
            <Button onClick={() => fileInputRef.current?.click()} disabled={processing || importing} size="sm">
              <Upload className="h-4 w-4 mr-2" /> {processing ? "Processando..." : "Selecionar Arquivo"}
            </Button>
            <input ref={fileInputRef} type="file" accept=".xlsx" onChange={handleFileChange} className="hidden" />
          </div>

          {validatedRows.length > 0 && (
            <>
              {/* Cards de Resumo */}
              <div className="grid gap-3 md:grid-cols-5">
                <Alert
                  className={`cursor-pointer py-2 ${filtroStatus === "todos" ? "border-foreground ring-1 ring-foreground" : "border-muted"}`}
                  onClick={() => {
                    setFiltroStatus("todos");
                    setCurrentPage(1);
                  }}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{validatedRows.length}</strong> total
                  </AlertDescription>
                </Alert>
                <Alert
                  className={`cursor-pointer py-2 ${filtroStatus === "novo" ? "border-green-500 ring-1 ring-green-500" : "border-green-200"}`}
                  onClick={() => {
                    setFiltroStatus("novo");
                    setCurrentPage(1);
                  }}
                >
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <AlertDescription>
                    <strong>{validatedRows.filter((r) => r.status === "novo").length}</strong> novos
                  </AlertDescription>
                </Alert>
                <Alert
                  className={`cursor-pointer py-2 ${filtroStatus === "atualizado" ? "border-blue-500 ring-1 ring-blue-500" : "border-blue-200"}`}
                  onClick={() => {
                    setFiltroStatus("atualizado");
                    setCurrentPage(1);
                  }}
                >
                  <FileSpreadsheet className="h-4 w-4 text-blue-500" />
                  <AlertDescription>
                    <strong>{validatedRows.filter((r) => r.status === "atualizado").length}</strong> atualiz.
                  </AlertDescription>
                </Alert>
                <Alert
                  className={`cursor-pointer py-2 ${filtroStatus === "erro" ? "border-red-500 ring-1 ring-red-500" : "border-red-200"}`}
                  onClick={() => {
                    setFiltroStatus("erro");
                    setCurrentPage(1);
                  }}
                >
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <AlertDescription>
                    <strong>{validatedRows.filter((r) => r.status === "erro").length}</strong> erros
                  </AlertDescription>
                </Alert>
                {desligamentosPrevistos > 0 && (
                  <Alert className="py-2 border-orange-200 bg-orange-50">
                    <UserMinus className="h-4 w-4 text-orange-500" />
                    <AlertDescription>
                      <strong>{desligamentosPrevistos}</strong> deslig.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Tabela Paginada */}
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[50px]">Ln</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Detalhes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRows.map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{row.linha}</TableCell>
                        <TableCell>
                          {row.status === "novo" && <Badge className="bg-green-500">Novo</Badge>}
                          {row.status === "atualizado" && <Badge variant="secondary">Atualizado</Badge>}
                          {row.status === "erro" && <Badge variant="destructive">Erro</Badge>}
                        </TableCell>
                        <TableCell className="font-medium">{row.nome}</TableCell>
                        <TableCell>{formatCPF(row.cpf)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.status === "erro" &&
                            row.erros?.map((e, i) => (
                              <div key={i} className="text-red-500">
                                • {e}
                              </div>
                            ))}
                          {row.status === "atualizado" && row.alteracoes?.map((a, i) => <div key={i}>• {a}</div>)}
                          {row.status === "novo" && <span>R$ {row.salario.toFixed(2)}</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Paginação */}
              {totalPages > 1 && (
                <Pagination className="justify-end">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    <span className="text-sm mx-4">
                      Página {currentPage} de {totalPages}
                    </span>
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </>
          )}
        </div>

        <DialogFooter className="mt-4 pt-4 border-t">
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Cancelar
          </Button>
          <Button onClick={confirmarImportacao} disabled={validatedRows.length === 0 || importing}>
            {importing ? "Importando..." : "Confirmar Importação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
