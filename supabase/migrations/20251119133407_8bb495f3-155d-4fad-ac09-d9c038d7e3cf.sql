-- Atualizar a trigger de criação de nota fiscal para empresa ativa
CREATE OR REPLACE FUNCTION public.criar_nota_fiscal_empresa_ativa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa_status empresa_status;
  v_total_colaboradores_aprovados INTEGER;
BEGIN
  -- Verifica se o status mudou para 'concluido'
  IF NEW.status = 'concluido' AND (OLD.status IS NULL OR OLD.status != 'concluido') THEN
    
    -- Busca o status da empresa
    SELECT status INTO v_empresa_status
    FROM empresas
    WHERE id = NEW.empresa_id;
    
    -- Se empresa está ativa, criar nota fiscal automaticamente
    IF v_empresa_status = 'ativa' THEN
      -- Busca total de colaboradores aprovados
      SELECT COUNT(*) INTO v_total_colaboradores_aprovados
      FROM colaboradores_lote
      WHERE lote_id = NEW.id
        AND status_seguradora = 'aprovado';
      
      -- Insere na tabela notas_fiscais usando o valor_total do lote
      INSERT INTO notas_fiscais (
        empresa_id,
        lote_id,
        competencia,
        numero_vidas,
        valor_total,
        nf_emitida
      )
      VALUES (
        NEW.empresa_id,
        NEW.id,
        NEW.competencia,
        COALESCE(v_total_colaboradores_aprovados, 0),
        COALESCE(NEW.valor_total, 0),
        false
      )
      ON CONFLICT (empresa_id, lote_id) DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Atualizar a trigger de criação de nota fiscal após boas vindas
CREATE OR REPLACE FUNCTION public.criar_nota_fiscal_apos_boas_vindas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lote_status lote_status;
  v_competencia TEXT;
  v_total_colaboradores_aprovados INTEGER;
  v_valor_total NUMERIC;
BEGIN
  -- Verifica se boas_vindas_enviado mudou para true
  IF NEW.boas_vindas_enviado = true AND (OLD.boas_vindas_enviado IS NULL OR OLD.boas_vindas_enviado = false) THEN
    
    -- Busca informações do lote
    SELECT status, competencia, valor_total INTO v_lote_status, v_competencia, v_valor_total
    FROM lotes_mensais
    WHERE id = NEW.lote_id;
    
    -- Verifica se o lote está concluído
    IF v_lote_status = 'concluido' THEN
      -- Busca total de colaboradores aprovados
      SELECT COUNT(*) INTO v_total_colaboradores_aprovados
      FROM colaboradores_lote
      WHERE lote_id = NEW.lote_id
        AND status_seguradora = 'aprovado';
      
      -- Insere na tabela notas_fiscais
      INSERT INTO notas_fiscais (
        empresa_id,
        lote_id,
        competencia,
        numero_vidas,
        valor_total,
        nf_emitida
      )
      VALUES (
        NEW.empresa_id,
        NEW.lote_id,
        v_competencia,
        COALESCE(v_total_colaboradores_aprovados, 0),
        COALESCE(v_valor_total, 0),
        false
      )
      ON CONFLICT (empresa_id, lote_id) DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;