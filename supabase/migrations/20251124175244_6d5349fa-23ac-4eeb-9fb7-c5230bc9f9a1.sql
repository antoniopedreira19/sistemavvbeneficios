-- Adicionar coluna total_aprovados na tabela lotes_mensais
ALTER TABLE lotes_mensais 
ADD COLUMN IF NOT EXISTS total_aprovados INTEGER DEFAULT 0;

-- Atualizar valores existentes (contar aprovados em cada lote)
UPDATE lotes_mensais lm
SET total_aprovados = (
  SELECT COUNT(*)
  FROM colaboradores_lote cl
  WHERE cl.lote_id = lm.id
    AND cl.status_seguradora = 'aprovado'
);

-- Função para atualizar total_aprovados e valor_total ao concluir lote
CREATE OR REPLACE FUNCTION public.atualizar_totais_ao_concluir_lote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_aprovados INTEGER;
  v_valor_total NUMERIC;
BEGIN
  -- Verifica se o status mudou para 'concluido'
  IF NEW.status = 'concluido' AND (OLD.status IS NULL OR OLD.status != 'concluido') THEN
    
    -- Conta colaboradores aprovados
    SELECT COUNT(*) INTO v_total_aprovados
    FROM colaboradores_lote
    WHERE lote_id = NEW.id
      AND status_seguradora = 'aprovado';
    
    -- Calcula valor total baseado nos preços dos planos
    SELECT COALESCE(SUM(pp.valor), 0) INTO v_valor_total
    FROM colaboradores_lote cl
    LEFT JOIN precos_planos pp ON pp.lote_id = NEW.id
    WHERE cl.lote_id = NEW.id
      AND cl.status_seguradora = 'aprovado';
    
    -- Se não houver preços cadastrados, mantém o valor_total existente ou 0
    IF v_valor_total = 0 THEN
      v_valor_total := COALESCE(NEW.valor_total, 0);
    END IF;
    
    -- Atualiza o lote
    UPDATE lotes_mensais
    SET 
      total_aprovados = v_total_aprovados,
      valor_total = v_valor_total
    WHERE id = NEW.id;
    
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Função para atualizar lote pai quando sublote é concluído
CREATE OR REPLACE FUNCTION public.atualizar_lote_pai_ao_concluir_sublote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_aprovados_sublote INTEGER;
  v_valor_total_sublote NUMERIC;
BEGIN
  -- Verifica se o status mudou para 'concluido' e se tem lote pai
  IF NEW.status = 'concluido' AND (OLD.status IS NULL OR OLD.status != 'concluido') AND NEW.lote_pai_id IS NOT NULL THEN
    
    -- Conta colaboradores aprovados no sublote
    SELECT COUNT(*) INTO v_total_aprovados_sublote
    FROM colaboradores_lote
    WHERE lote_id = NEW.id
      AND status_seguradora = 'aprovado';
    
    -- Calcula valor total do sublote
    SELECT COALESCE(SUM(pp.valor), 0) INTO v_valor_total_sublote
    FROM colaboradores_lote cl
    LEFT JOIN precos_planos pp ON pp.lote_id = NEW.lote_pai_id
    WHERE cl.lote_id = NEW.id
      AND cl.status_seguradora = 'aprovado';
    
    -- Se não houver preços, usa o valor_total do sublote
    IF v_valor_total_sublote = 0 THEN
      v_valor_total_sublote := COALESCE(NEW.valor_total, 0);
    END IF;
    
    -- Atualiza totais no lote pai
    UPDATE lotes_mensais
    SET 
      total_aprovados = total_aprovados + v_total_aprovados_sublote,
      valor_total = valor_total + v_valor_total_sublote,
      updated_at = now()
    WHERE id = NEW.lote_pai_id;
    
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Remove triggers antigos se existirem
DROP TRIGGER IF EXISTS trigger_atualizar_totais_lote ON lotes_mensais;
DROP TRIGGER IF EXISTS trigger_atualizar_lote_pai ON lotes_mensais;

-- Criar triggers
CREATE TRIGGER trigger_atualizar_totais_lote
  AFTER UPDATE ON lotes_mensais
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_totais_ao_concluir_lote();

CREATE TRIGGER trigger_atualizar_lote_pai
  AFTER UPDATE ON lotes_mensais
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_lote_pai_ao_concluir_sublote();

-- Atualizar triggers existentes de apólices e notas fiscais para usar total_aprovados
CREATE OR REPLACE FUNCTION public.criar_apolice_ao_concluir_lote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa_status empresa_status;
BEGIN
  IF NEW.status = 'concluido' AND (OLD.status IS NULL OR OLD.status != 'concluido') THEN
    
    SELECT status INTO v_empresa_status
    FROM empresas
    WHERE id = NEW.empresa_id;
    
    IF v_empresa_status = 'em_implementacao' THEN
      INSERT INTO apolices (
        empresa_id,
        lote_id,
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
        COALESCE(NEW.total_aprovados, 0),
        false,
        false,
        false,
        0,
        0
      )
      ON CONFLICT (empresa_id, lote_id) 
      DO UPDATE SET
        numero_vidas_enviado = COALESCE(NEW.total_aprovados, 0),
        updated_at = now();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.criar_nota_fiscal_empresa_ativa()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa_status empresa_status;
BEGIN
  IF NEW.status = 'concluido' AND (OLD.status IS NULL OR OLD.status != 'concluido') THEN
    
    SELECT status INTO v_empresa_status
    FROM empresas
    WHERE id = NEW.empresa_id;
    
    IF v_empresa_status = 'ativa' THEN
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
        COALESCE(NEW.total_aprovados, 0),
        COALESCE(NEW.valor_total, 0),
        false
      )
      ON CONFLICT (empresa_id, lote_id) DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.criar_nota_fiscal_apos_boas_vindas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_lote_status lote_status;
  v_competencia TEXT;
  v_valor_total NUMERIC;
  v_total_aprovados INTEGER;
BEGIN
  IF NEW.boas_vindas_enviado = true AND (OLD.boas_vindas_enviado IS NULL OR OLD.boas_vindas_enviado = false) THEN
    
    SELECT status, competencia, valor_total, total_aprovados 
    INTO v_lote_status, v_competencia, v_valor_total, v_total_aprovados
    FROM lotes_mensais
    WHERE id = NEW.lote_id;
    
    IF v_lote_status = 'concluido' THEN
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
        COALESCE(v_total_aprovados, 0),
        COALESCE(v_valor_total, 0),
        false
      )
      ON CONFLICT (empresa_id, lote_id) DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;