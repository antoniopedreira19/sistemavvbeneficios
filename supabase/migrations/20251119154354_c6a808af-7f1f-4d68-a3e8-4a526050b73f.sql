-- Adicionar campo data_previsao_termino na tabela obras
ALTER TABLE public.obras
ADD COLUMN data_previsao_termino DATE;