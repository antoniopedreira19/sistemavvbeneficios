-- Corrigir função para manter total_colaboradores constante
CREATE OR REPLACE FUNCTION public.atualizar_totais_lote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_colaboradores INTEGER;
  v_total_aprovados INTEGER;
  v_total_reprovados INTEGER;
  v_valor_plano NUMERIC;
  v_valor_total NUMERIC;
BEGIN
  -- Conta TODOS os CPFs distintos no lote (independente de status)
  -- Isso garante que o total de colaboradores não mude
  SELECT COUNT(DISTINCT cpf) INTO v_total_colaboradores
  FROM colaboradores_lote
  WHERE lote_id = COALESCE(NEW.lote_id, OLD.lote_id);
  
  -- Conta aprovados
  SELECT COUNT(*) INTO v_total_aprovados
  FROM colaboradores_lote
  WHERE lote_id = COALESCE(NEW.lote_id, OLD.lote_id)
    AND status_seguradora = 'aprovado';
  
  -- Conta reprovados
  SELECT COUNT(*) INTO v_total_reprovados
  FROM colaboradores_lote
  WHERE lote_id = COALESCE(NEW.lote_id, OLD.lote_id)
    AND status_seguradora = 'reprovado';
  
  -- Busca o valor do plano
  SELECT COALESCE(valor, 0) INTO v_valor_plano
  FROM precos_planos
  WHERE lote_id = COALESCE(NEW.lote_id, OLD.lote_id)
  LIMIT 1;
  
  -- Calcula o valor total: total_aprovados * valor_plano
  v_valor_total := v_total_aprovados * v_valor_plano;
  
  -- Atualiza o lote mantendo total_colaboradores constante
  UPDATE lotes_mensais
  SET 
    total_aprovados = v_total_aprovados,
    total_reprovados = v_total_reprovados,
    valor_total = v_valor_total,
    updated_at = now()
  WHERE id = COALESCE(NEW.lote_id, OLD.lote_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Corrigir os valores atuais no banco
UPDATE lotes_mensais lm
SET 
  total_colaboradores = (
    SELECT COUNT(DISTINCT cpf)
    FROM colaboradores_lote cl
    WHERE cl.lote_id = lm.id
  ),
  total_aprovados = (
    SELECT COUNT(*)
    FROM colaboradores_lote cl
    WHERE cl.lote_id = lm.id
      AND cl.status_seguradora = 'aprovado'
  ),
  total_reprovados = (
    SELECT COUNT(*)
    FROM colaboradores_lote cl
    WHERE cl.lote_id = lm.id
      AND cl.status_seguradora = 'reprovado'
  ),
  valor_total = (
    SELECT 
      COALESCE(
        (SELECT COUNT(*) 
         FROM colaboradores_lote cl 
         WHERE cl.lote_id = lm.id 
           AND cl.status_seguradora = 'aprovado'
        ) * 
        (SELECT COALESCE(pp.valor, 0) 
         FROM precos_planos pp 
         WHERE pp.lote_id = lm.id 
         LIMIT 1
        ),
        0
      )
  );