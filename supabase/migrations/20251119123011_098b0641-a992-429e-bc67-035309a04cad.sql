-- Criar tabela de apólices para gerenciar empresas em implementação
CREATE TABLE IF NOT EXISTS public.apolices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  lote_id UUID NOT NULL REFERENCES public.lotes_mensais(id) ON DELETE CASCADE,
  adendo_assinado BOOLEAN NOT NULL DEFAULT false,
  codigo_enviado BOOLEAN NOT NULL DEFAULT false,
  boas_vindas_enviado BOOLEAN NOT NULL DEFAULT false,
  numero_vidas_enviado INTEGER DEFAULT 0,
  numero_vidas_adendo INTEGER DEFAULT 0,
  numero_vidas_vitalmed INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, lote_id)
);

-- Habilitar RLS
ALTER TABLE public.apolices ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para Admin e Operacional
CREATE POLICY "Admin e Operacional podem ver todas apólices"
ON public.apolices
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role));

CREATE POLICY "Admin e Operacional podem gerenciar apólices"
ON public.apolices
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_apolices_updated_at
BEFORE UPDATE ON public.apolices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Criar índices para melhor performance
CREATE INDEX idx_apolices_empresa_id ON public.apolices(empresa_id);
CREATE INDEX idx_apolices_lote_id ON public.apolices(lote_id);