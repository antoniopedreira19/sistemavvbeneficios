-- Criar enum para status da empresa
CREATE TYPE empresa_status AS ENUM ('ativa', 'em_implementacao');

-- Adicionar coluna status na tabela empresas
ALTER TABLE public.empresas
ADD COLUMN status empresa_status NOT NULL DEFAULT 'em_implementacao';

-- Adicionar comentário explicativo
COMMENT ON COLUMN public.empresas.status IS 'Status da empresa: ativa ou em_implementacao';