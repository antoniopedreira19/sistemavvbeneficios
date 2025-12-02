-- Remove a constraint UNIQUE (empresa_id, cpf) que impede um colaborador estar em múltiplas obras
ALTER TABLE public.colaboradores 
DROP CONSTRAINT IF EXISTS colaboradores_empresa_id_cpf_key;

-- Adiciona nova constraint UNIQUE (empresa_id, obra_id, cpf) para evitar duplicatas dentro da mesma obra
ALTER TABLE public.colaboradores 
ADD CONSTRAINT colaboradores_empresa_obra_cpf_key UNIQUE (empresa_id, obra_id, cpf);