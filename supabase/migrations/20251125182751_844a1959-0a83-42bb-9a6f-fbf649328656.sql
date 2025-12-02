-- Adicionar coluna total_reprovados na tabela lotes_mensais
ALTER TABLE lotes_mensais 
ADD COLUMN IF NOT EXISTS total_reprovados INTEGER DEFAULT 0;

-- Atualizar valores existentes de total_reprovados
UPDATE lotes_mensais lm
SET total_reprovados = (
  SELECT COUNT(*)
  FROM colaboradores_lote cl
  WHERE cl.lote_id = lm.id
    AND cl.status_seguradora = 'reprovado'
);

-- Atualizar valores existentes de total_colaboradores (conta CPFs distintos)
UPDATE lotes_mensais lm
SET total_colaboradores = (
  SELECT COUNT(DISTINCT cpf)
  FROM colaboradores_lote cl
  WHERE cl.lote_id = lm.id
);

-- Atualizar valores existentes de total_aprovados
UPDATE lotes_mensais lm
SET total_aprovados = (
  SELECT COUNT(*)
  FROM colaboradores_lote cl
  WHERE cl.lote_id = lm.id
    AND cl.status_seguradora = 'aprovado'
);

-- Criar função para atualizar totais automaticamente
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
BEGIN
  -- Conta CPFs distintos para total de colaboradores
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
  
  -- Atualiza o lote com os novos totais
  UPDATE lotes_mensais
  SET 
    total_colaboradores = v_total_colaboradores,
    total_aprovados = v_total_aprovados,
    total_reprovados = v_total_reprovados,
    updated_at = now()
  WHERE id = COALESCE(NEW.lote_id, OLD.lote_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Criar trigger para atualizar totais quando status_seguradora muda
DROP TRIGGER IF EXISTS trigger_atualizar_totais_lote ON colaboradores_lote;
CREATE TRIGGER trigger_atualizar_totais_lote
  AFTER INSERT OR UPDATE OF status_seguradora ON colaboradores_lote
  FOR EACH ROW
  EXECUTE FUNCTION public.atualizar_totais_lote();