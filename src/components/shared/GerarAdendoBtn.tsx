import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Loader2, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import { formatCPF, formatCNPJ, formatCurrency } from "@/lib/validators";

// Configuração do pdfmake
pdfMake.vfs = pdfFonts.pdfMake.vfs;

interface GerarAdendoBtnProps {
  empresaId: string;
  variant?: "default" | "outline" | "ghost";
}

export function GerarAdendoBtn({ empresaId, variant = "outline" }: GerarAdendoBtnProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Estados do Formulário Manual
  const [apolice, setApolice] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  // Helper para formatar data YYYY-MM-DD para DD/MM/YYYY
  const formatDataPTBR = (dateString: string) => {
    if (!dateString) return "Data Inválida";
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${year}`;
  };

  const gerarDocumento = async () => {
    if (!apolice || !dataInicio || !dataFim) {
      toast.error("Por favor, preencha o número da apólice e as datas de vigência.");
      return;
    }

    setLoading(true);
    try {
      // 1. Buscar Dados da Empresa
      const { data: empresa, error: erroEmpresa } = await supabase
        .from("empresas")
        .select("*")
        .eq("id", empresaId)
        .single();

      if (erroEmpresa) throw new Error("Erro ao buscar empresa");

      // 2. Buscar Colaboradores Ativos
      const { data: colaboradores, error: erroColab } = await supabase
        .from("colaboradores")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("status", "ativo")
        .order("nome");

      if (erroColab) throw new Error("Erro ao buscar colaboradores");

      if (!colaboradores || colaboradores.length === 0) {
        toast.warning("Esta empresa não possui colaboradores ativos.");
        setLoading(false);
        return;
      }

      // Prepara as datas formatadas
      const vigenciaTexto = `${formatDataPTBR(dataInicio)} a ${formatDataPTBR(dataFim)}`;

      // 3. Montar o PDF
      const docDefinition: any = {
        pageSize: "A4",
        pageMargins: [40, 60, 40, 60],
        header: {
          text: "ADENDO CONTRATUAL - RELAÇÃO DE VIDAS",
          alignment: "center",
          margin: [0, 20, 0, 0],
          fontSize: 9,
          color: "#666",
        },
        content: [
          // Título
          { text: "ADENDO DE INCLUSÃO DE VIDAS", style: "header", margin: [0, 0, 0, 20] },

          // NOVO TEXTO SOLICITADO
          {
            text: [
              "Pelo presente documento, que passa a integrar a apólice nº ",
              { text: apolice, bold: true }, // Variável da Apólice
              " fica acordado entre as partes contratantes deste seguro que: A empresa mencionada está ativa e regular nesta apólice.\n",
              "Vigência: ",
              { text: vigenciaTexto, bold: true }, // Variável da Vigência
              " inclui-se o seguinte Subestipulante:"
            ],
            fontSize: 11,
            alignment: "justify",
            margin: [0, 0, 0, 20], // Espaçamento abaixo do texto
            lineHeight: 1.5
          },

          // Dados da Empresa (Subestipulante)
          {
            style: "boxEmpresa",
            table: {
              widths: ["*"],
              body: [
                [
                  {
                    text: [
                      { text: "EMPRESA (SUBESTIPULANTE): ", bold: true },
                      `${empresa.nome.toUpperCase()}\n`,
                      { text: "CNPJ: ", bold: true },
                      `${formatCNPJ(empresa.cnpj)}\n`,
                      { text: "ENDEREÇO: ", bold: true },
                      `${empresa.endereco || "Não informado"}`,
                    ],
                    margin: [5, 5, 5, 5],
                  },
                ],
              ],
            },
            layout: "noBorders",
            margin: [0, 0, 0, 20],
          },

          // Tabela de Colaboradores
          { text: "RELAÇÃO DE VIDAS:", style: "subheader", margin: [0, 0, 0, 5] },
          {
            style: "tableExample",
            table: {
              headerRows: 1,
              widths: ["*", "auto", "auto", "auto"],
              body: [
                [
                  { text: "Nome Completo", style: "tableHeader" },
                  { text: "CPF", style: "tableHeader" },
                  { text: "Função", style: "tableHeader" },
                  { text: "Salário", style: "tableHeader" },
                ],
                ...colaboradores.map((colab) => [
                  { text: colab.nome, fontSize: 9 },
                  { text: formatCPF(colab.cpf), fontSize: 9 },
                  { text: colab.cargo || "-", fontSize: 9 },
                  { text: formatCurrency(colab.salario), fontSize: 9, alignment: "right" },
                ]),
              ],
            },
            layout: "lightHorizontalLines",
          },

          // Rodapé / Assinatura
          {
            text: `Total de Vidas: ${colaboradores.length}`,
            bold: true,
            margin: [0, 10, 0, 40],
            alignment: "right",
          },

          { text: "LOCAL E DATA:", style: "subheader", margin: [0, 0, 0, 5] },
          { text: `______________________, _____ de ___________________ de 20____.`, margin: [0, 0, 0, 40] },

          {
            columns: [
              {
                stack: [
                  { text: "____________________________________", alignment: "center" },
                  { text: "VV BENEFÍCIOS & SEGUROS", alignment: "center", bold: true, fontSize: 10 },
                ],
              },
              {
                stack: [
                  { text: "____________________________________", alignment: "center" },
                  { text: empresa.responsavel_nome ? typeof empresa.responsavel_nome === 'string' ? empresa.responsavel_nome.toUpperCase() : "RESPONSÁVEL" : "RESPONSÁVEL LEGAL", alignment: "center", bold: true, fontSize: 10 },
                ],
              },
            ],
          },
        ],
        styles: {
          header: { fontSize: 14, bold: true, alignment: "center" },
          subheader: { fontSize: 11, bold: true },
          tableHeader: { bold: true, fontSize: 10, color: "black", fillColor: "#eeeeee" },
        },
        defaultStyle: {
          font: "Roboto",
        },
      };

      pdfMake.createPdf(docDefinition).open();
      toast.success("Documento gerado!");
      setOpen(false); // Fecha o modal após gerar

    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao gerar PDF.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} className="gap-2">
          <FileText className="h-4 w-4" />
          Gerar Adendo
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Gerar Adendo Contratual</DialogTitle>
          <DialogDescription>
            Informe os dados da apólice vigente para compor o documento.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Campo Apólice */}
          <div className="grid gap-2">
            <Label htmlFor="apolice">Número da Apólice</Label>
            <Input
              id="apolice"
              placeholder="Ex: 123456789000"
              value={apolice}
              onChange={(e) => setApolice(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Data Início */}
            <div className="grid gap-2">
              <Label htmlFor="inicio">Vigência (Início)</Label>
              <Input
                id="inicio"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>
            
            {/* Data Fim */}
            <div className="grid gap-2">
              <Label htmlFor="fim">Vigência (Fim)</Label>
              <Input
                id="fim"
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={gerarDocumento} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
            Gerar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
