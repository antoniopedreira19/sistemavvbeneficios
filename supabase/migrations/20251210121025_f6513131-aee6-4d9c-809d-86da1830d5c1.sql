-- Corrigir função para usar status válido do enum
-- O status 'em_implementacao' não existe, usar 'acolhimento' que representa empresas em implementação

CREATE OR REPLACE FUNCTION public.atualizar_totais_ao_concluir_lote()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total_aprovados INTEGER;
  v_valor_plano NUMERIC;
  v_valor_total NUMERIC;
  v_empresa_status empresa_status;
BEGIN
  -- Só executa quando o status muda para 'concluido'
  IF NEW.status = 'concluido' AND (OLD.status IS NULL OR OLD.status != 'concluido') THEN
    
    -- Conta TODOS os colaboradores aprovados em TODAS as tentativas deste lote
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
    v_valor_total := v_total_aprovados * COALESCE(v_valor_plano, 0);
    
    -- Se não houver preço cadastrado, usa o valor já calculado pelo frontend (R$50 fixo)
    IF v_valor_plano IS NULL OR v_valor_plano = 0 THEN
      v_valor_total := COALESCE(NEW.valor_total, v_total_aprovados * 50, 0);
    END IF;
    
    -- Atualiza os campos no registro NEW que será salvo
    NEW.total_aprovados := v_total_aprovados;
    NEW.valor_total := v_valor_total;
    NEW.updated_at := now();
    
    -- Busca status da empresa
    SELECT status INTO v_empresa_status
    FROM empresas
    WHERE id = NEW.empresa_id;
    
    -- Cria apólice se empresa está em acolhimento (implementação)
    IF v_empresa_status = 'acolhimento' THEN
      INSERT INTO apolices (
        empresa_id,
        lote_id,
        obra_id,
        numero_vidas_enviado,
        adendo_assinado,
        codigo_enviado,
        boas_vindas_enviado,
        numero_vidas_adendo,
        numero_vidas_vitalmed
      )
      VALUES (
        NEW.empresa_id,
        NEW.id,
        NEW.obra_id,
        v_total_aprovados,
        false,
        false,
        false,
        0,
        0
      )
      ON CONFLICT (empresa_id, lote_id) 
      DO UPDATE SET
        numero_vidas_enviado = v_total_aprovados,
        updated_at = now();
    
    -- Cria nota fiscal se empresa está ativa
    ELSIF v_empresa_status = 'ativa' THEN
      INSERT INTO notas_fiscais (
        empresa_id,
        lote_id,
        obra_id,
        competencia,
        numero_vidas,
        valor_total,
        nf_emitida
      )
      VALUES (
        NEW.empresa_id,
        NEW.id,
        NEW.obra_id,
        NEW.competencia,
        v_total_aprovados,
        COALESCE(v_valor_total, 0),
        false
      )
      ON CONFLICT (empresa_id, lote_id) 
      DO UPDATE SET
        numero_vidas = v_total_aprovados,
        valor_total = COALESCE(v_valor_total, 0),
        updated_at = now();
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$function$;