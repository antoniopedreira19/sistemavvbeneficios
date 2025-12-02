-- Remove o índice único que impede CPF duplicado na mesma empresa
DROP INDEX IF EXISTS public.idx_colaboradores_cpf_empresa;