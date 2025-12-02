-- Adicionar campo lote_pai_id para vincular sublotes de reprovados ao lote original
ALTER TABLE public.lotes_mensais 
ADD COLUMN lote_pai_id UUID REFERENCES public.lotes_mensais(id);

-- Adicionar índice para melhor performance nas queries de sublotes
CREATE INDEX idx_lotes_mensais_lote_pai_id ON public.lotes_mensais(lote_pai_id);

-- Comentário explicativo
COMMENT ON COLUMN public.lotes_mensais.lote_pai_id IS 'Referência ao lote original quando este é um sublote de reprovados corrigidos';