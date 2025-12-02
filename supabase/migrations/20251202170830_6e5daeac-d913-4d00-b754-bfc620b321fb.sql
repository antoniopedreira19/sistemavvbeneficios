-- =============================================
-- MIGRATION: Refatoração BPO - Novo Fluxo Simplificado
-- =============================================

-- 1. ATUALIZAÇÃO DO ENUM lote_status
-- =============================================

-- 1a. Criar o novo tipo enum com os novos valores
CREATE TYPE lote_status_new AS ENUM (
  'rascunho',
  'aguardando_processamento',
  'em_analise_seguradora',
  'com_pendencia',
  'concluido',
  'faturado'
);

-- 1b. Adicionar coluna temporária com novo tipo
ALTER TABLE lotes_mensais ADD COLUMN status_new lote_status_new;

-- 1c. Migrar dados antigos para novos valores
UPDATE lotes_mensais SET status_new = CASE
  WHEN status = 'rascunho' THEN 'rascunho'::lote_status_new
  WHEN status = 'validando' THEN 'aguardando_processamento'::lote_status_new
  WHEN status = 'em_cotacao' THEN 'aguardando_processamento'::lote_status_new
  WHEN status = 'cotado' THEN 'aguardando_processamento'::lote_status_new
  WHEN status = 'aprovado' THEN 'aguardando_processamento'::lote_status_new
  WHEN status = 'enviado' THEN 'em_analise_seguradora'::lote_status_new
  WHEN status = 'aguardando_correcao' THEN 'com_pendencia'::lote_status_new
  WHEN status = 'aguardando_finalizacao' THEN 'concluido'::lote_status_new
  WHEN status = 'concluido' THEN 'concluido'::lote_status_new
  ELSE 'rascunho'::lote_status_new
END;

-- 1d. Remover coluna antiga e renomear nova
ALTER TABLE lotes_mensais DROP COLUMN status;
ALTER TABLE lotes_mensais RENAME COLUMN status_new TO status;

-- 1e. Adicionar NOT NULL e default
ALTER TABLE lotes_mensais ALTER COLUMN status SET NOT NULL;
ALTER TABLE lotes_mensais ALTER COLUMN status SET DEFAULT 'rascunho'::lote_status_new;

-- 1f. Remover o tipo enum antigo
DROP TYPE lote_status;

-- 1g. Renomear novo tipo para nome original
ALTER TYPE lote_status_new RENAME TO lote_status;

-- =============================================
-- 2. CRIAR TABELA empresa_import_layouts
-- =============================================

CREATE TABLE public.empresa_import_layouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  map_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Garantir apenas um layout por empresa
  CONSTRAINT unique_empresa_layout UNIQUE (empresa_id)
);

-- Habilitar RLS
ALTER TABLE public.empresa_import_layouts ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admin e Operacional podem gerenciar layouts"
ON public.empresa_import_layouts
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role));

CREATE POLICY "Cliente pode ver layout da sua empresa"
ON public.empresa_import_layouts
FOR SELECT
USING (empresa_id IN (
  SELECT profiles.empresa_id FROM profiles WHERE profiles.id = auth.uid()
));

CREATE POLICY "Cliente pode gerenciar layout da sua empresa"
ON public.empresa_import_layouts
FOR ALL
USING (empresa_id IN (
  SELECT profiles.empresa_id FROM profiles WHERE profiles.id = auth.uid()
))
WITH CHECK (empresa_id IN (
  SELECT profiles.empresa_id FROM profiles WHERE profiles.id = auth.uid()
));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_empresa_import_layouts_updated_at
BEFORE UPDATE ON public.empresa_import_layouts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índice para busca por empresa
CREATE INDEX idx_empresa_import_layouts_empresa_id ON public.empresa_import_layouts(empresa_id);

-- =============================================
-- 3. COMENTÁRIOS PARA DOCUMENTAÇÃO
-- =============================================
COMMENT ON TABLE public.empresa_import_layouts IS 'Armazena o mapeamento de colunas (De/Para) para importação de Excel de cada empresa';
COMMENT ON COLUMN public.empresa_import_layouts.map_schema IS 'JSON com mapeamento de campos. Ex: {"cpf": "Col. F", "nome": "Col. A", "salario": "Col. G"}';