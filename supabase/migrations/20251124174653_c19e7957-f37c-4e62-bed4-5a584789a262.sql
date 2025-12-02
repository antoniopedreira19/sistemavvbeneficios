-- Modificar função para criar apólice ao concluir lote
-- Agora conta apenas colaboradores aprovados
CREATE OR REPLACE FUNCTION public.criar_apolice_ao_concluir_lote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa_status empresa_status;
  v_total_aprovados INTEGER;
BEGIN
  -- Verifica se o status mudou para 'concluido'
  IF NEW.status = 'concluido' AND (OLD.status IS NULL OR OLD.status != 'concluido') THEN
    
    -- Busca o status da empresa
    SELECT status INTO v_empresa_status
    FROM empresas
    WHERE id = NEW.empresa_id;
    
    -- Busca o total de colaboradores APROVADOS do lote
    SELECT COUNT(*) INTO v_total_aprovados
    FROM colaboradores_lote
    WHERE lote_id = NEW.id
      AND status_seguradora = 'aprovado';
    
    -- Verifica se a empresa está em implementação
    IF v_empresa_status = 'em_implementacao' THEN
      -- Cria ou atualiza o registro na tabela apolices
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
        COALESCE(v_total_aprovados, 0),
        false,
        false,
        false,
        0,
        0
      )
      ON CONFLICT (empresa_id, lote_id) 
      DO UPDATE SET
        numero_vidas_enviado = COALESCE(v_total_aprovados, 0),
        updated_at = now();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Modificar função para criar nota fiscal de empresa ativa
-- Agora conta apenas colaboradores aprovados
CREATE OR REPLACE FUNCTION public.criar_nota_fiscal_empresa_ativa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa_status empresa_status;
  v_total_aprovados INTEGER;
BEGIN
  -- Verifica se o status mudou para 'concluido'
  IF NEW.status = 'concluido' AND (OLD.status IS NULL OR OLD.status != 'concluido') THEN
    
    -- Busca o status da empresa
    SELECT status INTO v_empresa_status
    FROM empresas
    WHERE id = NEW.empresa_id;
    
    -- Se empresa está ativa, criar nota fiscal automaticamente
    IF v_empresa_status = 'ativa' THEN
      -- Busca total de colaboradores APROVADOS
      SELECT COUNT(*) INTO v_total_aprovados
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
        COALESCE(v_total_aprovados, 0),
        COALESCE(NEW.valor_total, 0),
        false
      )
      ON CONFLICT (empresa_id, lote_id) DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Modificar função para criar nota fiscal após boas vindas
-- Agora conta apenas colaboradores aprovados
CREATE OR REPLACE FUNCTION public.criar_nota_fiscal_apos_boas_vindas()
RETURNS trigger
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
  -- Verifica se boas_vindas_enviado mudou para true
  IF NEW.boas_vindas_enviado = true AND (OLD.boas_vindas_enviado IS NULL OR OLD.boas_vindas_enviado = false) THEN
    
    -- Busca informações do lote
    SELECT status, competencia, valor_total INTO v_lote_status, v_competencia, v_valor_total
    FROM lotes_mensais
    WHERE id = NEW.lote_id;
    
    -- Verifica se o lote está concluído
    IF v_lote_status = 'concluido' THEN
      -- Busca total de colaboradores APROVADOS
      SELECT COUNT(*) INTO v_total_aprovados
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

-- Nova função para atualizar apólice/nota fiscal quando sublote é concluído
CREATE OR REPLACE FUNCTION public.atualizar_apolice_nota_ao_concluir_sublote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_lote_pai_id UUID;
  v_empresa_id UUID;
  v_empresa_status empresa_status;
  v_total_aprovados_sublote INTEGER;
  v_valor_total_sublote NUMERIC;
BEGIN
  -- Verifica se o status mudou para 'concluido' e se tem lote pai
  IF NEW.status = 'concluido' AND (OLD.status IS NULL OR OLD.status != 'concluido') AND NEW.lote_pai_id IS NOT NULL THEN
    
    v_lote_pai_id := NEW.lote_pai_id;
    v_empresa_id := NEW.empresa_id;
    
    -- Busca o status da empresa
    SELECT status INTO v_empresa_status
    FROM empresas
    WHERE id = v_empresa_id;
    
    -- Conta colaboradores aprovados no sublote
    SELECT COUNT(*) INTO v_total_aprovados_sublote
    FROM colaboradores_lote
    WHERE lote_id = NEW.id
      AND status_seguradora = 'aprovado';
    
    -- Pega o valor total do sublote
    v_valor_total_sublote := COALESCE(NEW.valor_total, 0);
    
    -- Se empresa em implementação, atualiza apólice
    IF v_empresa_status = 'em_implementacao' THEN
      UPDATE apolices
      SET 
        numero_vidas_enviado = numero_vidas_enviado + v_total_aprovados_sublote,
        updated_at = now()
      WHERE lote_id = v_lote_pai_id;
    END IF;
    
    -- Se empresa ativa, atualiza nota fiscal
    IF v_empresa_status = 'ativa' THEN
      UPDATE notas_fiscais
      SET 
        numero_vidas = numero_vidas + v_total_aprovados_sublote,
        valor_total = valor_total + v_valor_total_sublote,
        updated_at = now()
      WHERE lote_id = v_lote_pai_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Criar trigger para atualizar ao concluir sublote
DROP TRIGGER IF EXISTS trigger_atualizar_apolice_nota_ao_concluir_sublote ON lotes_mensais;
CREATE TRIGGER trigger_atualizar_apolice_nota_ao_concluir_sublote
  AFTER UPDATE ON lotes_mensais
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_apolice_nota_ao_concluir_sublote();