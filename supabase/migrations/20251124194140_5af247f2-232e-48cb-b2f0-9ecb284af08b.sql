-- ETAPA 1: Adicionar campos de tentativa em colaboradores_lote (se ainda não existirem)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='colaboradores_lote' AND column_name='tentativa_reenvio') THEN
        ALTER TABLE colaboradores_lote 
        ADD COLUMN tentativa_reenvio INTEGER NOT NULL DEFAULT 1;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='colaboradores_lote' AND column_name='data_tentativa') THEN
        ALTER TABLE colaboradores_lote 
        ADD COLUMN data_tentativa TIMESTAMP WITH TIME ZONE DEFAULT now();
    END IF;
END $$;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_colaboradores_lote_tentativa 
ON colaboradores_lote(lote_id, tentativa_reenvio);

-- Atualizar dados existentes que possam ter lote_pai_id
-- (colaboradores de sublotes viram tentativa 2)
UPDATE colaboradores_lote cl
SET tentativa_reenvio = 2,
    data_tentativa = cl.created_at
FROM lotes_mensais lm
WHERE cl.lote_id = lm.id 
  AND lm.lote_pai_id IS NOT NULL
  AND cl.tentativa_reenvio = 1;

-- ETAPA 2: Remover lote_pai_id
ALTER TABLE lotes_mensais 
DROP COLUMN IF EXISTS lote_pai_id;

-- ETAPA 3: Atualizar função de totais ao concluir lote
CREATE OR REPLACE FUNCTION public.atualizar_totais_ao_concluir_lote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_aprovados INTEGER;
  v_valor_total NUMERIC;
  v_ultima_tentativa INTEGER;
BEGIN
  IF NEW.status = 'concluido' AND (OLD.status IS NULL OR OLD.status != 'concluido') THEN
    
    -- Encontrar última tentativa
    SELECT COALESCE(MAX(tentativa_reenvio), 1) INTO v_ultima_tentativa
    FROM colaboradores_lote
    WHERE lote_id = NEW.id;
    
    -- Conta colaboradores aprovados da última tentativa
    SELECT COUNT(*) INTO v_total_aprovados
    FROM colaboradores_lote
    WHERE lote_id = NEW.id
      AND tentativa_reenvio = v_ultima_tentativa
      AND status_seguradora = 'aprovado';
    
    -- Calcula valor total baseado nos preços dos planos
    SELECT COALESCE(SUM(pp.valor), 0) INTO v_valor_total
    FROM colaboradores_lote cl
    LEFT JOIN precos_planos pp ON pp.lote_id = NEW.id
    WHERE cl.lote_id = NEW.id
      AND cl.tentativa_reenvio = v_ultima_tentativa
      AND cl.status_seguradora = 'aprovado';
    
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

-- Comentários explicativos
COMMENT ON COLUMN colaboradores_lote.tentativa_reenvio IS 'Número da tentativa de envio: 1 (primeira tentativa), 2 (primeiro reenvio), 3 (segundo reenvio), etc.';
COMMENT ON COLUMN colaboradores_lote.data_tentativa IS 'Data e hora em que esta tentativa foi criada';