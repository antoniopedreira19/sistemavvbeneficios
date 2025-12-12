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
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FileSpreadsheet, Upload, Download, AlertCircle, CheckCircle, UserMinus, Info, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { validateCPF } from "@/lib/validators";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { useImportarColaboradores } from "@/hooks/useImportarColaboradores";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { EditableColaboradorRow } from "@/components/shared/EditableColaboradorRow";

const ITEMS_PER_PAGE = 50;

const CLASSIFICACOES_SALARIO = [
  { label: "Ajudante Comum", minimo: 1454.2 },
  { label: "Ajudante Prático/Meio-Oficial", minimo: 1476.2 },
  { label: "Oficial", minimo: 2378.34 },
  { label: "Op. Qualificado I", minimo: 2637.8 },
  { label: "Op. Qualificado II", minimo: 3262.6 },
  { label: "Op. Qualificado III", minimo: 4037.0 },
];

interface ValidatedRow {
  linha: number;
  nome: string;
  sexo: string;
  cpf: string;
  data_nascimento: string;
  salario: number;
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
  if (valorSalario < CLASSIFICACOES_SALARIO[0].minimo) return CLASSIFICACOES_SALARIO[0].label;
  const classificacao = [...CLASSIFICACOES_SALARIO].reverse().find((c) => valorSalario >= c.minimo);
  return classificacao?.label || CLASSIFICACOES_SALARIO[0].label;
};

// --- HELPERS DE NORMALIZAÇÃO (IGUAL AO ADMIN) ---
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

// Lógica robusta de salário (BRL/USD) igual ao Admin
const normalizarSalario = (valor: any): number => {
  if (!valor) return 0;
  if (typeof valor === "number") return valor;

  let str = String(valor).replace(/R\$/g, "").replace(/\s/g, "").trim();

  // Detecta formato brasileiro: 3.500,00 ou 3500,00
  if (str.includes(",")) {
    // Remove pontos de milhar e troca vírgula por ponto
    str = str.replace(/\./g, "").replace(",", ".");
  } else if (str.includes(".")) {
    // Formato pode ser 3500.00 (inglês) ou 3.500 (milhar BR sem decimal)
    const parts = str.split(".");
    if (parts.length === 2 && parts[1].length === 3) {
      str = str.replace(/\./g, ""); // É milhar
    }
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

// Validação de data robusta igual ao Admin
const isValidDate = (dateStr: string): boolean => {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

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
    if (year.length === 2) {
      year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
    } else if (year.length === 3) {
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

    const headers = ["Nome", "Sexo", "CPF", "Data Nascimento", "Salário"];
    const headerRow = worksheet.addRow(headers);

    const COL_WIDTH = 37.11;
    worksheet.columns = headers.map(() => ({ width: COL_WIDTH }));

    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF203455" },
      };
      cell.font = {
        color: { argb: "FFFFFFFF" },
        bold: true,
        size: 11,
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "modelo_colaboradores_padrao.xlsx";
    link.click();
    window.URL.revokeObjectURL(url);
    toast.success("Modelo baixado com sucesso!");
  };

  const validarArquivo = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo: 5 MB");
      return;
    }

    setProcessing(true);
    setValidatedRows([]);
    setCurrentPage(1);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);

      let targetSheetName = "";
      let jsonData: any[][] = [];

      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const tempJson = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: null }) as any[][]; // raw: true para pegar valores crus
        if (tempJson.length > 0) {
          for (let i = 0; i < Math.min(5, tempJson.length); i++) {
            const row = tempJson[i];
            const rawHeaders = row.map((h: any) => String(h || "").trim());
            const headers = rawHeaders.map(normalizarHeader);
            if (headers.some((h) => h.includes("nome")) && headers.some((h) => h.includes("cpf"))) {
              targetSheetName = sheetName;
              jsonData = tempJson.slice(i);
              break;
            }
          }
          if (targetSheetName) break;
        }
      }

      if (!targetSheetName) {
        toast.error("Colunas obrigatórias não encontradas.");
        setProcessing(false);
        return;
      }

      const rawHeaders = jsonData[0].map((h: any) => String(h || "").trim());
      const headers = rawHeaders.map(normalizarHeader);

      const idxNome = headers.findIndex((h) => h.includes("nome") || h.includes("funcionario"));
      const idxCPF = headers.findIndex((h) => h.includes("cpf") || h.includes("documento"));
      const idxSalario = headers.findIndex((h) => h.includes("salario") || h.includes("vencimento"));
      const idxNasc = headers.findIndex((h) => h.includes("nascimento") || h.includes("data") || h.includes("dtnasc"));
      const idxSexo = headers.findIndex((h) => h.includes("sexo") || h.includes("genero"));

      const { data: existentes } = await supabase
        .from("colaboradores")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("obra_id", obraId)
        .eq("status", "ativo");

      const existentesMap = new Map((existentes || []).map((c) => [c.cpf, c]));
      const cpfsNoArquivo = new Set<string>();
      const validated: ValidatedRow[] = [];

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
        const sexo = idxSexo !== -1 ? normalizarSexo(row[idxSexo]) : "Masculino";

        // Nova validação de data
        const dataResult = idxNasc !== -1 ? normalizarData(row[idxNasc]) : { date: "1900-01-01", valid: false };
        const nascimento = dataResult.date;

        if (!nome) erros.push("Nome ausente");
        if (cpfLimpo.length !== 11) erros.push("CPF inválido");
        else if (!validateCPF(cpfLimpo)) erros.push("CPF inválido");

        if (idxNasc !== -1 && !dataResult.valid) {
          erros.push("Data inválida");
        }

        if (cpfsNoArquivo.has(cpfLimpo)) erros.push("Duplicado no arquivo");
        if (cpfLimpo.length === 11) cpfsNoArquivo.add(cpfLimpo);

        let status: "novo" | "atualizado" | "erro" = erros.length > 0 ? "erro" : "novo";
        let alteracoes: string[] = [];
        let dadosAtuais = null;

        if (status !== "erro") {
          const existente = existentesMap.get(cpfLimpo);
          if (existente) {
            dadosAtuais = existente;
            if (existente.nome !== nome.toUpperCase()) alteracoes.push("Nome");
            if (Math.abs(existente.salario - salario) > 0.01) alteracoes.push("Salário");
            status = alteracoes.length > 0 ? "atualizado" : "novo";
          }
        }

        validated.push({
          linha: i + 1,
          nome: nome.toUpperCase(),
          cpf: cpfLimpo,
          sexo,
          data_nascimento: nascimento,
          salario,
          status,
          erros: erros.length > 0 ? erros : undefined,
          alteracoes: alteracoes.length > 0 ? alteracoes : undefined,
          dadosAtuais,
        });
      }

      // Ordenação: Erros no topo
      validated.sort((a, b) => {
        if (a.status === "erro" && b.status !== "erro") return -1;
        if (a.status !== "erro" && b.status === "erro") return 1;
        return a.linha - b.linha;
      });

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
        toast.success(
          `Importação concluída: ${result.novos} novos, ${result.atualizados} atualizados, ${result.desligados} desligados.`,
        );
        setValidatedRows([]);
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
  const totalPaginas = Math.ceil(rowsFiltradas.length / ITEMS_PER_PAGE);
  const paginatedRows = rowsFiltradas.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1400px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Lista de {competencia}</DialogTitle>
          <DialogDescription>Carregue o arquivo .xlsx. Esta lista será a verdade absoluta do mês.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          <Alert className="bg-blue-50 border-blue-200 text-blue-800">
            <Info className="h-4 w-4" />
            <AlertTitle className="font-semibold">Recomendação:</AlertTitle>
            <AlertDescription>
              Para evitar erros na importação, baixe o modelo padrão abaixo e preencha os dados nele antes de fazer o
              upload.
            </AlertDescription>
          </Alert>

          <div className="flex gap-3 flex-wrap">
            <Button onClick={baixarModelo} variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" /> Baixar Modelo Padrão
            </Button>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={processing || importing}
              size="sm"
              className="gap-2"
            >
              <Upload className="h-4 w-4" /> {processing ? "Processando..." : "Selecionar Arquivo"}
            </Button>
            <input ref={fileInputRef} type="file" accept=".xlsx" onChange={handleFileChange} className="hidden" />
          </div>

          {validatedRows.length > 0 && (
            <>
              <div className="grid gap-3 md:grid-cols-5">
                <Alert className="cursor-pointer py-2 border-muted" onClick={() => setFiltroStatus("todos")}>
                  <FileSpreadsheet className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{validatedRows.length}</strong> total
                  </AlertDescription>
                </Alert>
                <Alert className="cursor-pointer py-2 border-green-200" onClick={() => setFiltroStatus("novo")}>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <AlertDescription>
                    <strong>{validatedRows.filter((r) => r.status === "novo").length}</strong> novos
                  </AlertDescription>
                </Alert>
                <Alert className="cursor-pointer py-2 border-red-200" onClick={() => setFiltroStatus("erro")}>
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <AlertDescription>
                    <strong>{validatedRows.filter((r) => r.status === "erro").length}</strong> erros
                  </AlertDescription>
                </Alert>
                {desligamentosPrevistos > 0 && (
                  <Alert className="py-2 border-orange-200 bg-orange-50">
                    <UserMinus className="h-4 w-4 text-orange-500" />
                    <AlertDescription>
                      <strong>{desligamentosPrevistos}</strong> desligamentos
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {validatedRows.some((r) => r.status === "erro") && (
                <Alert className="bg-blue-50 border-blue-200">
                  <Pencil className="h-4 w-4 text-blue-600" />
                  <AlertTitle className="text-blue-800">Edição Disponível</AlertTitle>
                  <AlertDescription className="text-blue-700">
                    Clique no ícone de lápis nas linhas inválidas para corrigir os dados diretamente.
                  </AlertDescription>
                </Alert>
              )}

              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
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
                    {paginatedRows.map((row, idx) => (
                      <EditableColaboradorRow
                        key={`${row.cpf}-${row.linha}-${idx}`}
                        colaborador={row}
                        showSalary={true}
                        onSave={(updatedData) => {
                          const newRows = [...validatedRows];
                          const originalIdx = validatedRows.findIndex((r) => r.linha === row.linha);
                          if (originalIdx !== -1) {
                            newRows[originalIdx] = {
                              ...newRows[originalIdx],
                              ...updatedData,
                              status: "novo",
                              erros: undefined,
                            };
                            setValidatedRows(newRows);
                          }
                        }}
                        onDelete={(linha) => {
                          setValidatedRows(validatedRows.filter((r) => r.linha !== linha));
                        }}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPaginas > 1 && (
                <Pagination className="justify-end">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className={currentPage === 1 ? "opacity-50" : ""}
                      />
                    </PaginationItem>
                    <span className="text-sm mx-4">
                      Página {currentPage} de {totalPaginas}
                    </span>
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setCurrentPage((p) => Math.min(totalPaginas, p + 1))}
                        className={currentPage === totalPaginas ? "opacity-50" : ""}
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
