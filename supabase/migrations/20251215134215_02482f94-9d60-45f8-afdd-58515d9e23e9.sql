-- Tabela para histórico de disparos de cobrança em massa
CREATE TABLE public.historico_cobrancas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  competencia TEXT NOT NULL,
  total_empresas INTEGER NOT NULL DEFAULT 0,
  empresas_notificadas JSONB NOT NULL DEFAULT '[]'::jsonb,
  disparado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.historico_cobrancas ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admin e Operacional podem gerenciar histórico cobrancas"
  ON public.historico_cobrancas
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role));

CREATE POLICY "Admin e Operacional podem ver histórico cobrancas"
  ON public.historico_cobrancas
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role));