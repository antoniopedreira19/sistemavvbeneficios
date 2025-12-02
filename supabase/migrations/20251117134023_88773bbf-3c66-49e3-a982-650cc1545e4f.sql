-- Adicionar coluna updated_at à tabela colaboradores_lote
ALTER TABLE public.colaboradores_lote 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

-- Criar trigger para atualizar updated_at automaticamente
DROP TRIGGER IF EXISTS update_colaboradores_lote_updated_at ON public.colaboradores_lote;

CREATE TRIGGER update_colaboradores_lote_updated_at
BEFORE UPDATE ON public.colaboradores_lote
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();