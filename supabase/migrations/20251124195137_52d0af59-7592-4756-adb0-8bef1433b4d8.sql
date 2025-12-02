-- Corrigir cálculo do valor_total: total_aprovados * valor do plano
CREATE OR REPLACE FUNCTION public.atualizar_totais_ao_concluir_lote()
RETURNS TRIGGER AS $$
DECLARE
  v_total_aprovados INTEGER;
  v_valor_plano NUMERIC;
  v_valor_total NUMERIC;
BEGIN
  IF NEW.status = 'concluido' AND (OLD.status IS NULL OR OLD.status != 'concluido') THEN
    
    -- Conta TODOS os colaboradores aprovados em TODAS as tentativas
    SELECT COUNT(*) INTO v_total_aprovados
    FROM colaboradores_lote
    WHERE lote_id = NEW.id
      AND status_seguradora = 'aprovado';
    
    -- Busca o valor unitário do plano para este lote
    SELECT COALESCE(valor, 0) INTO v_valor_plano
    FROM precos_planos
    WHERE lote_id = NEW.id
    LIMIT 1;
    
    -- Calcula valor total: total_aprovados * valor_plano
    v_valor_total := v_total_aprovados * v_valor_plano;
    
    -- Se não houver preço cadastrado, mantém o valor atual
    IF v_valor_plano = 0 THEN
      v_valor_total := COALESCE(NEW.valor_total, 0);
    END IF;
    
    -- Atualiza o lote com os totais acumulados
    UPDATE lotes_mensais
    SET 
      total_aprovados = v_total_aprovados,
      valor_total = v_valor_total
    WHERE id = NEW.id;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;