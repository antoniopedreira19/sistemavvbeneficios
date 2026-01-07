import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  History,
  Search,
  Download,
  CheckCircle2,
  XCircle,
  ArrowUpDown,
} from "lucide-react";
import ExcelJS from "exceljs";
import { formatCNPJ, formatCPF } from "@/lib/validators";

interface LoteFaturado {
  id: string;
  competencia: string;
  total_colaboradores: number;
  total_reprovados: number;
  total_aprovados: number;
  valor_total: number;
  created_at: string;
  empresa_id: string;
  empresa: { nome: string; cnpj: string } | null;
  obra: { id: string; nome: string } | null;
}

const ITEMS_PER_PAGE = 10;

// Gerar competências para o filtro (últimos 12 meses + próximos 6)
const gerarCompetencias = (): string[] => {
  const competencias: string[] = [];
  const hoje = new Date();
  
  for (let i = -12; i <= 6; i++) {
    const data = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
    const mes = data.toLocaleString("pt-BR", { month: "long" });
    const mesCapitalizado = mes.charAt(0).toUpperCase() + mes.slice(1);
    const ano = data.getFullYear().toString().slice(-2);
    competencias.push(`${mesCapitalizado}/${ano}`);
  }
  
  return competencias;
};

export default function HistoricoAdmin() {
  const [searchTerm, setSearchTerm] = useState("");
  const [competenciaFilter, setCompetenciaFilter] = useState<string>("todas");
  const [sortBy, setSortBy] = useState<"alfabetica" | "recente">("recente");
  const [currentPage, setCurrentPage] = useState(1);

  const competencias = gerarCompetencias();

  const { data: lotes = [], isLoading } = useQuery({
    queryKey: ["lotes-faturados"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lotes_mensais")
        .select(`
          id, competencia, total_colaboradores, total_reprovados, total_aprovados, 
          valor_total, created_at, empresa_id,
          empresa:empresas(nome, cnpj),
          obra:obras(id, nome)
        `)
        .eq("status", "faturado")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as unknown as LoteFaturado[];
    },
  });

  // Buscar notas fiscais para verificar se foram emitidas
  const { data: notasFiscais = [] } = useQuery({
    queryKey: ["notas-fiscais-historico"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notas_fiscais")
        .select("lote_id, nf_emitida");

      if (error) throw error;
      return data;
    },
  });

  const notasMap = new Map(notasFiscais.map((nf) => [nf.lote_id, nf.nf_emitida]));

  // Filtrar e ordenar
  const filteredLotes = lotes
    .filter((l) => {
      const matchSearch = l.empresa?.nome?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCompetencia = competenciaFilter === "todas" || l.competencia === competenciaFilter;
      return matchSearch && matchCompetencia;
    })
    .sort((a, b) => {
      if (sortBy === "alfabetica") {
        return (a.empresa?.nome || "").localeCompare(b.empresa?.nome || "");
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  // Paginação
  const totalPages = Math.ceil(filteredLotes.length / ITEMS_PER_PAGE);
  const paginatedLotes = filteredLotes.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Download Excel
  const handleDownload = async (lote: LoteFaturado) => {
    try {
      toast.info("Preparando download...");

      const { data: itens, error } = await supabase
        .from("colaboradores_lote")
        .select("nome, sexo, cpf, data_nascimento, salario, classificacao_salario, created_at")
        .eq("lote_id", lote.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!itens || itens.length === 0) {
        toast.warning("Não há colaboradores neste lote para baixar.");
        return;
      }

      // Filtrar duplicatas
      const cpfsProcessados = new Set();
      const itensUnicos = itens.filter((item) => {
        const cpfLimpo = item.cpf.replace(/\D/g, "");
        if (cpfsProcessados.has(cpfLimpo)) return false;
        cpfsProcessados.add(cpfLimpo);
        return true;
      });

      itensUnicos.sort((a, b) => a.nome.localeCompare(b.nome));

      let cnpj = lote.empresa?.cnpj || "";
      if (!cnpj && lote.empresa_id) {
        const { data: emp } = await supabase
          .from("empresas")
          .select("cnpj")
          .eq("id", lote.empresa_id)
          .single();
        if (emp) cnpj = emp.cnpj;
      }
      cnpj = cnpj.replace(/\D/g, "");

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Lista Seguradora");
      const headers = [
        "NOME COMPLETO",
        "SEXO",
        "CPF",
        "DATA NASCIMENTO",
        "SALARIO",
        "CLASSIFICACAO SALARIAL",
        "CNPJ DA EMPRESA",
      ];
      const headerRow = worksheet.addRow(headers);

      const COL_WIDTH = 37.11;
      worksheet.columns = headers.map(() => ({ width: COL_WIDTH }));

      headerRow.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF203455" } };
        cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
        cell.alignment = { horizontal: "center" };
      });

      itensUnicos.forEach((c) => {
        let dataNascDate = null;
        if (c.data_nascimento) {
          const parts = c.data_nascimento.split("-");
          if (parts.length === 3)
            dataNascDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        }

        const row = worksheet.addRow([
          c.nome ? c.nome.toUpperCase() : "",
          c.sexo || "Masculino",
          c.cpf ? formatCPF(c.cpf) : "",
          dataNascDate,
          c.salario ? Number(c.salario) : 0,
          c.classificacao_salario || "",
          formatCNPJ(cnpj),
        ]);

        if (dataNascDate) row.getCell(4).numFmt = "dd/mm/yyyy";
        row.getCell(5).numFmt = "#,##0.00";
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `HISTORICO_${lote.empresa?.nome.replace(/[^a-zA-Z0-9]/g, "")}_${lote.competencia.replace("/", "-")}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Download concluído.");
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao gerar planilha: " + e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <History className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Histórico</h1>
            <p className="text-muted-foreground">Lotes faturados</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por empresa..."
              className="pl-8 bg-background"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <Select
            value={competenciaFilter}
            onValueChange={(v) => {
              setCompetenciaFilter(v);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-full md:w-[180px] bg-background">
              <SelectValue placeholder="Competência" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as competências</SelectItem>
              {competencias.map((comp) => (
                <SelectItem key={comp} value={comp}>
                  {comp}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as "alfabetica" | "recente")}>
            <SelectTrigger className="w-full md:w-[180px] bg-background">
              <ArrowUpDown className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alfabetica">Ordem Alfabética</SelectItem>
              <SelectItem value="recente">Mais Recentes</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5 text-primary" />
            Lotes Faturados ({filteredLotes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : paginatedLotes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum lote faturado encontrado
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Obra</TableHead>
                    <TableHead>Competência</TableHead>
                    <TableHead className="text-center">Vidas</TableHead>
                    <TableHead className="text-center">Valor</TableHead>
                    <TableHead className="text-center">NF Emitida</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLotes.map((lote) => {
                    const vidas = (lote.total_colaboradores || 0) - (lote.total_reprovados || 0);
                    const nfEmitida = notasMap.get(lote.id) || false;

                    return (
                      <TableRow key={lote.id}>
                        <TableCell className="font-medium">{lote.empresa?.nome || "-"}</TableCell>
                        <TableCell>{lote.obra?.nome || "Sede"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{lote.competencia}</Badge>
                        </TableCell>
                        <TableCell className="text-center">{vidas}</TableCell>
                        <TableCell className="text-center">
                          R$ {(lote.valor_total || 0).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-center">
                          {nfEmitida ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                          ) : (
                            <XCircle className="h-5 w-5 text-muted-foreground mx-auto" />
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDownload(lote)}
                            title="Baixar lista"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Página {currentPage} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Próxima
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
