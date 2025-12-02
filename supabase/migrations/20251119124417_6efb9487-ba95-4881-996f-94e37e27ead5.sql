-- Criar tabela notas_fiscais
CREATE TABLE public.notas_fiscais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  lote_id UUID NOT NULL REFERENCES public.lotes_mensais(id) ON DELETE CASCADE,
  competencia TEXT NOT NULL,
  numero_vidas INTEGER NOT NULL DEFAULT 0,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  nf_emitida BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, lote_id)
);

-- Enable RLS
ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admin, Operacional e Financeiro podem ver notas fiscais"
ON public.notas_fiscais
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'operacional'::app_role) OR
  has_role(auth.uid(), 'financeiro'::app_role)
);

CREATE POLICY "Admin e Operacional podem gerenciar notas fiscais"
ON public.notas_fiscais
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'operacional'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'operacional'::app_role)
);

-- Trigger para updated_at
CREATE TRIGGER update_notas_fiscais_updated_at
BEFORE UPDATE ON public.notas_fiscais
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função para criar nota fiscal quando empresa ativa conclui lote
CREATE OR REPLACE FUNCTION public.criar_nota_fiscal_empresa_ativa()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_status empresa_status;
  v_total_colaboradores INTEGER;
  v_valor_total NUMERIC;
BEGIN
  -- Verifica se o status mudou para 'concluido'
  IF NEW.status = 'concluido' AND (OLD.status IS NULL OR OLD.status != 'concluido') THEN
    
    -- Busca o status da empresa
    SELECT status INTO v_empresa_status
    FROM empresas
    WHERE id = NEW.empresa_id;
    
    -- Se empresa está ativa, criar nota fiscal automaticamente
    IF v_empresa_status = 'ativa' THEN
      -- Busca total de colaboradores aprovados
      SELECT COUNT(*) INTO v_total_colaboradores
      FROM colaboradores_lote
      WHERE lote_id = NEW.id
        AND status_seguradora = 'aprovado';
      
      -- Busca valor total da cotação (assumindo que está em lotes_mensais ou precisamos calcular)
      -- Vou assumir que o valor médio * número de colaboradores está disponível de alguma forma
      -- Por enquanto vou deixar 0 e precisaremos ajustar
      v_valor_total := 0;
      
      -- Insere na tabela notas_fiscais
      INSERT INTO notas_fiscais (
        empresa_id,
        lote_id,
        competencia,
        numero_vidas,
        valor_total,
        nf_emitida
      )
      VALUES (
        NEW.empresa_id,
        NEW.id,
        NEW.competencia,
        COALESCE(v_total_colaboradores, 0),
        v_valor_total,
        false
      )
      ON CONFLICT (empresa_id, lote_id) DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para criar nota fiscal quando empresa ativa conclui lote
CREATE TRIGGER trigger_criar_nota_fiscal_empresa_ativa
AFTER INSERT OR UPDATE ON public.lotes_mensais
FOR EACH ROW
EXECUTE FUNCTION public.criar_nota_fiscal_empresa_ativa();

-- Função para criar nota fiscal quando boas vindas é enviado
CREATE OR REPLACE FUNCTION public.criar_nota_fiscal_apos_boas_vindas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lote_status lote_status;
  v_competencia TEXT;
  v_total_colaboradores INTEGER;
  v_valor_total NUMERIC;
BEGIN
  -- Verifica se boas_vindas_enviado mudou para true
  IF NEW.boas_vindas_enviado = true AND (OLD.boas_vindas_enviado IS NULL OR OLD.boas_vindas_enviado = false) THEN
    
    -- Busca informações do lote
    SELECT status, competencia INTO v_lote_status, v_competencia
    FROM lotes_mensais
    WHERE id = NEW.lote_id;
    
    -- Verifica se o lote está concluído
    IF v_lote_status = 'concluido' THEN
      -- Busca total de colaboradores aprovados
      SELECT COUNT(*) INTO v_total_colaboradores
      FROM colaboradores_lote
      WHERE lote_id = NEW.lote_id
        AND status_seguradora = 'aprovado';
      
      -- Por enquanto valor 0, ajustaremos depois
      v_valor_total := 0;
      
      -- Insere na tabela notas_fiscais
      INSERT INTO notas_fiscais (
        empresa_id,
        lote_id,
        competencia,
        numero_vidas,
        valor_total,
        nf_emitida
      )
      VALUES (
        NEW.empresa_id,
        NEW.lote_id,
        v_competencia,
        COALESCE(v_total_colaboradores, 0),
        v_valor_total,
        false
      )
      ON CONFLICT (empresa_id, lote_id) DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para criar nota fiscal após boas vindas enviado
CREATE TRIGGER trigger_criar_nota_fiscal_apos_boas_vindas
AFTER INSERT OR UPDATE ON public.apolices
FOR EACH ROW
EXECUTE FUNCTION public.criar_nota_fiscal_apos_boas_vindas();