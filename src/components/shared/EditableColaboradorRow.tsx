import { useState, useEffect } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Check, X, Trash2, AlertCircle, CheckCircle } from "lucide-react";
import { validateCPF, formatCPF } from "@/lib/validators";
import { cn } from "@/lib/utils";

interface EditableColaboradorRowProps {
  colaborador: {
    linha: number;
    nome: string;
    cpf: string;
    sexo: string;
    data_nascimento: string;
    salario: number;
    status: string;
    erros?: string[];
  };
  onSave: (updatedData: {
    nome: string;
    cpf: string;
    sexo: string;
    data_nascimento: string;
    salario: number;
  }) => void;
  onDelete?: (linha: number) => void;
  showSalary?: boolean;
}

interface FieldValidation {
  nome: { valid: boolean; message?: string };
  cpf: { valid: boolean; message?: string };
  data_nascimento: { valid: boolean; message?: string };
  salario: { valid: boolean; message?: string };
}

export function EditableColaboradorRow({
  colaborador,
  onSave,
  onDelete,
  showSalary = true,
}: EditableColaboradorRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    nome: colaborador.nome,
    cpf: colaborador.cpf,
    sexo: colaborador.sexo,
    data_nascimento: colaborador.data_nascimento,
    salario: colaborador.salario,
  });
  const [validation, setValidation] = useState<FieldValidation>({
    nome: { valid: true },
    cpf: { valid: true },
    data_nascimento: { valid: true },
    salario: { valid: true },
  });

  const isError = colaborador.status === "erro";

  // Validate in real-time
  useEffect(() => {
    if (!isEditing) return;

    const newValidation: FieldValidation = {
      nome: { valid: true },
      cpf: { valid: true },
      data_nascimento: { valid: true },
      salario: { valid: true },
    };

    // Validate nome
    if (!editData.nome.trim()) {
      newValidation.nome = { valid: false, message: "Nome obrigatório" };
    }

    // Validate CPF
    const cpfLimpo = editData.cpf.replace(/\D/g, "").padStart(11, "0");
    if (cpfLimpo.length !== 11) {
      newValidation.cpf = { valid: false, message: "CPF deve ter 11 dígitos" };
    } else if (!validateCPF(cpfLimpo)) {
      newValidation.cpf = { valid: false, message: "CPF inválido" };
    }

    // Validate date
    const dateMatch = editData.data_nascimento.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dateMatch) {
      newValidation.data_nascimento = { valid: false, message: "Data inválida" };
    } else {
      const year = parseInt(dateMatch[1]);
      const month = parseInt(dateMatch[2]);
      const day = parseInt(dateMatch[3]);
      if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
        newValidation.data_nascimento = { valid: false, message: "Data fora do intervalo" };
      }
    }

    // Validate salary
    if (editData.salario <= 0) {
      newValidation.salario = { valid: false, message: "Salário inválido" };
    }

    setValidation(newValidation);
  }, [editData, isEditing]);

  const isFormValid = validation.nome.valid && validation.cpf.valid && validation.data_nascimento.valid && validation.salario.valid;

  const handleSave = () => {
    if (!isFormValid) return;

    const cpfLimpo = editData.cpf.replace(/\D/g, "").padStart(11, "0");
    onSave({
      nome: editData.nome.toUpperCase().trim(),
      cpf: cpfLimpo,
      sexo: editData.sexo,
      data_nascimento: editData.data_nascimento,
      salario: editData.salario,
    });
    setIsEditing(false);
  };

  const cancelEdit = () => {
    setEditData({
      nome: colaborador.nome,
      cpf: colaborador.cpf,
      sexo: colaborador.sexo,
      data_nascimento: colaborador.data_nascimento,
      salario: colaborador.salario,
    });
    setIsEditing(false);
  };

  // Format date for display: YYYY-MM-DD -> DD/MM/YYYY
  const formatDateDisplay = (date: string) => {
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }
    return date;
  };

  if (isEditing) {
    return (
      <>
        {/* Row principal de edição */}
        <TableRow className="bg-blue-50/80 border-blue-200">
          <TableCell className="text-xs text-muted-foreground font-semibold">{colaborador.linha}</TableCell>
          <TableCell>
            <Badge variant="outline" className="bg-blue-100 text-blue-700 text-[10px]">
              Editando
            </Badge>
          </TableCell>
          <TableCell>
            <div className="space-y-1">
              <Input
                value={editData.nome}
                onChange={(e) => setEditData({ ...editData, nome: e.target.value })}
                className={cn(
                  "h-8 text-xs",
                  !validation.nome.valid && "border-red-500 focus-visible:ring-red-500"
                )}
                placeholder="Nome completo"
              />
              {!validation.nome.valid && (
                <span className="text-[10px] text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {validation.nome.message}
                </span>
              )}
            </div>
          </TableCell>
          <TableCell>
            <div className="space-y-1">
              <Input
                value={editData.cpf}
                onChange={(e) => setEditData({ ...editData, cpf: e.target.value.replace(/\D/g, "").slice(0, 11) })}
                className={cn(
                  "h-8 text-xs font-mono w-28",
                  !validation.cpf.valid ? "border-red-500 focus-visible:ring-red-500" : validation.cpf.valid && editData.cpf.length === 11 && "border-green-500"
                )}
                placeholder="00000000000"
                maxLength={11}
              />
              {!validation.cpf.valid && (
                <span className="text-[10px] text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {validation.cpf.message}
                </span>
              )}
              {validation.cpf.valid && editData.cpf.length === 11 && (
                <span className="text-[10px] text-green-600 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" /> CPF válido
                </span>
              )}
            </div>
          </TableCell>
          <TableCell>
            <Select value={editData.sexo} onValueChange={(v) => setEditData({ ...editData, sexo: v })}>
              <SelectTrigger className="h-8 text-xs w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Masculino">Masculino</SelectItem>
                <SelectItem value="Feminino">Feminino</SelectItem>
              </SelectContent>
            </Select>
          </TableCell>
          <TableCell>
            <div className="space-y-1">
              <Input
                type="date"
                value={editData.data_nascimento}
                onChange={(e) => setEditData({ ...editData, data_nascimento: e.target.value })}
                className={cn(
                  "h-8 text-xs w-32",
                  !validation.data_nascimento.valid && "border-red-500 focus-visible:ring-red-500"
                )}
              />
              {!validation.data_nascimento.valid && (
                <span className="text-[10px] text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {validation.data_nascimento.message}
                </span>
              )}
            </div>
          </TableCell>
          {showSalary && (
            <TableCell>
              <div className="space-y-1">
                <Input
                  type="number"
                  value={editData.salario}
                  onChange={(e) => setEditData({ ...editData, salario: parseFloat(e.target.value) || 0 })}
                  className={cn(
                    "h-8 text-xs w-24",
                    !validation.salario.valid && "border-red-500 focus-visible:ring-red-500"
                  )}
                  step="0.01"
                />
              </div>
            </TableCell>
          )}
          <TableCell className="w-[140px]">
            {/* Botões inline pequenos */}
            <div className="flex gap-1">
              <Button
                size="sm"
                className={cn(
                  "h-7 px-2 text-xs gap-1",
                  isFormValid ? "bg-green-600 hover:bg-green-700" : "bg-gray-400 cursor-not-allowed"
                )}
                onClick={handleSave}
                disabled={!isFormValid}
              >
                <Check className="h-3 w-3" /> Salvar
              </Button>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={cancelEdit}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
        
        {/* Row de status/feedback */}
        <TableRow className="bg-blue-50/50 border-b-2 border-blue-200">
          <TableCell colSpan={showSalary ? 8 : 7} className="py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-xs">
                {isFormValid ? (
                  <span className="text-green-600 flex items-center gap-1 font-medium">
                    <CheckCircle className="h-4 w-4" /> Todos os campos estão válidos - pronto para salvar
                  </span>
                ) : (
                  <span className="text-amber-600 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" /> Corrija os campos marcados em vermelho
                  </span>
                )}
              </div>
              {onDelete && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 gap-1"
                  onClick={() => onDelete(colaborador.linha)}
                >
                  <Trash2 className="h-3 w-3" /> Excluir linha
                </Button>
              )}
            </div>
          </TableCell>
        </TableRow>
      </>
    );
  }

  return (
    <TableRow className={isError ? "bg-red-50/50" : ""}>
      <TableCell className="text-xs text-muted-foreground">{colaborador.linha}</TableCell>
      <TableCell>
        {colaborador.status === "valido" || colaborador.status === "novo" ? (
          <Badge className="bg-green-500 hover:bg-green-600 text-[10px]">
            {colaborador.status === "novo" ? "Novo" : "Válido"}
          </Badge>
        ) : colaborador.status === "atualizado" ? (
          <Badge variant="secondary" className="text-[10px]">Atualizado</Badge>
        ) : (
          <Badge variant="destructive" className="text-[10px]">Inválido</Badge>
        )}
      </TableCell>
      <TableCell className="font-medium text-xs truncate max-w-[150px]" title={colaborador.nome}>
        {colaborador.nome || <span className="text-red-400 italic">Vazio</span>}
      </TableCell>
      <TableCell className="font-mono text-xs">
        {colaborador.cpf && colaborador.cpf.length === 11 && validateCPF(colaborador.cpf)
          ? formatCPF(colaborador.cpf)
          : <span className="text-red-500">{colaborador.cpf || "Inválido"}</span>}
      </TableCell>
      <TableCell className="text-xs">{colaborador.sexo}</TableCell>
      <TableCell className="text-xs">{formatDateDisplay(colaborador.data_nascimento)}</TableCell>
      {showSalary && (
        <TableCell className="text-xs">
          {colaborador.salario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        </TableCell>
      )}
      <TableCell>
        <div className="flex items-center gap-1">
          {isError && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-xs gap-1 text-blue-600 border-blue-300 hover:bg-blue-50"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="h-3 w-3" /> Editar
              </Button>
              {onDelete && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={() => onDelete(colaborador.linha)}
                  title="Excluir"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </>
          )}
          {colaborador.erros && colaborador.erros.length > 0 && !isError && (
            <span className="text-[10px] text-red-600 font-medium">
              {colaborador.erros.join(", ")}
            </span>
          )}
          {isError && colaborador.erros && colaborador.erros.length > 0 && (
            <span className="text-[10px] text-red-600 ml-1">
              {colaborador.erros.join(", ")}
            </span>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
