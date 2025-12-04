import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileSpreadsheet, Upload, Download, AlertCircle, CheckCircle, FileWarning, RefreshCw, UserMinus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { validateCPF, formatCPF } from "@/lib/validators";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { useImportarColaboradores } from "@/hooks/useImportarColaboradores";

const CLASSIFICACOES_SALARIO = [
  { label: "Ajudante Comum", minimo: 1454.20 },
  { label: "Ajudante Prático/Meio-Oficial", minimo: 1476.20 },
  { label: "Oficial", minimo: 2378.34 },
  { label: "Op. Qualificado I", minimo: 2637.80 },
  { label: "Op. Qualificado II", minimo: 3262.60 },
  { label: "Op. Qualificado III", minimo: 4037.00 },
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
  loteId: string;
  competencia: string;
  onSuccess: () => void;
}

const calcularClassificacaoSalario = (valorSalario: number): string => {
  if (valorSalario < CLASSIFICACOES_SALARIO[0].minimo) {
    return CLASSIFICACOES_SALARIO[0].label;
  }
  
  const classificacao = [...CLASSIFICACOES_SALARIO]
    .reverse()
    .find(c => valorSalario >= c.minimo);
  
  return classificacao?.label || CLASSIFICACOES_SALARIO[0].label;
};

const normalizarSexo = (valor: any): string | null => {
  if (!valor) return null;
  
  const str = String(valor).trim().toLowerCase();
  
  if (["masculino", "masc", "m"].includes(str)) return "Masculino";
  if (["feminino", "fem", "f"].includes(str)) return "Feminino";
  if (["outro", "o"].includes(str)) return "Outro";
  
  return null;
};

const normalizarSalario = (valor: any): number | null => {
  if (typeof valor === "number") return valor;
  if (!valor) return null;
  
  const str = String(valor)
    .replace(/R\$/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
};

const normalizarData = (valor: any): string | null => {
  if (!valor) return null;
  
  const str = String(valor).trim();
  
  // Formato DD/MM/AAAA
  const ddmmyyyyMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddmmyyyyMatch) {
    const [, dia, mes, ano] = ddmmyyyyMatch;
    return `${ano}-${mes}-${dia}`;
  }
  
  // Formato AAAA-MM-DD
  const yyyymmddMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (yyyymmddMatch) {
    return str;
  }
  
  // Data do Excel (número serial)
  if (!isNaN(Number(valor))) {
    const excelDate = XLSX.SSF.parse_date_code(Number(valor));
    if (excelDate) {
      const ano = excelDate.y;
      const mes = String(excelDate.m).padStart(2, "0");
      const dia = String(excelDate.d).padStart(2, "0");
      return `${ano}-${mes}-${dia}`;
    }
  }
  
  return null;
};

export function ImportarColaboradoresDialog({ 
  open, 
  onOpenChange, 
  empresaId, 
  obraId, 
  loteId,
  competencia,
  onSuccess 
}: ImportarColaboradoresDialogProps) {
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([]);
  const [processing, setProcessing] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "novo" | "atualizado" | "erro">("todos");
  const [desligamentosPrevistos, setDesligamentosPrevistos] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { importing, saveImportedColaboradores, repetirMesAnterior } = useImportarColaboradores();

  const baixarModelo = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Colaboradores");
    
    // Adicionar cabeçalho
    worksheet.addRow(["Nome", "Sexo", "CPF", "Data Nascimento", "Salário"]);
    
    // Definir larguras das colunas
    worksheet.columns = [
      { width: 35 },  // Nome
      { width: 15 },  // Sexo
      { width: 18 },  // CPF
      { width: 20 },  // Data Nascimento
      { width: 15 },  // Salário
    ];
    
    // Aplicar estilo ao cabeçalho (primeira linha)
    worksheet.getRow(1).eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFC0504D' }
      };
      cell.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' }
      };
      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle'
      };
    });
    
    // Gerar e baixar arquivo
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'modelo_colaboradores.xlsx';
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

      const headers = jsonData[0].map((h: any) => String(h).trim());
      const requiredHeaders = ["Nome", "Sexo", "CPF", "Data Nascimento", "Salário"];
      
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
      if (missingHeaders.length > 0) {
        toast.error(`Colunas obrigatórias faltando: ${missingHeaders.join(", ")}`);
        return;
      }

      // Buscar colaboradores existentes da empresa
      const { data: existentes } = await supabase
        .from("colaboradores")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("obra_id", obraId)
        .eq("status", "ativo");

      const existentesMap = new Map(
        (existentes || []).map(c => [c.cpf, c])
      );

      const cpfsNoArquivo = new Set<string>();
      const validated: ValidatedRow[] = [];

      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        const rowData: any = {};
        headers.forEach((header, idx) => {
          rowData[header] = row[idx];
        });

        const erros: string[] = [];
        const linha = i + 1;

        // Validar Nome
        const nome = rowData["Nome"]?.toString().trim();
        if (!nome) erros.push("Nome obrigatório");

        // Validar e Normalizar Sexo
        const sexoNormalizado = normalizarSexo(rowData["Sexo"]);
        if (!sexoNormalizado) {
          erros.push("Sexo inválido (use: Masculino/M/Masc, Feminino/F/Fem ou Outro/O)");
        }

        // Validar e Normalizar CPF
        const cpfRaw = rowData["CPF"]?.toString().replace(/\D/g, "");
        if (!cpfRaw || cpfRaw.length !== 11) {
          erros.push("CPF deve ter 11 dígitos");
        } else if (!validateCPF(cpfRaw)) {
          erros.push("CPF inválido");
        } else if (cpfsNoArquivo.has(cpfRaw)) {
          erros.push("CPF duplicado no arquivo");
        } else {
          cpfsNoArquivo.add(cpfRaw);
        }

        // Validar Data
        const dataNascimento = normalizarData(rowData["Data Nascimento"]);
        if (!dataNascimento) {
          erros.push("Data de nascimento inválida (use DD/MM/AAAA ou AAAA-MM-DD)");
        }

        // Validar Salário
        const salario = normalizarSalario(rowData["Salário"]);
        if (salario === null || salario < 0) {
          erros.push("Salário deve ser um número ≥ 0");
        }

        // Determinar status
        let status: "novo" | "atualizado" | "erro" = "erro";
        let dadosAtuais: any = null;
        let alteracoes: string[] = [];

        if (erros.length === 0 && cpfRaw && sexoNormalizado) {
          const existente = existentesMap.get(cpfRaw);
          if (existente) {
            dadosAtuais = existente;
            
            // Detectar alterações
            if (existente.nome !== nome) alteracoes.push(`Nome: "${existente.nome}" → "${nome}"`);
            if (existente.sexo !== sexoNormalizado) alteracoes.push(`Sexo: "${existente.sexo}" → "${sexoNormalizado}"`);
            if (existente.data_nascimento !== dataNascimento) {
              alteracoes.push(`Data Nasc.: "${existente.data_nascimento}" → "${dataNascimento}"`);
            }
            if (Math.abs(existente.salario - salario!) > 0.01) {
              alteracoes.push(`Salário: R$ ${existente.salario.toFixed(2)} → R$ ${salario!.toFixed(2)}`);
            }

            // Se houver alterações, marcar como atualizado; se não, marcar como novo
            // (porque a importação substitui todos os colaboradores)
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
      
      // Calcular desligamentos previstos (quem está ativo mas NÃO está na lista)
      const cpfsValidados = new Set(validated.filter(v => v.status !== "erro").map(v => v.cpf));
      const desligamentos = (existentes || []).filter(e => !cpfsValidados.has(e.cpf)).length;
      setDesligamentosPrevistos(desligamentos);
    } catch (error) {
      console.error("Erro ao processar arquivo:", error);
      toast.error("Erro ao processar arquivo");
    } finally {
      setProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validarArquivo(file);
    }
  };

  const confirmarImportacao = async () => {
    try {
      const colaboradoresValidos = validatedRows.filter(r => r.status !== "erro");
      
      if (colaboradoresValidos.length === 0) {
        toast.error("Nenhum colaborador válido para importar");
        return;
      }

      const result = await saveImportedColaboradores(
        colaboradoresValidos.map(r => ({
          nome: r.nome,
          sexo: r.sexo,
          cpf: r.cpf,
          data_nascimento: r.data_nascimento,
          salario: r.salario,
          classificacao_salario: calcularClassificacaoSalario(r.salario),
        })),
        empresaId,
        obraId,
        loteId
      );

      if (result) {
        const erros = validatedRows.filter(r => r.status === "erro").length;
        toast.success(
          `Importação concluída: ${result.novos} novos, ${result.atualizados} atualizados, ${result.desligados} desligados${erros > 0 ? `, ${erros} erros ignorados` : ""}`
        );
        
        setValidatedRows([]);
        setDesligamentosPrevistos(0);
        if (fileInputRef.current) fileInputRef.current.value = "";
        onSuccess();
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Erro ao importar:", error);
      toast.error("Erro ao importar colaboradores");
    }
  };

  const handleRepetirMesAnterior = async () => {
    try {
      const result = await repetirMesAnterior(empresaId, obraId, loteId);
      
      if (result) {
        toast.success(`Lista repetida com sucesso: ${result.snapshotCriados} colaboradores copiados do mês anterior`);
        onSuccess();
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Erro ao repetir mês anterior:", error);
      toast.error("Erro ao repetir mês anterior");
    }
  };

  const baixarErros = () => {
    const erros = validatedRows.filter(r => r.status === "erro");
    const ws = XLSX.utils.json_to_sheet(
      erros.map(r => ({
        Linha: r.linha,
        Nome: r.nome,
        CPF: r.cpf,
        Erros: r.erros?.join("; ") || "",
      }))
    );
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Erros");
    XLSX.writeFile(wb, "erros_importacao.xlsx");
  };

  const novos = validatedRows.filter(r => r.status === "novo");
  const atualizados = validatedRows.filter(r => r.status === "atualizado");
  const erros = validatedRows.filter(r => r.status === "erro");
  
  const rowsFiltradas = filtroStatus === "todos" 
    ? validatedRows 
    : validatedRows.filter(r => r.status === filtroStatus);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Lista de {competencia}</DialogTitle>
          <DialogDescription>
            Faça o upload de um arquivo .xlsx com a lista completa de colaboradores. 
            Esta lista é a <strong>verdade absoluta</strong> para este mês: colaboradores ausentes serão marcados como desligados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <Button onClick={baixarModelo} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Baixar Modelo (.xlsx)
            </Button>
            
            <Button onClick={() => fileInputRef.current?.click()} disabled={processing || importing}>
              <Upload className="h-4 w-4 mr-2" />
              {processing ? "Processando..." : "Selecionar Arquivo"}
            </Button>
            
            <Button 
              onClick={handleRepetirMesAnterior} 
              variant="secondary"
              disabled={importing || validatedRows.length > 0}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {importing ? "Processando..." : "Repetir Mês Anterior"}
            </Button>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {validatedRows.length > 0 && (
            <>
              <div className="grid gap-3 md:grid-cols-5">
                <Alert 
                  className={`cursor-pointer transition-all ${filtroStatus === "todos" ? "border-foreground ring-2 ring-foreground" : "border-muted hover:border-foreground"}`}
                  onClick={() => setFiltroStatus("todos")}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{validatedRows.length}</strong> total
                  </AlertDescription>
                </Alert>
                
                <Alert 
                  className={`cursor-pointer transition-all ${filtroStatus === "novo" ? "border-success ring-2 ring-success" : "border-success/50 hover:border-success"}`}
                  onClick={() => setFiltroStatus("novo")}
                >
                  <CheckCircle className="h-4 w-4 text-success" />
                  <AlertDescription>
                    <strong>{novos.length}</strong> novos
                  </AlertDescription>
                </Alert>
                
                <Alert 
                  className={`cursor-pointer transition-all ${filtroStatus === "atualizado" ? "border-primary ring-2 ring-primary" : "border-primary/50 hover:border-primary"}`}
                  onClick={() => setFiltroStatus("atualizado")}
                >
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                  <AlertDescription>
                    <strong>{atualizados.length}</strong> atualizações
                  </AlertDescription>
                </Alert>
                
                <Alert 
                  className={`cursor-pointer transition-all ${filtroStatus === "erro" ? "border-destructive ring-2 ring-destructive" : "border-destructive/50 hover:border-destructive"}`}
                  onClick={() => setFiltroStatus("erro")}
                >
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <AlertDescription>
                    <strong>{erros.length}</strong> erros
                  </AlertDescription>
                </Alert>

                {desligamentosPrevistos > 0 && (
                  <Alert className="border-orange-500/50 bg-orange-500/5">
                    <UserMinus className="h-4 w-4 text-orange-600" />
                    <AlertDescription>
                      <strong>{desligamentosPrevistos}</strong> desligamentos
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {desligamentosPrevistos > 0 && (
                <Alert className="border-orange-500/30 bg-orange-500/5">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="text-orange-700">
                    <strong>{desligamentosPrevistos} colaborador(es)</strong> ativo(s) não estão na lista e serão marcados como <strong>desligados</strong> ao confirmar a importação.
                  </AlertDescription>
                </Alert>
              )}

              <div className="rounded-lg border max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Linha</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Detalhes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rowsFiltradas.map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{row.linha}</TableCell>
                        <TableCell>
                          {row.status === "novo" && (
                            <Badge variant="default" className="bg-success">Novo</Badge>
                          )}
                          {row.status === "atualizado" && (
                            <Badge variant="secondary">Atualizado</Badge>
                          )}
                          {row.status === "erro" && (
                            <Badge variant="destructive">Erro</Badge>
                          )}
                        </TableCell>
                        <TableCell>{row.nome}</TableCell>
                        <TableCell>{formatCPF(row.cpf)}</TableCell>
                        <TableCell className="text-sm">
                          {row.status === "erro" && row.erros && (
                            <ul className="text-destructive space-y-1">
                              {row.erros.map((erro, i) => (
                                <li key={i}>• {erro}</li>
                              ))}
                            </ul>
                          )}
                          {row.status === "atualizado" && row.alteracoes && (
                            <ul className="text-muted-foreground space-y-1">
                              {row.alteracoes.map((alt, i) => (
                                <li key={i}>• {alt}</li>
                              ))}
                            </ul>
                          )}
                          {row.status === "novo" && (
                            <span className="text-muted-foreground">
                              Salário: R$ {row.salario.toFixed(2)} → {calcularClassificacaoSalario(row.salario)}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          {erros.length > 0 && (
            <Button onClick={baixarErros} variant="outline">
              <FileWarning className="h-4 w-4 mr-2" />
              Baixar Erros
            </Button>
          )}
          
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Cancelar
          </Button>
          
          <Button
            onClick={confirmarImportacao}
            disabled={validatedRows.length === 0 || (novos.length === 0 && atualizados.length === 0) || importing}
          >
            {importing ? "Importando..." : `Confirmar Importação (${novos.length + atualizados.length} ativos${desligamentosPrevistos > 0 ? `, ${desligamentosPrevistos} deslig.` : ""})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
