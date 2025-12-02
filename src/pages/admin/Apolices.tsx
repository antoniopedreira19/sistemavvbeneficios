import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface Apolice {
  id: string;
  empresa_id: string;
  lote_id: string;
  adendo_assinado: boolean;
  codigo_enviado: boolean;
  boas_vindas_enviado: boolean;
  numero_vidas_enviado: number;
  numero_vidas_adendo: number;
  numero_vidas_vitalmed: number;
  empresas: {
    nome: string;
    cnpj: string;
  };
  lotes_mensais?: {
    competencia: string;
  };
}

const Apolices = () => {
  const [apolices, setApolices] = useState<Apolice[]>([]);
  const [loading, setLoading] = useState(true);
  const [mesFilter, setMesFilter] = useState<string>("todos");
  const { toast } = useToast();

  const fetchApolices = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("apolices")
        .select(`
          *,
          empresas!inner(nome, cnpj, status),
          lotes_mensais!inner(competencia)
        `)
        .eq("empresas.status", "em_implementacao")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setApolices(data || []);
    } catch (error) {
      console.error("Erro ao carregar apólices:", error);
      toast({
        variant: "destructive",
        title: "Erro ao carregar apólices",
        description: "Não foi possível carregar a lista de apólices.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApolices();
  }, []);

  const updateField = async (id: string, field: string, value: boolean | number) => {
    try {
      const { error } = await supabase
        .from("apolices")
        .update({ [field]: value })
        .eq("id", id);

      if (error) throw error;

      setApolices((prev) =>
        prev.map((apolice) =>
          apolice.id === id ? { ...apolice, [field]: value } : apolice
        )
      );

      toast({
        title: "Atualizado com sucesso",
        description: "As informações da apólice foram atualizadas.",
      });
    } catch (error) {
      console.error("Erro ao atualizar:", error);
      toast({
        variant: "destructive",
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar as informações.",
      });
    }
  };

  const getStatusVidas = (enviado: number, adendo: number, vitalmed: number) => {
    if (enviado === adendo && adendo === vitalmed && enviado > 0) {
      return <Badge className="bg-green-500">Ok</Badge>;
    }
    return <Badge variant="destructive">Divergente</Badge>;
  };

  const competenciasList = useMemo(() => {
    const competencias = Array.from(new Set(apolices.map(a => a.lotes_mensais?.competencia).filter(Boolean)));
    return competencias.sort().reverse();
  }, [apolices]);

  const filteredApolices = useMemo(() => {
    if (mesFilter === "todos") return apolices;
    return apolices.filter(a => a.lotes_mensais?.competencia === mesFilter);
  }, [apolices, mesFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Apólices</h1>
        <p className="text-muted-foreground">
          Gerenciamento de empresas em implementação com lotes concluídos
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Empresas em Implementação</CardTitle>
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
          {filteredApolices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma empresa com lote concluído encontrada.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Competência</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Adendo Assinado</TableHead>
                    <TableHead>Código Enviado</TableHead>
                    <TableHead>Boas Vindas Enviado</TableHead>
                    <TableHead>N° Vidas Enviado</TableHead>
                    <TableHead>N° Vidas Adendo</TableHead>
                    <TableHead>N° Vidas Vitalmed</TableHead>
                    <TableHead>Status Vidas</TableHead>
                  </TableRow>
              </TableHeader>
              <TableBody>
                {filteredApolices.map((apolice) => (
                    <TableRow key={apolice.id}>
                      <TableCell>
                        {apolice.lotes_mensais?.competencia || "-"}
                      </TableCell>
                      <TableCell className="font-medium">
                        {apolice.empresas.nome}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={apolice.adendo_assinado ? "sim" : "nao"}
                          onValueChange={(value) =>
                            updateField(apolice.id, "adendo_assinado", value === "sim")
                          }
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sim">Sim</SelectItem>
                            <SelectItem value="nao">Não</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={apolice.codigo_enviado ? "sim" : "nao"}
                          onValueChange={(value) =>
                            updateField(apolice.id, "codigo_enviado", value === "sim")
                          }
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sim">Sim</SelectItem>
                            <SelectItem value="nao">Não</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={apolice.boas_vindas_enviado ? "sim" : "nao"}
                          onValueChange={(value) =>
                            updateField(apolice.id, "boas_vindas_enviado", value === "sim")
                          }
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sim">Sim</SelectItem>
                            <SelectItem value="nao">Não</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          className="w-24"
                          value={apolice.numero_vidas_enviado}
                          onChange={(e) =>
                            updateField(
                              apolice.id,
                              "numero_vidas_enviado",
                              parseInt(e.target.value) || 0
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          className="w-24"
                          value={apolice.numero_vidas_adendo}
                          onChange={(e) =>
                            updateField(
                              apolice.id,
                              "numero_vidas_adendo",
                              parseInt(e.target.value) || 0
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          className="w-24"
                          value={apolice.numero_vidas_vitalmed}
                          onChange={(e) =>
                            updateField(
                              apolice.id,
                              "numero_vidas_vitalmed",
                              parseInt(e.target.value) || 0
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        {getStatusVidas(
                          apolice.numero_vidas_enviado,
                          apolice.numero_vidas_adendo,
                          apolice.numero_vidas_vitalmed
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Apolices;
