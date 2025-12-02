-- Atualizar função para contar TODAS as aprovações acumuladas, não apenas da última tentativa
CREATE OR REPLACE FUNCTION public.atualizar_totais_ao_concluir_lote()
RETURNS TRIGGER AS $$
DECLARE
  v_total_aprovados INTEGER;
  v_valor_total NUMERIC;
BEGIN
  IF NEW.status = 'concluido' AND (OLD.status IS NULL OR OLD.status != 'concluido') THEN
    
    -- Conta TODOS os colaboradores aprovados em TODAS as tentativas
    SELECT COUNT(*) INTO v_total_aprovados
    FROM colaboradores_lote
    WHERE lote_id = NEW.id
      AND status_seguradora = 'aprovado';
    
    -- Calcula valor total baseado nos preços dos planos
    -- Também considera TODOS os aprovados, não apenas a última tentativa
    SELECT COALESCE(SUM(pp.valor), 0) INTO v_valor_total
    FROM colaboradores_lote cl
    LEFT JOIN precos_planos pp ON pp.lote_id = NEW.id
    WHERE cl.lote_id = NEW.id
      AND cl.status_seguradora = 'aprovado';
    
    IF v_valor_total = 0 THEN
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