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
import { formatCPF, formatCNPJ, formatCurrency } from "@/lib/validators";

// URL DA LOGO (Funciona perfeitamente com HTML nativo)
const LOGO_URL =
  "https://gkmobhbmgxwrpuucoykn.supabase.co/storage/v1/object/public/MainBucket/Gemini_Generated_Image_c0slgsc0slgsc0sl-removebg-preview.png";

interface GerarAdendoBtnProps {
  empresaId: string;
  variant?: "default" | "outline" | "ghost";
}

export function GerarAdendoBtn({ empresaId, variant = "outline" }: GerarAdendoBtnProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [apolice, setApolice] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const getDataAtualExtenso = () => {
    const data = new Date();
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
    return `Salvador, ${data.getDate()} de ${meses[data.getMonth()]} de ${data.getFullYear()}`;
  };

  const formatDataPTBR = (dateString: string) => {
    if (!dateString) return "--/--/----";
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${year}`;
  };

  // --- GERADOR DE HTML (CSS INLINE) ---
  const generateHtml = (empresa: any, colaboradores: any[]) => {
    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Adendo Contratual - ${empresa.nome}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          
          @page { size: A4; margin: 20mm; }
          
          body { 
            font-family: 'Inter', sans-serif; 
            color: #333; 
            line-height: 1.5; 
            font-size: 13px; 
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact;
          }
          
          /* ESTRUTURA DE PÁGINA */
          .page-container {
            position: relative;
            min-height: 980px; /* Altura aproximada do conteúdo A4 útil */
            display: flex;
            flex-direction: column;
          }

          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 2px solid #203455; padding-bottom: 15px; }
          .header-title { color: #203455; font-weight: 700; font-size: 16px; text-transform: uppercase; margin-top: 10px; }
          .logo { width: 100px; height: auto; object-fit: contain; }
          
          .date { text-align: right; margin-bottom: 30px; font-size: 12px; color: #666; }
          
          .section-title { 
            color: #203455; 
            font-weight: 700; 
            font-size: 14px; 
            margin-top: 25px; 
            margin-bottom: 10px; 
            text-transform: uppercase; 
            border-left: 4px solid #203455;
            padding-left: 10px;
          }

          .content-box { margin-bottom: 20px; line-height: 1.6; }
          .label { font-weight: 700; color: #000; margin-right: 5px; }
          
          .text-justify { text-align: justify; margin-bottom: 15px; }

          /* ASSINATURA NO RODAPÉ DA PÁGINA 1 */
          .signature-wrapper {
            margin-top: auto; /* Empurra para o fundo do flex container */
            padding-bottom: 20px;
            width: 100%;
            text-align: center;
          }
          .signature-line { 
            border-top: 1px solid #000; 
            width: 300px; 
            margin: 0 auto 5px auto; 
          }
          .signature-role { font-weight: 700; font-size: 12px; text-transform: uppercase; }
          .signature-sub { font-weight: 400; font-size: 11px; margin-top: 2px; }

          /* TABELA DE VIDAS */
          .page-break { page-break-before: always; }
          
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 15px; 
            font-size: 11px; 
            border: 1px solid #e2e8f0;
          }
          
          th { 
            background-color: #203455 !important; /* Azul Escuro */
            color: white !important; 
            padding: 10px 8px; 
            text-align: left; 
            text-transform: uppercase;
            font-weight: 600;
            border: 1px solid #1e293b;
          }
          
          td { 
            padding: 8px; 
            border: 1px solid #e2e8f0; /* Linhas de Grade */
            color: #333;
          }
          
          tr:nth-child(even) { background-color: #f8fafc !important; } /* Zebrado leve */
          
          .total-row { 
            text-align: right; 
            font-weight: 700; 
            padding: 15px 0; 
            font-size: 12px; 
            color: #203455;
          }

          .text-center { text-align: center; }
          .text-right { text-align: right; }
        </style>
      </head>
      <body>
        
        <div class="page-container">
          
          <div class="header">
            <div class="header-title">SEGURO DE ACIDENTES PESSOAIS COLETIVO</div>
            <img src="${LOGO_URL}" class="logo" alt="Logo VV" />
          </div>

          <div class="date">${getDataAtualExtenso()}</div>

          <div class="content-box">
            <div><span class="label">ESTIPULANTE:</span> VV BENEFICIOS E CONSULTORIA LTDA</div>
            <div><span class="label">CNPJ Nº:</span> 56.967.823/0001-45</div>
            <div><span class="label">APÓLICE Nº:</span> ${apolice}</div>
            <div><span class="label">CORRETOR:</span> GERSON BARTH PORTNOI</div>
          </div>

          <div class="text-justify">
            Pelo presente documento, que passa a integrar a apólice nº <strong>${apolice}</strong> 
            fica acordada entre as partes contratantes deste seguro que: A empresa mencionada está ativa e regular nesta apólice.
          </div>

          <div class="text-justify">
            <strong>Vigência:</strong> ${formatDataPTBR(dataInicio)} a ${formatDataPTBR(dataFim)} 
            inclui-se o seguinte subestipulante:
          </div>

          <div class="section-title">DADOS DA EMPRESA</div>
          <div class="content-box">
            <div><span class="label">Nome:</span> ${empresa.nome.toUpperCase()}</div>
            <div><span class="label">CNPJ:</span> ${formatCNPJ(empresa.cnpj)}</div>
            <div><span class="label">Endereço:</span> ${empresa.endereco || "Não informado"}</div>
            <div><span class="label">Email:</span> contato@vvbeneficios.com.br</div>
            <div><span class="label">Telefone:</span> (71) 99692-8880</div>
          </div>

          <div class="signature-wrapper">
            <div class="signature-line"></div>
            <div class="signature-role">ESTIPULANTE</div>
            <div class="signature-sub">Assinatura do Representante Legal</div>
          </div>

        </div>

        <div class="page-break"></div>

        <div class="header">
          <div class="header-title">RELAÇÃO DE VIDAS</div>
          <img src="${LOGO_URL}" class="logo" alt="Logo VV" />
        </div>

        <table>
          <thead>
            <tr>
              <th width="35%">NOME</th>
              <th width="10%" class="text-center">SEXO</th>
              <th width="15%" class="text-center">NASCIMENTO</th>
              <th width="15%" class="text-center">CPF</th>
              <th width="12%" class="text-right">SALÁRIO</th>
              <th width="13%">CLASSIFICAÇÃO</th>
            </tr>
          </thead>
          <tbody>
            ${colaboradores
              .map(
                (c) => `
              <tr>
                <td>${c.nome}</td>
                <td class="text-center">${c.sexo || "-"}</td>
                <td class="text-center">${formatDataPTBR(c.data_nascimento)}</td>
                <td class="text-center">${formatCPF(c.cpf)}</td>
                <td class="text-right">${formatCurrency(c.salario)}</td>
                <td>${c.classificacao_salario || c.cargo || "-"}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>

        <div class="total-row">
          Total de Vidas: ${colaboradores.length}
        </div>

      </body>
      </html>
    `;
  };

  const handleImprimir = async () => {
    if (!apolice || !dataInicio || !dataFim) {
      toast.error("Preencha todos os campos para gerar o documento.");
      return;
    }

    setLoading(true);
    try {
      // 1. Busca Dados
      const { data: empresa, error: erroEmpresa } = await supabase
        .from("empresas")
        .select("*")
        .eq("id", empresaId)
        .single();
      if (erroEmpresa) throw erroEmpresa;

      const { data: colaboradores, error: erroColab } = await supabase
        .from("colaboradores")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("status", "ativo")
        .order("nome");

      if (erroColab) throw erroColab;

      if (!colaboradores?.length) {
        toast.warning("Empresa sem colaboradores ativos.");
        setLoading(false);
        return;
      }

      // 2. Gera HTML
      const htmlContent = generateHtml(empresa, colaboradores);

      // 3. Abre Janela e Imprime
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();

        // Aguarda carregar imagens antes de imprimir
        printWindow.addEventListener("load", () => {
          setTimeout(() => {
            printWindow.focus();
            printWindow.print();
          }, 500);
        });

        toast.success("Documento gerado!");
        setOpen(false);
      } else {
        toast.error("Pop-up bloqueado. Permita pop-ups para gerar o PDF.");
      }
    } catch (error: any) {
      console.error(error);
      toast.error("Erro: " + error.message);
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
          <DialogDescription>Preencha os dados da apólice para imprimir.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Número da Apólice</Label>
            <Input value={apolice} onChange={(e) => setApolice(e.target.value)} placeholder="Ex: 123456" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Início Vigência</Label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Fim Vigência</Label>
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleImprimir} disabled={loading} className="bg-[#203455] hover:bg-[#2c456b]">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
            Imprimir / Salvar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
