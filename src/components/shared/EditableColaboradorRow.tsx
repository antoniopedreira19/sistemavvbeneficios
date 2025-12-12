import { useState } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Check, X } from "lucide-react";
import { validateCPF, formatCPF } from "@/lib/validators";

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
  showSalary?: boolean;
  compact?: boolean;
}

export function EditableColaboradorRow({
  colaborador,
  onSave,
  showSalary = true,
  compact = false,
}: EditableColaboradorRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    nome: colaborador.nome,
    cpf: colaborador.cpf,
    sexo: colaborador.sexo,
    data_nascimento: colaborador.data_nascimento,
    salario: colaborador.salario,
  });
  const [editErrors, setEditErrors] = useState<string[]>([]);

  const isError = colaborador.status === "erro";

  const validateAndSave = () => {
    const errors: string[] = [];
    
    if (!editData.nome.trim()) {
      errors.push("Nome obrigatório");
    }
    
    const cpfLimpo = editData.cpf.replace(/\D/g, "").padStart(11, "0");
    if (cpfLimpo.length !== 11 || !validateCPF(cpfLimpo)) {
      errors.push("CPF inválido");
    }
    
    // Validate date format YYYY-MM-DD
    const dateMatch = editData.data_nascimento.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dateMatch) {
      errors.push("Data inválida (use AAAA-MM-DD)");
    } else {
      const year = parseInt(dateMatch[1]);
      const month = parseInt(dateMatch[2]);
      const day = parseInt(dateMatch[3]);
      if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
        errors.push("Data fora do intervalo válido");
      }
    }

    if (errors.length > 0) {
      setEditErrors(errors);
      return;
    }

    onSave({
      nome: editData.nome.toUpperCase().trim(),
      cpf: cpfLimpo,
      sexo: editData.sexo,
      data_nascimento: editData.data_nascimento,
      salario: editData.salario,
    });
    setIsEditing(false);
    setEditErrors([]);
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
    setEditErrors([]);
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
      <TableRow className="bg-blue-50/50">
        <TableCell className="text-xs text-muted-foreground">{colaborador.linha}</TableCell>
        <TableCell>
          <Badge variant="outline" className="bg-blue-100 text-blue-700 text-[10px]">
            Editando
          </Badge>
        </TableCell>
        <TableCell>
          <Input
            value={editData.nome}
            onChange={(e) => setEditData({ ...editData, nome: e.target.value })}
            className="h-7 text-xs"
            placeholder="Nome completo"
          />
        </TableCell>
        <TableCell>
          <Input
            value={editData.cpf}
            onChange={(e) => setEditData({ ...editData, cpf: e.target.value.replace(/\D/g, "").slice(0, 11) })}
            className="h-7 text-xs font-mono w-28"
            placeholder="00000000000"
            maxLength={11}
          />
        </TableCell>
        <TableCell>
          <Select value={editData.sexo} onValueChange={(v) => setEditData({ ...editData, sexo: v })}>
            <SelectTrigger className="h-7 text-xs w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Masculino">Masculino</SelectItem>
              <SelectItem value="Feminino">Feminino</SelectItem>
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          <Input
            type="date"
            value={editData.data_nascimento}
            onChange={(e) => setEditData({ ...editData, data_nascimento: e.target.value })}
            className="h-7 text-xs w-32"
          />
        </TableCell>
        {showSalary && (
          <TableCell>
            <Input
              type="number"
              value={editData.salario}
              onChange={(e) => setEditData({ ...editData, salario: parseFloat(e.target.value) || 0 })}
              className="h-7 text-xs w-24"
              step="0.01"
            />
          </TableCell>
        )}
        <TableCell>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={validateAndSave}>
              <Check className="h-3 w-3 text-green-600" />
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancelEdit}>
              <X className="h-3 w-3 text-red-600" />
            </Button>
          </div>
          {editErrors.length > 0 && (
            <div className="text-[10px] text-red-500 mt-1">
              {editErrors.join(", ")}
            </div>
          )}
        </TableCell>
      </TableRow>
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
      <TableCell className={`font-medium text-xs truncate max-w-[150px] ${compact ? "" : ""}`} title={colaborador.nome}>
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
        <div className="flex items-center gap-2">
          {isError && (
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 hover:bg-blue-100"
              onClick={() => setIsEditing(true)}
              title="Editar para corrigir"
            >
              <Pencil className="h-3 w-3 text-blue-600" />
            </Button>
          )}
          {colaborador.erros && colaborador.erros.length > 0 && (
            <span className="text-[10px] text-red-600 font-medium">
              {colaborador.erros.join(", ")}
            </span>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
