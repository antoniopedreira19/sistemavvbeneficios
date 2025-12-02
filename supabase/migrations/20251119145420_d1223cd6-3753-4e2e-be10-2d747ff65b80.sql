-- Criar tabela de obras
CREATE TABLE public.obras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'inativa')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, nome)
);

-- Habilitar RLS na tabela obras
ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para obras
CREATE POLICY "Cliente pode ver obras da sua empresa"
ON public.obras
FOR SELECT
USING (empresa_id IN (
  SELECT empresa_id FROM profiles WHERE id = auth.uid()
));

CREATE POLICY "Cliente pode gerenciar obras da sua empresa"
ON public.obras
FOR ALL
USING (empresa_id IN (
  SELECT empresa_id FROM profiles WHERE id = auth.uid()
))
WITH CHECK (empresa_id IN (
  SELECT empresa_id FROM profiles WHERE id = auth.uid()
));

CREATE POLICY "Admin e Operacional podem ver todas obras"
ON public.obras
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role));

CREATE POLICY "Admin e Operacional podem gerenciar obras"
ON public.obras
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role));

-- Adicionar obra_id nas tabelas relevantes
ALTER TABLE public.lotes_mensais ADD COLUMN obra_id UUID REFERENCES public.obras(id) ON DELETE CASCADE;
ALTER TABLE public.colaboradores ADD COLUMN obra_id UUID REFERENCES public.obras(id) ON DELETE CASCADE;
ALTER TABLE public.apolices ADD COLUMN obra_id UUID REFERENCES public.obras(id) ON DELETE CASCADE;
ALTER TABLE public.notas_fiscais ADD COLUMN obra_id UUID REFERENCES public.obras(id) ON DELETE CASCADE;

-- Criar índices para melhor performance
CREATE INDEX idx_obras_empresa_id ON public.obras(empresa_id);
CREATE INDEX idx_lotes_mensais_obra_id ON public.lotes_mensais(obra_id);
CREATE INDEX idx_colaboradores_obra_id ON public.colaboradores(obra_id);
CREATE INDEX idx_apolices_obra_id ON public.apolices(obra_id);
CREATE INDEX idx_notas_fiscais_obra_id ON public.notas_fiscais(obra_id);

-- Trigger para atualizar updated_at em obras
CREATE TRIGGER update_obras_updated_at
BEFORE UPDATE ON public.obras
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();