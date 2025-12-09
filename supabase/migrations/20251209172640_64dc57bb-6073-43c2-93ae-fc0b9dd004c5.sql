-- Criar constraint única para cpf + empresa_id na tabela colaboradores
-- Isso permite upsert por CPF dentro da mesma empresa
ALTER TABLE public.colaboradores
ADD CONSTRAINT colaboradores_cpf_empresa_unique UNIQUE (cpf, empresa_id);