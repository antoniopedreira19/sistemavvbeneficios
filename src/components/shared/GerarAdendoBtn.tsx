import { useState, useEffect } from "react";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FileText, Loader2, Printer, CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import { formatCPF, formatCNPJ, formatCurrency } from "@/lib/validators";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import logoAdendo from "@/assets/logo-vv-adendo.png";

// CORES DO SISTEMA
const COLORS = {
  PRIMARY: "#203455", // Azul VV
  SECONDARY: "#F5F5F5", // Branco Gelo
  TEXT_MAIN: "#333333",
  TEXT_LIGHT: "#666666",
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

// Converte imagem importada para base64
const getBase64FromImportedImage = (imgSrc: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve("");
    img.src = imgSrc;
  });
};

interface GerarAdendoBtnProps {
  empresaId: string;
  variant?: "default" | "outline" | "ghost";
}

export function GerarAdendoBtn({ empresaId, variant = "outline" }: GerarAdendoBtnProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string>("");

  // Estados do Formulário
  const [apolice, setApolice] = useState("");
  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();

  // Carrega a logo como base64 ao montar o componente
  useEffect(() => {
    getBase64FromImportedImage(logoAdendo).then(setLogoBase64);
  }, []);

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

  const formatDataPTBR = (date: Date | string | undefined) => {
    if (!date) return "--/--/----";
    if (typeof date === "string") {
      const [year, month, day] = date.split("-");
      return `${day}/${month}/${year}`;
    }
    return format(date, "dd/MM/yyyy");
  };

  const gerarDocumento = async () => {
    if (!apolice || !dataInicio || !dataFim) {
      toast.error("Por favor, preencha todos os campos.");
      return;
    }

    setLoading(true);
    try {

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

      // --- DEFINIÇÃO DO PDF ---
      const docDefinition: any = {
        pageSize: "A4",
        pageMargins: [40, 90, 40, 60], // Margem superior maior (90) para o cabeçalho

        // CABEÇALHO (Repete em todas as páginas)
        header: {
          margin: [40, 30, 40, 0],
          columns: [
            {
              text: "SEGURO DE ACIDENTES PESSOAIS COLETIVO",
              color: COLORS.PRIMARY,
              bold: true,
              fontSize: 12,
              alignment: "left",
              margin: [0, 10, 0, 0], // Ajuste vertical para alinhar com a logo
            },
            logoBase64
              ? {
                  image: logoBase64,
                  width: 60, // Logo menor
                  alignment: "right",
                }
              : null,
          ],
        },

        content: [
          // DATA (Topo Pág 1)
          {
            text: getDataAtualExtenso(),
            alignment: "right",
            fontSize: 10,
            margin: [0, 0, 0, 30],
          },

          // BLOCO ESTIPULANTE (Visual Clean)
          {
            style: "boxClean",
            text: [
              { text: "ESTIPULANTE: ", bold: true },
              "VV BENEFICIOS E CONSULTORIA LTDA\n",
              { text: "CNPJ Nº: ", bold: true },
              "56.967.823/0001-45\n",
              { text: "APÓLICE Nº: ", bold: true },
              `${apolice}\n`,
              { text: "CORRETOR: ", bold: true },
              "GERSON BARTH PORTNOI",
            ],
            margin: [0, 0, 0, 25],
            lineHeight: 1.4,
          },

          // TEXTO JURÍDICO
          {
            text: [
              "Pelo presente documento, que passa a integrar a apólice nº ",
              { text: apolice, bold: true },
              " fica acordada entre as partes contratantes deste seguro que: A empresa mencionada está ativa e regular nesta apólice.\n\n",
              { text: "Vigência: ", bold: true },
              `${formatDataPTBR(dataInicio)} a ${formatDataPTBR(dataFim)}`,
              " inclui-se o seguinte subestipulante:",
            ],
            fontSize: 10,
            alignment: "justify",
            margin: [0, 0, 0, 25],
            lineHeight: 1.4,
          },

          // DADOS DA EMPRESA (Clean)
          {
            text: "DADOS DA EMPRESA",
            bold: true,
            fontSize: 11,
            color: COLORS.PRIMARY,
            margin: [0, 0, 0, 8],
          },
          {
            style: "boxClean",
            text: [
              { text: "Nome: ", bold: true },
              `${empresa.nome.toUpperCase()}\n`,
              { text: "CNPJ: ", bold: true },
              `${formatCNPJ(empresa.cnpj)}\n`,
              { text: "Endereço: ", bold: true },
              `${empresa.endereco || "Não informado"}\n`,
              { text: "Email: ", bold: true },
              "contato@vvbeneficios.com.br\n",
              { text: "Telefone: ", bold: true },
              "(71) 99692-8880",
            ],
            margin: [0, 0, 0, 0], // Margem inferior controlada pela posição absoluta da assinatura
            lineHeight: 1.4,
          },

          // ASSINATURA (Posição Absoluta no Rodapé da Página 1)
          {
            absolutePosition: { x: 40, y: 700 }, // Fixa no final da página A4
            stack: [
              { text: "___________________________________________________", alignment: "center" },
              { text: "ESTIPULANTE", alignment: "center", bold: true, fontSize: 10, margin: [0, 5, 0, 0] },
            ],
          },

          // --- PÁGINA 2: RELAÇÃO DE VIDAS ---

          {
            text: "RELAÇÃO DE VIDAS",
            style: "header",
            fontSize: 14,
            color: COLORS.PRIMARY,
            pageBreak: "before", // Força pular para página 2
            margin: [0, 0, 0, 15],
          },

          {
            table: {
              headerRows: 1,
              widths: ["*", 40, 70, 85, 70, "auto"],
              body: [
                [
                  { text: "NOME", style: "tableHeader" },
                  { text: "SEXO", style: "tableHeader" },
                  { text: "NASCIMENTO", style: "tableHeader" },
                  { text: "CPF", style: "tableHeader" },
                  { text: "SALÁRIO", style: "tableHeader" },
                  { text: "CLASSIFICAÇÃO", style: "tableHeader" },
                ],
                ...colaboradores.map((colab, index) => {
                  const rowStyle = index % 2 === 0 ? "tableRow" : "tableRowOdd";
                  return [
                    { text: colab.nome, style: rowStyle },
                    { text: colab.sexo || "-", alignment: "center", style: rowStyle },
                    { text: formatDataPTBR(colab.data_nascimento), alignment: "center", style: rowStyle },
                    { text: formatCPF(colab.cpf), alignment: "center", style: rowStyle },
                    { text: formatCurrency(colab.salario), alignment: "right", style: rowStyle },
                    { text: colab.classificacao_salario || colab.cargo || "-", style: rowStyle },
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

          // Rodapé Tabela
          {
            text: `Total de Vidas: ${colaboradores.length}`,
            bold: true,
            alignment: "right",
            margin: [0, 10, 0, 0],
            fontSize: 10,
          },
        ],

        styles: {
          boxClean: {
            fontSize: 10,
            color: COLORS.TEXT_MAIN,
          },
          tableHeader: {
            bold: true,
            fontSize: 8,
            color: "white",
            fillColor: COLORS.PRIMARY,
            alignment: "center",
            margin: [0, 5, 0, 5],
          },
          tableRow: {
            fontSize: 8,
            color: COLORS.TEXT_MAIN,
            margin: [0, 4, 0, 4],
          },
          tableRowOdd: {
            fontSize: 8,
            color: COLORS.TEXT_MAIN,
            margin: [0, 4, 0, 4],
          },
        },
        defaultStyle: {
          font: "Roboto",
          fontSize: 10,
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
              <Label>Vigência (Início)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dataInicio && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataInicio ? format(dataInicio, "dd/MM/yyyy") : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataInicio}
                    onSelect={setDataInicio}
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid gap-2">
              <Label>Vigência (Fim)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dataFim && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataFim ? format(dataFim, "dd/MM/yyyy") : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataFim}
                    onSelect={setDataFim}
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
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
