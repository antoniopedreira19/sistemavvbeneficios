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
  snapshotCriados: number;
}

export function useImportarColaboradores() {
  const [importing, setImporting] = useState(false);

  /**
   * LÓGICA DE SNAPSHOT MENSAL:
   * 1. Upsert na tabela mestra (colaboradores) - atualiza ou cria
   * 2. Marca como desligado quem NÃO está na lista atual
   * 3. Cria snapshot em colaboradores_lote para histórico
   */
  const saveImportedColaboradores = async (
    colaboradores: ColaboradorImport[],
    empresaId: string,
    obraId: string,
    loteId: string
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
      const colaboradoresParaSnapshot: { colaborador_id: string; colaborador: ColaboradorImport }[] = [];

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
          
          colaboradoresParaSnapshot.push({ 
            colaborador_id: existente.id, 
            colaborador: colab 
          });
          atualizados++;
        } else {
          // Criar novo colaborador
          const { data: novoColab, error: insertError } = await supabase
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
            })
            .select("id")
            .single();

          if (insertError) throw insertError;
          
          colaboradoresParaSnapshot.push({ 
            colaborador_id: novoColab.id, 
            colaborador: colab 
          });
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

      // 4. SNAPSHOT: Criar registros em colaboradores_lote
      const snapshotData = colaboradoresParaSnapshot.map(({ colaborador_id, colaborador }) => ({
        lote_id: loteId,
        colaborador_id,
        cpf: colaborador.cpf,
        nome: colaborador.nome,
        sexo: colaborador.sexo,
        data_nascimento: colaborador.data_nascimento,
        salario: colaborador.salario,
        classificacao_salario: colaborador.classificacao_salario,
        status_seguradora: "pendente",
        tentativa_reenvio: 1,
      }));

      if (snapshotData.length > 0) {
        const { error: snapshotError } = await supabase
          .from("colaboradores_lote")
          .insert(snapshotData);

        if (snapshotError) throw snapshotError;
      }

      // 5. Atualizar totais do lote
      const { error: updateLoteError } = await supabase
        .from("lotes_mensais")
        .update({
          total_colaboradores: colaboradores.length,
          total_novos: novos,
          total_alterados: atualizados,
          total_desligados: desligados,
          status: "aguardando_processamento",
          updated_at: new Date().toISOString(),
        })
        .eq("id", loteId);

      if (updateLoteError) throw updateLoteError;

      return {
        novos,
        atualizados,
        desligados,
        snapshotCriados: snapshotData.length,
      };
    } catch (error) {
      console.error("Erro ao importar colaboradores:", error);
      throw error;
    } finally {
      setImporting(false);
    }
  };

  /**
   * REPETIR MÊS ANTERIOR:
   * Copia os colaboradores do último lote concluído para o lote atual
   */
  const repetirMesAnterior = async (
    empresaId: string,
    obraId: string,
    loteIdAtual: string
  ): Promise<ImportResult | null> => {
    setImporting(true);

    try {
      // 1. Buscar o último lote concluído desta obra
      const { data: ultimoLote, error: loteError } = await supabase
        .from("lotes_mensais")
        .select("id")
        .eq("empresa_id", empresaId)
        .eq("obra_id", obraId)
        .in("status", ["concluido", "faturado"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (loteError) throw loteError;

      if (!ultimoLote) {
        toast.error("Nenhum lote anterior encontrado para copiar");
        return null;
      }

      // 2. Buscar colaboradores do lote anterior
      const { data: colaboradoresLoteAnterior, error: colabError } = await supabase
        .from("colaboradores_lote")
        .select("*")
        .eq("lote_id", ultimoLote.id);

      if (colabError) throw colabError;

      if (!colaboradoresLoteAnterior || colaboradoresLoteAnterior.length === 0) {
        toast.error("Nenhum colaborador encontrado no lote anterior");
        return null;
      }

      // 3. Copiar para o lote atual (sem alterações = mesmos dados)
      const snapshotData = colaboradoresLoteAnterior.map(colab => ({
        lote_id: loteIdAtual,
        colaborador_id: colab.colaborador_id,
        cpf: colab.cpf,
        nome: colab.nome,
        sexo: colab.sexo,
        data_nascimento: colab.data_nascimento,
        salario: colab.salario,
        classificacao_salario: colab.classificacao_salario,
        classificacao: colab.classificacao,
        status_seguradora: "pendente",
        tentativa_reenvio: 1,
      }));

      const { error: insertError } = await supabase
        .from("colaboradores_lote")
        .insert(snapshotData);

      if (insertError) throw insertError;

      // 4. Atualizar totais do lote
      const { error: updateLoteError } = await supabase
        .from("lotes_mensais")
        .update({
          total_colaboradores: snapshotData.length,
          total_novos: 0,
          total_alterados: 0,
          total_desligados: 0,
          status: "aguardando_processamento",
          updated_at: new Date().toISOString(),
        })
        .eq("id", loteIdAtual);

      if (updateLoteError) throw updateLoteError;

      return {
        novos: 0,
        atualizados: snapshotData.length,
        desligados: 0,
        snapshotCriados: snapshotData.length,
      };
    } catch (error) {
      console.error("Erro ao repetir mês anterior:", error);
      throw error;
    } finally {
      setImporting(false);
    }
  };

  /**
   * Cria um novo lote para a competência atual se não existir
   */
  const criarOuBuscarLote = async (
    empresaId: string,
    obraId: string,
    competencia: string
  ): Promise<string | null> => {
    try {
      // Verificar se já existe lote para esta competência
      const { data: loteExistente, error: fetchError } = await supabase
        .from("lotes_mensais")
        .select("id")
        .eq("empresa_id", empresaId)
        .eq("obra_id", obraId)
        .eq("competencia", competencia)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (loteExistente) {
        return loteExistente.id;
      }

      // Criar novo lote
      const { data: novoLote, error: insertError } = await supabase
        .from("lotes_mensais")
        .insert({
          empresa_id: empresaId,
          obra_id: obraId,
          competencia,
          status: "rascunho",
          total_colaboradores: 0,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      return novoLote.id;
    } catch (error) {
      console.error("Erro ao criar/buscar lote:", error);
      throw error;
    }
  };

  return {
    importing,
    saveImportedColaboradores,
    repetirMesAnterior,
    criarOuBuscarLote,
  };
}
