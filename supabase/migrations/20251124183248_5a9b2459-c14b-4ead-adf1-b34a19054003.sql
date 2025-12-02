-- Trigger para atualizar totais quando sublote é concluído
CREATE OR REPLACE FUNCTION public.atualizar_totais_ao_concluir_lote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Trigger para atualizar lote pai quando sublote é concluído
CREATE OR REPLACE FUNCTION public.atualizar_lote_pai_ao_concluir_sublote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Trigger para atualizar apólice e nota fiscal ao concluir sublote
CREATE OR REPLACE FUNCTION public.atualizar_apolice_nota_ao_concluir_sublote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Remove triggers antigos se existirem
DROP TRIGGER IF EXISTS trigger_atualizar_totais_lote ON lotes_mensais;
DROP TRIGGER IF EXISTS trigger_atualizar_lote_pai ON lotes_mensais;
DROP TRIGGER IF EXISTS trigger_atualizar_apolice_nota ON lotes_mensais;

-- Cria os triggers
CREATE TRIGGER trigger_atualizar_totais_lote
  AFTER UPDATE ON lotes_mensais
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_totais_ao_concluir_lote();

CREATE TRIGGER trigger_atualizar_lote_pai
  AFTER UPDATE ON lotes_mensais
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_lote_pai_ao_concluir_sublote();

CREATE TRIGGER trigger_atualizar_apolice_nota
  AFTER UPDATE ON lotes_mensais
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_apolice_nota_ao_concluir_sublote();