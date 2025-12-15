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

// URL DA LOGO (Fornecida)
const LOGO_URL =
  "https://gkmobhbmgxwrpuucoykn.supabase.co/storage/v1/object/public/MainBucket/Gemini_Generated_Image_c0slgsc0slgsc0sl-removebg-preview.png";

// CORES DO SISTEMA
const COLORS = {
  PRIMARY: "#203455", // Azul VV
  SECONDARY: "#F5F5F5", // Branco levemente acinzentado
  TEXT_MAIN: "#333333",
};

// Configuração do pdfmake
const fontsModule = pdfFonts as any;
if (fontsModule?.pdfMake?.vfs) {
  (pdfMake as any).vfs = fontsModule.pdfMake.vfs;
} else if (fontsModule?.default?.pdfMake?.vfs) {
  (pdfMake as any).vfs = fontsModule.default.pdfMake.vfs;
} else if (fontsModule?.vfs) {
  (pdfMake as any).vfs = fontsModule.vfs;
}

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

  // Helper: Converter Imagem URL para Base64
  const getBase64ImageFromURL = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.setAttribute("crossOrigin", "anonymous");
      img.onload = () => {
        const canvas = document.createElement("canvas");
        // Ajusta tamanho se necessário, ou mantém original
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0);
        const dataURL = canvas.toDataURL("image/png");
        resolve(dataURL);
      };
      img.onerror = (error) => {
        console.error("Erro ao carregar imagem:", error);
        // Retorna uma string vazia ou placeholder em caso de erro para não quebrar o PDF
        resolve("");
      };
      img.src = url;
    });
  };

  // Helper: Data por extenso
  const getDataAtualExtenso = () => {
    const data = new Date();
    const dia = data.getDate();
    const meses = [
      "janeiro",
      "fevereiro",
      "março",
      "abril",
      "maio",
      "junho",
      "julho",
      "agosto",
      "setembro",
      "outubro",
      "novembro",
      "dezembro",
    ];
    const mes = meses[data.getMonth()];
    const ano = data.getFullYear();
    return `Salvador, ${dia} de ${mes} de ${ano}`;
  };

  // Helper: Formatar data curta
  const formatDataPTBR = (dateString: string) => {
    if (!dateString) return "--/--/----";
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${year}`;
  };

  const gerarDocumento = async () => {
    if (!apolice || !dataInicio || !dataFim) {
      toast.error("Por favor, preencha todos os campos.");
      return;
    }

    setLoading(true);
    try {
      // 1. Carregar Logo
      const logoBase64 = await getBase64ImageFromURL(LOGO_URL);

      // 2. Buscar Dados
      const { data: empresa, error: erroEmpresa } = await supabase
        .from("empresas")
        .select("*")
        .eq("id", empresaId)
        .single();

      if (erroEmpresa) throw new Error("Erro ao buscar empresa");

      const { data: colaboradores, error: erroColab } = await supabase
        .from("colaboradores")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("status", "ativo")
        .order("nome");

      if (erroColab) throw new Error("Erro ao buscar colaboradores");

      if (!colaboradores || colaboradores.length === 0) {
        toast.warning("Empresa sem colaboradores ativos.");
        setLoading(false);
        return;
      }

      // 3. Definição do PDF
      const docDefinition: any = {
        pageSize: "A4",
        pageMargins: [40, 40, 40, 60],

        content: [
          // LOGO
          logoBase64
            ? {
                image: logoBase64,
                width: 150, // Ajuste o tamanho da logo conforme necessário
                alignment: "left",
                margin: [0, 0, 0, 10],
              }
            : null,

          // DATA
          {
            text: getDataAtualExtenso(),
            alignment: "right",
            fontSize: 10,
            margin: [0, 0, 0, 20],
          },

          // BOX VV (AZUL)
          {
            table: {
              widths: ["*"],
              body: [
                [
                  {
                    stack: [
                      { text: [{ text: "ESTIPULANTE: ", bold: true }, "VV BENEFICIOS E CONSULTORIA LTDA"] },
                      { text: [{ text: "CNPJ Nº: ", bold: true }, "56.967.823/0001-45"] },
                      { text: [{ text: "APÓLICE Nº: ", bold: true }, apolice] },
                      { text: [{ text: "CORRETOR: ", bold: true }, "GERSON BARTH PORTNOI"] },
                    ],
                    fillColor: COLORS.PRIMARY,
                    color: "white",
                    fontSize: 10,
                    margin: [10, 10, 10, 10],
                  },
                ],
              ],
            },
            layout: "noBorders",
            margin: [0, 0, 0, 20],
          },

          // TEXTO JURÍDICO
          {
            text: [
              "Pelo presente documento, que passa a integrar a apólice n° ",
              { text: apolice, bold: true },
              " fica acordada entre as partes contratantes deste segura que: A empresa mencionada está ativa e regular nesta apólice.",
            ],
            fontSize: 10,
            alignment: "justify",
            margin: [0, 0, 0, 10],
            lineHeight: 1.3,
          },

          {
            text: [
              { text: "Vigência: ", bold: true },
              `${formatDataPTBR(dataInicio)} a ${formatDataPTBR(dataFim)}`,
              " inclui-se o seguinte subestipulante:",
            ],
            fontSize: 10,
            margin: [0, 0, 0, 15],
          },

          // DADOS DA EMPRESA (BRANCO GELO/CINZA CLARO)
          {
            text: "Dados da Empresa:",
            bold: true,
            fontSize: 11,
            color: COLORS.PRIMARY,
            margin: [0, 0, 0, 2],
          },
          {
            table: {
              widths: ["*"],
              body: [
                [
                  {
                    stack: [
                      { text: [{ text: "Nome: ", bold: true }, empresa.nome.toUpperCase()] },
                      { text: [{ text: "CNPJ: ", bold: true }, formatCNPJ(empresa.cnpj)] },
                      { text: [{ text: "Endereço: ", bold: true }, empresa.endereco || "Não informado"] },
                      { text: " " },
                      { text: [{ text: "Email: ", bold: true }, "contato@vvbeneficios.com.br"] },
                      { text: [{ text: "Telefone: ", bold: true }, "(71) 99692-8880"] },
                    ],
                    fillColor: COLORS.SECONDARY, // #F5F5F5
                    color: COLORS.TEXT_MAIN,
                    fontSize: 10,
                    margin: [10, 10, 10, 10],
                  },
                ],
              ],
            },
            layout: "noBorders",
            margin: [0, 0, 0, 30],
          },

          // ASSINATURA
          {
            stack: [
              { text: "___________________________________________________", alignment: "center" },
              { text: "ESTIPULANTE", alignment: "center", bold: true, fontSize: 10, margin: [0, 5, 0, 0] },
            ],
            margin: [0, 0, 0, 40],
          },

          // TABELA DE VIDAS
          { text: "RELAÇÃO DE VIDAS", style: "header", fontSize: 12, color: COLORS.PRIMARY, margin: [0, 0, 0, 5] },
          {
            table: {
              headerRows: 1,
              widths: ["*", "auto", "auto", 85, "auto", "auto"],
              body: [
                // Cabeçalho
                [
                  { text: "NOME", style: "tableHeader" },
                  { text: "SEXO", style: "tableHeader" },
                  { text: "DATA NASCIMENTO", style: "tableHeader" },
                  { text: "CPF", style: "tableHeader" },
                  { text: "SALÁRIO", style: "tableHeader" },
                  { text: "CLASSIFICAÇÃO", style: "tableHeader" },
                ],
                // Linhas
                ...colaboradores.map((colab, index) => {
                  const rowStyle = index % 2 === 0 ? "tableRow" : "tableRowOdd";
                  return [
                    { text: colab.nome, style: rowStyle },
                    { text: colab.sexo || "-", alignment: "center", style: rowStyle },
                    { text: formatDataPTBR(colab.data_nascimento), alignment: "center", style: rowStyle },
                    { text: formatCPF(colab.cpf), alignment: "center", style: rowStyle },
                    { text: formatCurrency(colab.salario), alignment: "right", style: rowStyle },
                    { text: colab.cargo || "-", style: rowStyle }, // Usando Cargo como Classificação
                  ];
                }),
              ],
            },
            layout: {
              hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length ? 1 : 0.5),
              vLineWidth: () => 0,
              hLineColor: () => "#e5e7eb",
              fillColor: (rowIndex: number) => {
                return rowIndex === 0 ? COLORS.PRIMARY : rowIndex % 2 === 0 ? null : "#F9FAFB";
              },
            },
          },
        ],

        styles: {
          header: { bold: true, fontSize: 12, margin: [0, 0, 0, 10] },
          tableHeader: {
            bold: true,
            fontSize: 8,
            color: "white",
            fillColor: COLORS.PRIMARY,
            alignment: "center",
            margin: [0, 4, 0, 4],
          },
          tableRow: {
            fontSize: 8,
            color: COLORS.TEXT_MAIN,
            margin: [0, 3, 0, 3],
          },
          tableRowOdd: {
            fontSize: 8,
            color: COLORS.TEXT_MAIN,
            margin: [0, 3, 0, 3],
          },
        },
        defaultStyle: {
          font: "Roboto",
          fontSize: 10,
          lineHeight: 1.2,
        },
      };

      pdfMake.createPdf(docDefinition).open();
      toast.success("Adendo gerado com sucesso!");
      setOpen(false);
    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao gerar PDF: " + error.message);
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
          <DialogTitle>Gerar Adendo - Apólice</DialogTitle>
          <DialogDescription>Preencha os dados da apólice para gerar o documento oficial.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
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
            <div className="grid gap-2">
              <Label htmlFor="inicio">Vigência (Início)</Label>
              <Input id="inicio" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fim">Vigência (Fim)</Label>
              <Input id="fim" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={gerarDocumento} disabled={loading} className="bg-[#203455] hover:bg-[#2c456b]">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
            Gerar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
