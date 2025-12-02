import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface EmpresaCompetencia {
  empresa_id: string;
  empresa_nome: string;
  competencias: Record<string, boolean>; // competencia -> nf_emitida
}

export default function VisaoGeral() {
  const [data, setData] = useState<EmpresaCompetencia[]>([]);
  const [loading, setLoading] = useState(true);

  // Generate competencies from dez/25 to current month
  const competencias = useMemo(() => {
    const result: string[] = [];
    const startDate = new Date(2025, 11, 1); // December 2025
    const now = new Date();
    const currentDate = new Date(now.getFullYear(), now.getMonth(), 1);
    
    let date = new Date(startDate);
    while (date <= currentDate) {
      const month = date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
      const year = date.getFullYear().toString().slice(-2);
      result.push(`${month}/${year}`);
      date.setMonth(date.getMonth() + 1);
    }
    
    return result;
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch all notas_fiscais with empresa info
      const { data: notasFiscais, error } = await supabase
        .from('notas_fiscais')
        .select(`
          empresa_id,
          competencia,
          nf_emitida,
          empresas (
            id,
            nome
          )
        `)
        .eq('nf_emitida', true);

      if (error) throw error;

      // Group by empresa
      const empresaMap = new Map<string, EmpresaCompetencia>();

      notasFiscais?.forEach((nf) => {
        const empresaId = nf.empresa_id;
        const empresaNome = (nf.empresas as any)?.nome || 'Empresa';
        
        if (!empresaMap.has(empresaId)) {
          empresaMap.set(empresaId, {
            empresa_id: empresaId,
            empresa_nome: empresaNome,
            competencias: {}
          });
        }

        const empresa = empresaMap.get(empresaId)!;
        empresa.competencias[nf.competencia] = nf.nf_emitida;
      });

      setData(Array.from(empresaMap.values()).sort((a, b) => 
        a.empresa_nome.localeCompare(b.empresa_nome)
      ));
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Visão Geral</h1>
        <p className="text-muted-foreground">
          Acompanhe as notas fiscais emitidas por empresa e competência
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Empresas x Competências</CardTitle>
          <CardDescription>
            ✅ indica que a nota fiscal foi emitida para aquela competência
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold min-w-[200px] sticky left-0 bg-card z-10">
                    Empresa
                  </TableHead>
                  {competencias.map((comp) => (
                    <TableHead key={comp} className="font-semibold text-center min-w-[80px]">
                      {comp}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.length === 0 ? (
                  <TableRow>
                    <TableCell 
                      colSpan={competencias.length + 1} 
                      className="text-center py-8 text-muted-foreground"
                    >
                      Nenhuma nota fiscal emitida encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((empresa) => (
                    <TableRow key={empresa.empresa_id}>
                      <TableCell className="font-medium sticky left-0 bg-card z-10">
                        {empresa.empresa_nome}
                      </TableCell>
                      {competencias.map((comp) => (
                        <TableCell key={comp} className="text-center">
                          {empresa.competencias[comp] && (
                            <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
