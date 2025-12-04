import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ColaboradorImport {
  nome: string;
  sexo: string;
  cpf: string;
  data_nascimento: string;
  salario: number;
  classificacao_salario: string;
}

interface ImportResult {
  novos: number;
  atualizados: number;
  desligados: number;
}

export function useImportarColaboradores() {
  const [importing, setImporting] = useState(false);

  /**
   * ATUALIZAR COLABORADORES (SEM CRIAR LOTE):
   * Apenas atualiza a tabela mestra de colaboradores
   * 1. Upsert na tabela mestra (colaboradores) - atualiza ou cria
   * 2. Marca como desligado quem NÃO está na lista atual
   * 
   * NÃO cria lote, NÃO cria snapshots - isso é feito no Painel ao enviar
   */
  const atualizarColaboradores = async (
    colaboradores: ColaboradorImport[],
    empresaId: string,
    obraId: string
  ): Promise<ImportResult | null> => {
    setImporting(true);
    
    try {
      const cpfsNaLista = new Set(colaboradores.map(c => c.cpf));
      
      // 1. Buscar colaboradores ATIVOS atuais desta obra
      const { data: colaboradoresAtuais, error: fetchError } = await supabase
        .from("colaboradores")
        .select("id, cpf, nome, sexo, data_nascimento, salario, classificacao_salario")
        .eq("empresa_id", empresaId)
        .eq("obra_id", obraId)
        .eq("status", "ativo");

      if (fetchError) throw fetchError;

      const colaboradoresMap = new Map(
        (colaboradoresAtuais || []).map(c => [c.cpf, c])
      );

      let novos = 0;
      let atualizados = 0;

      // 2. UPSERT: Para cada colaborador na lista
      for (const colab of colaboradores) {
        const existente = colaboradoresMap.get(colab.cpf);

        if (existente) {
          // Atualizar colaborador existente
          const { error: updateError } = await supabase
            .from("colaboradores")
            .update({
              nome: colab.nome,
              sexo: colab.sexo,
              data_nascimento: colab.data_nascimento,
              salario: colab.salario,
              classificacao_salario: colab.classificacao_salario,
              status: "ativo", // Garantir que está ativo
              updated_at: new Date().toISOString(),
            })
            .eq("id", existente.id);

          if (updateError) throw updateError;
          atualizados++;
        } else {
          // Criar novo colaborador
          const { error: insertError } = await supabase
            .from("colaboradores")
            .insert({
              nome: colab.nome,
              sexo: colab.sexo,
              cpf: colab.cpf,
              data_nascimento: colab.data_nascimento,
              salario: colab.salario,
              classificacao_salario: colab.classificacao_salario,
              classificacao: "CLT",
              aposentado: false,
              afastado: false,
              empresa_id: empresaId,
              obra_id: obraId,
              status: "ativo",
            });

          if (insertError) throw insertError;
          novos++;
        }
      }

      // 3. DESLIGAMENTOS: Marcar como desligado quem NÃO está na lista
      const cpfsParaDesligar = (colaboradoresAtuais || [])
        .filter(c => !cpfsNaLista.has(c.cpf))
        .map(c => c.id);

      let desligados = 0;
      if (cpfsParaDesligar.length > 0) {
        const { error: desligarError } = await supabase
          .from("colaboradores")
          .update({ 
            status: "desligado",
            updated_at: new Date().toISOString() 
          })
          .in("id", cpfsParaDesligar);

        if (desligarError) throw desligarError;
        desligados = cpfsParaDesligar.length;
      }

      return {
        novos,
        atualizados,
        desligados,
      };
    } catch (error) {
      console.error("Erro ao atualizar colaboradores:", error);
      throw error;
    } finally {
      setImporting(false);
    }
  };

  return {
    importing,
    atualizarColaboradores,
  };
}
