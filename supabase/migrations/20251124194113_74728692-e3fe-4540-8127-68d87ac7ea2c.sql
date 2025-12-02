-- Remover triggers antigos primeiro (antes das funções)
DROP TRIGGER IF EXISTS trigger_atualizar_lote_pai_ao_concluir_sublote ON lotes_mensais;
DROP TRIGGER IF EXISTS trigger_atualizar_apolice_nota_ao_concluir_sublote ON lotes_mensais;

-- Agora remover as funções
DROP FUNCTION IF EXISTS public.atualizar_lote_pai_ao_concluir_sublote() CASCADE;
DROP FUNCTION IF EXISTS public.atualizar_apolice_nota_ao_concluir_sublote() CASCADE;