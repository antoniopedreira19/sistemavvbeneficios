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

// URL DA LOGO (Funciona perfeitamente com tag <img> HTML)
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

  // --- GERADOR DE HTML (CSS INLINE PARA GARANTIR A IMPRESSÃO) ---
  const generateHtml = (empresa: any, colaboradores: any[]) => {
    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Adendo Contratual - ${empresa.nome}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
          
          @page { margin: 20mm; size: A4; }
          
          body { font-family: 'Inter', sans-serif; color: #333; line-height: 1.5; font-size: 14px; }
          
          .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }
          .header-title { color: #203455; font-weight: 700; font-size: 14px; text-transform: uppercase; width: 60%; }
          .logo { width: 100px; height: auto; object-fit: contain; }
          
          .date { text-align: right; margin-bottom: 30px; font-size: 12px; }
          
          .box { margin-bottom: 20px; }
          .box-row { margin-bottom: 4px; }
          .label { font-weight: 700; color: #000; }
          .value { color: #333; }
          
          .text-content { text-align: justify; margin-bottom: 20px; font-size: 13px; }
          
          .highlight-title { 
            color: #203455; 
            font-weight: 700; 
            font-size: 14px; 
            margin-top: 30px; 
            margin-bottom: 10px; 
            text-transform: uppercase; 
          }

          .footer-signature {
            margin-top: 100px;
            text-align: center;
            page-break-inside: avoid;
          }
          .line { border-top: 1px solid #000; width: 300px; margin: 0 auto 5px auto; }
          .role { font-weight: 700; font-size: 12px; }

          /* Tabela */
          .page-break { page-break-before: always; }
          
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
          th { 
            background-color: #203455; 
            color: white; 
            padding: 8px; 
            text-align: left; 
            text-transform: uppercase;
            font-size: 10px;
          }
          td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
          tr:nth-child(even) { background-color: #F5F5F5; }
          
          .total { text-align: right; margin-top: 10px; font-weight: 700; font-size: 12px; }
        </style>
      </head>
      <body>
        
        <div class="header">
          <div class="header-title">SEGURO DE ACIDENTES PESSOAIS COLETIVO</div>
          <img src="${LOGO_URL}" class="logo" alt="VV Logo" />
        </div>

        <div class="date">${getDataAtualExtenso()}</div>

        <div class="box">
          <div class="box-row"><span class="label">ESTIPULANTE:</span> <span class="value">VV BENEFICIOS E CONSULTORIA LTDA</span></div>
          <div class="box-row"><span class="label">CNPJ Nº:</span> <span class="value">56.967.823/0001-45</span></div>
          <div class="box-row"><span class="label">APÓLICE Nº:</span> <span class="value">${apolice}</span></div>
          <div class="box-row"><span class="label">CORRETOR:</span> <span class="value">GERSON BARTH PORTNOI</span></div>
        </div>

        <div class="text-content">
          Pelo presente documento, que passa a integrar a apólice nº <strong>${apolice}</strong> 
          fica acordada entre as partes contratantes deste seguro que: A empresa mencionada está ativa e regular nesta apólice.
        </div>

        <div class="text-content">
          <strong>Vigência:</strong> ${formatDataPTBR(dataInicio)} a ${formatDataPTBR(dataFim)} 
          inclui-se o seguinte subestipulante:
        </div>

        <div class="highlight-title">DADOS DA EMPRESA</div>
        <div class="box" style="line-height: 1.6;">
          <div class="box-row"><span class="label">Nome:</span> <span class="value">${empresa.nome.toUpperCase()}</span></div>
          <div class="box-row"><span class="label">CNPJ:</span> <span class="value">${formatCNPJ(empresa.cnpj)}</span></div>
          <div class="box-row"><span class="label">Endereço:</span> <span class="value">${empresa.endereco || "Não informado"}</span></div>
          <div class="box-row"><span class="label">Email:</span> <span class="value">contato@vvbeneficios.com.br</span></div>
          <div class="box-row"><span class="label">Telefone:</span> <span class="value">(71) 99692-8880</span></div>
        </div>

        <div class="footer-signature">
          <div class="line"></div>
          <div class="role">ESTIPULANTE</div>
        </div>

        <div class="page-break"></div>

        <div class="header">
          <div class="header-title">RELAÇÃO DE VIDAS</div>
          <img src="${LOGO_URL}" class="logo" alt="VV Logo" />
        </div>

        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Sexo</th>
              <th>Nascimento</th>
              <th>CPF</th>
              <th style="text-align: right;">Salário</th>
              <th>Classificação</th>
            </tr>
          </thead>
          <tbody>
            ${colaboradores
              .map(
                (c) => `
              <tr>
                <td>${c.nome}</td>
                <td>${c.sexo || "-"}</td>
                <td>${formatDataPTBR(c.data_nascimento)}</td>
                <td>${formatCPF(c.cpf)}</td>
                <td style="text-align: right;">${formatCurrency(c.salario)}</td>
                <td>${c.classificacao_salario || c.cargo || "-"}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>

        <div class="total">Total de Vidas: ${colaboradores.length}</div>

      </body>
      </html>
    `;
  };

  const handleImprimir = async () => {
    if (!apolice || !dataInicio || !dataFim) {
      toast.error("Preencha todos os campos.");
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
            // Opcional: printWindow.close(); // Fecha automaticamente após imprimir
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
