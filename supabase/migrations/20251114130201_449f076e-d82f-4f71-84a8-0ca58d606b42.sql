-- Adicionar campo de status de aprovação pela seguradora na tabela colaboradores_lote
ALTER TABLE public.colaboradores_lote 
ADD COLUMN status_seguradora text CHECK (status_seguradora IN ('pendente', 'aprovado', 'reprovado')) DEFAULT 'pendente',
ADD COLUMN motivo_reprovacao_seguradora text;

-- Adicionar índice para melhorar performance de queries
CREATE INDEX idx_colaboradores_lote_status_seguradora ON public.colaboradores_lote(status_seguradora);

-- Comentários para documentação
COMMENT ON COLUMN public.colaboradores_lote.status_seguradora IS 'Status de aprovação pela seguradora: pendente, aprovado, reprovado';
COMMENT ON COLUMN public.colaboradores_lote.motivo_reprovacao_seguradora IS 'Motivo da reprovação pela seguradora, se aplicável';