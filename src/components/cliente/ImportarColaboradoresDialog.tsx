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
  let str = String(valor).replace(/R\$/g, "").replace(/\s/g, "").trim();
  if (str.includes(",")) str = str.replace(/\./g, "").replace(",", ".");
  else str = str.replace(/,/g, "");
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

  // --- NOVA FUNÇÃO DE DOWNLOAD (ESTILIZADA) ---
  const baixarModelo = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Colaboradores");

    const headers = ["Nome", "Sexo", "CPF", "Data Nascimento", "Salário"];
    const headerRow = worksheet.addRow(headers);

    // Largura das Colunas (37.11 ~ 31 caracteres visuais)
    const COL_WIDTH = 37.11;
    worksheet.columns = headers.map(() => ({ width: COL_WIDTH }));

    // Estilo do Cabeçalho
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF203455" }, // Azul Escuro #203455 (ARGB: FF + Hex)
      };
      cell.font = {
        color: { argb: "FFFFFFFF" }, // Branco
        bold: true,
        size: 11,
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      // Borda
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
  // ---------------------------------------------

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

      // Busca Aba Correta
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const tempJson = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: null }) as any[][];
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

      // Mapeia Colunas
      const rawHeaders = jsonData[0].map((h: any) => String(h || "").trim());
      const headers = rawHeaders.map(normalizarHeader);

      const idxNome = headers.findIndex((h) => h.includes("nome") || h.includes("funcionario"));
      const idxCPF = headers.findIndex((h) => h.includes("cpf") || h.includes("documento"));
      const idxSalario = headers.findIndex((h) => h.includes("salario") || h.includes("vencimento"));
      const idxNasc = headers.findIndex((h) => h.includes("nascimento") || h.includes("data"));
      const idxSexo = headers.findIndex((h) => h.includes("sexo") || h.includes("genero"));

      // Busca Existentes
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
        const nascimento = idxNasc !== -1 ? normalizarData(row[idxNasc]) : "1900-01-01";

        if (!nome) erros.push("Nome ausente");
        if (cpfLimpo.length !== 11) erros.push("CPF inválido");
        else if (!validateCPF(cpfLimpo)) erros.push("CPF inválido");

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
            status = alteracoes.length > 0 ? "atualizado" : "novo"; // Se não mudou nada, considera "novo" (mantido na lista)
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
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Lista de {competencia}</DialogTitle>
          <DialogDescription>Carregue o arquivo .xlsx. Esta lista será a verdade absoluta do mês.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {/* AVISO IMPORTANTE SOBRE O MODELO */}
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
              {/* Cards de Resumo */}
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

              {/* Aviso de edição para erros */}
              {validatedRows.some((r) => r.status === "erro") && (
                <Alert className="bg-blue-50 border-blue-200">
                  <Pencil className="h-4 w-4 text-blue-600" />
                  <AlertTitle className="text-blue-800">Edição Disponível</AlertTitle>
                  <AlertDescription className="text-blue-700">
                    Clique no ícone de lápis nas linhas inválidas para corrigir os dados diretamente.
                  </AlertDescription>
                </Alert>
              )}

              {/* Tabela Paginada */}
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

              {/* Paginação */}
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
