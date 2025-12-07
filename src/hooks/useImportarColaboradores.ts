import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
   * ATUALIZAR COLABORADORES EM LOTE (BATCH):
   * Reduz drasticamente o tempo de processamento enviando blocos de 1000 registros.
   */
  const atualizarColaboradores = async (
    colaboradores: ColaboradorImport[],
    empresaId: string,
    obraId: string,
  ): Promise<ImportResult | null> => {
    setImporting(true);

    try {
      const cpfsNaLista = new Set(colaboradores.map((c) => c.cpf));

      // 1. Buscar TODOS os colaboradores ativos atuais para comparar
      // Nota: Se a base for gigantesca (+50k), precisaria paginar, mas para importação mensal é ok.
      const { data: colaboradoresAtuais, error: fetchError } = await supabase
        .from("colaboradores")
        .select("id, cpf")
        .eq("empresa_id", empresaId)
        .eq("obra_id", obraId)
        .eq("status", "ativo");

      if (fetchError) throw fetchError;

      const colaboradoresMap = new Map((colaboradoresAtuais || []).map((c) => [c.cpf, c]));

      // 2. Preparar os dados para UPSERT (Inserir ou Atualizar)
      const upsertData: any[] = [];
      let novos = 0;
      let atualizados = 0;

      for (const colab of colaboradores) {
        const existente = colaboradoresMap.get(colab.cpf);

        const dadosBase = {
          nome: colab.nome,
          sexo: colab.sexo,
          cpf: colab.cpf, // Necessário para insert
          data_nascimento: colab.data_nascimento,
          salario: colab.salario,
          classificacao_salario: colab.classificacao_salario,
          classificacao: "CLT",
          aposentado: false,
          afastado: false,
          empresa_id: empresaId,
          obra_id: obraId,
          status: "ativo",
          updated_at: new Date().toISOString(),
        };

        if (existente) {
          // Se existe, adicionamos o ID para que o Supabase entenda que é um UPDATE
          upsertData.push({ ...dadosBase, id: existente.id });
          atualizados++;
        } else {
          // Se não existe, vai sem ID (o banco gera) -> INSERT
          upsertData.push(dadosBase);
          novos++;
        }
      }

      // 3. Executar UPSERT em blocos (Chunks) de 1000 para não estourar o limite de payload
      const chunkSize = 1000;
      for (let i = 0; i < upsertData.length; i += chunkSize) {
        const chunk = upsertData.slice(i, i + chunkSize);

        const { error: upsertError } = await supabase.from("colaboradores").upsert(chunk); // Upsert lida com Insert e Update numa tacada só

        if (upsertError) throw upsertError;
      }

      // 4. DESLIGAMENTOS: Marcar quem não veio na lista
      const idsParaDesligar = (colaboradoresAtuais || []).filter((c) => !cpfsNaLista.has(c.cpf)).map((c) => c.id);

      let desligados = 0;
      if (idsParaDesligar.length > 0) {
        // Também fazer em lotes se forem muitos desligamentos
        for (let i = 0; i < idsParaDesligar.length; i += chunkSize) {
          const chunkIds = idsParaDesligar.slice(i, i + chunkSize);
          const { error: desligarError } = await supabase
            .from("colaboradores")
            .update({
              status: "desligado",
              updated_at: new Date().toISOString(),
            })
            .in("id", chunkIds);

          if (desligarError) throw desligarError;
        }
        desligados = idsParaDesligar.length;
      }

      return { novos, atualizados, desligados };
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
