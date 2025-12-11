import { useState, useEffect, useRef } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  Loader2,
  Upload,
  FileSpreadsheet,
  CheckCircle,
  Plus,
  Building,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Check,
  ChevronsUpDown,
  X,
  Save,
  Pencil,
} from "lucide-react";
import * as XLSX from "xlsx";
import { validateCPF, formatCPF, formatCNPJ } from "@/lib/validators";
import { cn } from "@/lib/utils";

// --- CONSTANTES ---
const CLASSIFICACOES_SALARIO = [
  { label: "Ajudante Comum", minimo: 1454.2 },
  { label: "Ajudante Prático/Meio-Oficial", minimo: 1476.2 },
  { label: "Oficial", minimo: 2378.34 },
  { label: "Op. Qualificado I", minimo: 2637.8 },
  { label: "Op. Qualificado II", minimo: 3262.6 },
  { label: "Op. Qualificado III", minimo: 4037.0 },
];

const calcularClassificacao = (salario: number) => {
  if (salario < CLASSIFICACOES_SALARIO[0].minimo) return CLASSIFICACOES_SALARIO[0].label;
  const item = [...CLASSIFICACOES_SALARIO].reverse().find((c) => salario >= c.minimo);
  return item?.label || CLASSIFICACOES_SALARIO[0].label;
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
  if (!valor) return 0;
  
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
  return isNaN(num) ? 0 : num;
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

const normalizarData = (valor: any): { date: string; valid: boolean } => {
  if (!valor) return { date: "", valid: false };
  
  const str = String(valor).trim();
  
  // Tenta formato DD/MM/YYYY
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

interface ValidatedRow {
  linha: number;
  nome: string;
  cpf: string;
  sexo: string;
  data_nascimento: string;
  salario: number;
  classificacao_salario: string;
  status: "valido" | "erro";
  erros: string[];
}

interface EmpresaComCNPJ {
  id: string;
  nome: string;
  cnpj: string;
}

export function AdminImportarLoteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"selecao" | "upload" | "conclusao">("selecao");

  const [empresas, setEmpresas] = useState<EmpresaComCNPJ[]>([]);
  const [obras, setObras] = useState<{ id: string; nome: string }[]>([]);

  const [selectedEmpresa, setSelectedEmpresa] = useState("");
  const [selectedObra, setSelectedObra] = useState("");
  const [competencia, setCompetencia] = useState("");
  const [openCombobox, setOpenCombobox] = useState(false);

  // Estados para criação de obra personalizada
  const [isCreatingObra, setIsCreatingObra] = useState(false);
  const [newObraName, setNewObraName] = useState("");

  const [colaboradores, setColaboradores] = useState<ValidatedRow[]>([]);

  useEffect(() => {
    if (open) {
      supabase
        .from("empresas")
        .select("id, nome, cnpj")
        .eq("status", "ativa")
        .order("nome")
        .then(({ data }) => setEmpresas((data as EmpresaComCNPJ[]) || []));

      const data = new Date();
      const meses = [
        "Janeiro",
        "Fevereiro",
        "Março",
        "Abril",
        "Maio",
        "Junho",
        "Julho",
        "Agosto",
        "Setembro",
        "Outubro",
        "Novembro",
        "Dezembro",
      ];
      setCompetencia(`${meses[data.getMonth()]}/${data.getFullYear()}`);

      // Resetar estados ao abrir
      setStep("selecao");
      setIsCreatingObra(false);
      setNewObraName("");
    }
  }, [open]);

  useEffect(() => {
    if (selectedEmpresa) {
      setLoading(true); // Feedback visual rápido
      supabase
        .from("obras")
        .select("id, nome")
        .eq("empresa_id", selectedEmpresa)
        .eq("status", "ativa")
        .order("nome")
        .then(({ data }) => {
          setObras(data || []);
          setSelectedObra(""); // Limpa seleção anterior
          setLoading(false);
        });
    } else {
      setObras([]);
    }
  }, [selectedEmpresa]);

  // Modificado: Agora aceita o nome como parâmetro
  const createObraMutation = useMutation({
    mutationFn: async (nomeDaObra: string) => {
      if (!nomeDaObra.trim()) throw new Error("Nome da obra é obrigatório.");

      const { data, error } = await supabase
        .from("obras")
        .insert({
          nome: nomeDaObra,
          empresa_id: selectedEmpresa,
          status: "ativa",
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") throw new Error("Já existe uma obra com este nome nesta empresa.");
        throw error;
      }
      return data;
    },
    onSuccess: (newObra) => {
      toast.success(`Obra "${newObra.nome}" criada!`);
      setObras((prev) => [...prev, newObra]);
      setSelectedObra(newObra.id);
      setIsCreatingObra(false);
      setNewObraName("");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);

      let targetSheetName = "";
      let jsonData: any[][] = [];

      // Procura inteligente da aba correta
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName