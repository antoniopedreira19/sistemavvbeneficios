-- Adicionar colunas necessárias em lotes_mensais se não existirem
ALTER TABLE public.lotes_mensais
ADD COLUMN IF NOT EXISTS arquivo_url TEXT,
ADD COLUMN IF NOT EXISTS motivo_reprovacao TEXT;

-- Criar tabela para snapshot de colaboradores por lote
CREATE TABLE IF NOT EXISTS public.colaboradores_lote (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lote_id UUID NOT NULL REFERENCES public.lotes_mensais(id) ON DELETE CASCADE,
  colaborador_id UUID REFERENCES public.colaboradores(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  cpf TEXT NOT NULL,
  sexo TEXT,
  data_nascimento DATE NOT NULL,
  salario NUMERIC NOT NULL,
  classificacao TEXT,
  classificacao_salario TEXT,
  aposentado BOOLEAN DEFAULT false,
  afastado BOOLEAN DEFAULT false,
  cid TEXT,
  tipo_alteracao TEXT, -- 'novo', 'alterado', 'desligado', 'mantido'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_colaboradores_lote_lote_id ON public.colaboradores_lote(lote_id);
CREATE INDEX IF NOT EXISTS idx_colaboradores_lote_colaborador_id ON public.colaboradores_lote(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_lotes_mensais_empresa_status ON public.lotes_mensais(empresa_id, status);

-- Habilitar RLS na nova tabela
ALTER TABLE public.colaboradores_lote ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para colaboradores_lote
CREATE POLICY "Admin pode ver todos colaboradores de lote"
  ON public.colaboradores_lote
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Cliente pode ver colaboradores de lote da sua empresa"
  ON public.colaboradores_lote
  FOR SELECT
  USING (
    lote_id IN (
      SELECT id FROM public.lotes_mensais
      WHERE empresa_id IN (
        SELECT empresa_id FROM public.profiles
        WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admin pode gerenciar todos colaboradores de lote"
  ON public.colaboradores_lote
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Sistema pode inserir colaboradores de lote"
  ON public.colaboradores_lote
  FOR INSERT
  WITH CHECK (
    lote_id IN (
      SELECT id FROM public.lotes_mensais
      WHERE empresa_id IN (
        SELECT empresa_id FROM public.profiles
        WHERE id = auth.uid()
      )
    )
  );

-- Adicionar trigger para atualizar updated_at em colaboradores_lote
CREATE TRIGGER update_colaboradores_lote_updated_at
  BEFORE UPDATE ON public.colaboradores_lote
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();