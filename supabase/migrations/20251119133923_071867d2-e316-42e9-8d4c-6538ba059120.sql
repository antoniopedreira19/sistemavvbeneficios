-- Verificar e adicionar coluna valor_total se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'lotes_mensais' 
        AND column_name = 'valor_total'
    ) THEN
        ALTER TABLE public.lotes_mensais ADD COLUMN valor_total NUMERIC DEFAULT 0;
    END IF;
END $$;

-- Atualizar notas fiscais existentes com o valor_total do lote correspondente
UPDATE notas_fiscais nf
SET valor_total = COALESCE(lm.valor_total, 0)
FROM lotes_mensais lm
WHERE nf.lote_id = lm.id
  AND (nf.valor_total = 0 OR nf.valor_total IS NULL);