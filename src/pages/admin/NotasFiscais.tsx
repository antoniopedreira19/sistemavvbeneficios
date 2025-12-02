import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface NotaFiscal {
  id: string;
  empresa_id: string;
  lote_id: string;
  competencia: string;
  numero_vidas: number;
  valor_total: number;
  nf_emitida: boolean;
  empresas: {
    nome: string;
  } | null;
  lotes_mensais: {
    valor_total: number;
  } | null;
}

const NotasFiscais = () => {
  const [notasFiscais, setNotasFiscais] = useState<NotaFiscal[]>([]);
  const [loading, setLoading] = useState(true);
  const [mesFilter, setMesFilter] = useState<string>("todos");

  const fetchNotasFiscais = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("notas_fiscais")
        .select(`
          *,
          empresas(nome),
          lotes_mensais(valor_total)
        `)
        .order("competencia", { ascending: false });

      if (error) throw error;
      setNotasFiscais((data as any) || []);
    } catch (error: any) {
      console.error("Erro ao buscar notas fiscais:", error);
      toast.error("Erro ao carregar notas fiscais");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotasFiscais();
  }, []);

  const updateField = async (id: string, field: string, value: any) => {
    try {
      const { error } = await supabase
        .from("notas_fiscais")
        .update({ [field]: value })
        .eq("id", id);

      if (error) throw error;

      setNotasFiscais(prev =>
        prev.map(nf =>
          nf.id === id ? { ...nf, [field]: value } : nf
        )
      );

      toast.success("Campo atualizado com sucesso");
    } catch (error: any) {
      console.error("Erro ao atualizar campo:", error);
      toast.error("Erro ao atualizar campo");
    }
  };

  const competenciasList = useMemo(() => {
    const competencias = Array.from(new Set(notasFiscais.map(nf => nf.competencia)));
    return competencias.sort().reverse();
  }, [notasFiscais]);

  const filteredNotasFiscais = useMemo(() => {
    if (mesFilter === "todos") return notasFiscais;
    return notasFiscais.filter(nf => nf.competencia === mesFilter);
  }, [notasFiscais, mesFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Notas Fiscais</h1>
        <p className="text-muted-foreground">
          Gerenciamento de notas fiscais das empresas
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lista de Notas Fiscais</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Filtrar por mês:</span>
              <Select value={mesFilter} onValueChange={setMesFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {competenciasList.map(comp => (
                    <SelectItem key={comp} value={comp}>
                      {comp}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredNotasFiscais.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma nota fiscal encontrada.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Competência (Mês)</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>N° de Vidas</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>NF Emitida</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredNotasFiscais.map((nf) => {
                  // Usar o valor_total do lote se disponível, senão usar o da nota fiscal
                  const valorTotal = nf.lotes_mensais?.valor_total || nf.valor_total || 0;
                  
                  return (
                  <TableRow key={nf.id}>
                    <TableCell>{nf.competencia}</TableCell>
                    <TableCell>{nf.empresas?.nome || "Empresa não encontrada"}</TableCell>
                    <TableCell>{nf.numero_vidas}</TableCell>
                    <TableCell>
                      {valorTotal.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL'
                      })}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={nf.nf_emitida ? "sim" : "nao"}
                        onValueChange={(value) =>
                          updateField(nf.id, "nf_emitida", value === "sim")
                        }
                      >
                        <SelectTrigger className="w-[100px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sim">Sim</SelectItem>
                          <SelectItem value="nao">Não</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default NotasFiscais;
