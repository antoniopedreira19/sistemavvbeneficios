// ... imports

  // Mutation para reenviar para análise
  const reenviarMutation = useMutation({
    mutationFn: async () => {
      if (!reprovados || reprovados.length === 0) {
        throw new Error("Nenhum colaborador para reenviar");
      }

      // Calcular próxima tentativa
      const maxTentativa = Math.max(...reprovados.map(r => r.tentativa_reenvio));
      const novaTentativa = maxTentativa + 1;

      // 1. Atualiza os ITENS (Colaboradores)
      const { error: updateError } = await supabase
        .from("colaboradores_lote")
        .update({
          status_seguradora: "enviado",
          tentativa_reenvio: novaTentativa,
          data_tentativa: new Date().toISOString(),
          motivo_reprovacao_seguradora: null,
          updated_at: new Date().toISOString(),
        })
        .eq("lote_id", loteId)
        .eq("status_seguradora", "reprovado");

      if (updateError) throw updateError;

      // 2. Atualiza o LOTE para o NOVO STATUS DE FLUXO
      const { error: loteError } = await supabase
        .from("lotes_mensais")
        .update({
          // CRÍTICO: Manda para 'aguardando_reanalise' em vez de 'aguardando_processamento'
          status: "aguardando_reanalise", 
          updated_at: new Date().toISOString(),
        })
        .eq("id", loteId);

      if (loteError) throw loteError;

      return { totalReenviados: reprovados.length };
    },
    // ... resto do código (onSuccess, etc) permanece igual