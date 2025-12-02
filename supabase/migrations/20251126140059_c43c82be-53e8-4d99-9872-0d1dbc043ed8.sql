-- Criar tabela de notificações
CREATE TABLE IF NOT EXISTS public.notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL, -- 'cliente_envia_lista', 'admin_confirma_lista', etc.
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  lote_id UUID REFERENCES public.lotes_mensais(id) ON DELETE CASCADE,
  destinatario_role TEXT NOT NULL, -- 'admin', 'cliente'
  dados JSONB, -- dados adicionais específicos de cada tipo de notificação
  enviado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- Admin e Operacional podem ver e gerenciar todas notificações
CREATE POLICY "Admin e Operacional podem gerenciar notificacoes"
ON public.notificacoes
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role));

-- Cliente pode ver notificações da sua empresa
CREATE POLICY "Cliente pode ver notificacoes da sua empresa"
ON public.notificacoes
FOR SELECT
USING (empresa_id IN (SELECT empresa_id FROM profiles WHERE id = auth.uid()));

-- Criar índices para performance
CREATE INDEX idx_notificacoes_enviado ON public.notificacoes(enviado);
CREATE INDEX idx_notificacoes_created_at ON public.notificacoes(created_at DESC);
CREATE INDEX idx_notificacoes_empresa_id ON public.notificacoes(empresa_id);

-- Função para criar notificação
CREATE OR REPLACE FUNCTION public.criar_notificacao(
  p_tipo TEXT,
  p_empresa_id UUID,
  p_lote_id UUID,
  p_destinatario_role TEXT,
  p_dados JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notificacao_id UUID;
BEGIN
  INSERT INTO notificacoes (tipo, empresa_id, lote_id, destinatario_role, dados)
  VALUES (p_tipo, p_empresa_id, p_lote_id, p_destinatario_role, p_dados)
  RETURNING id INTO v_notificacao_id;
  
  RETURN v_notificacao_id;
END;
$$;

-- Trigger: Cliente envia lista (status muda para 'validando')
CREATE OR REPLACE FUNCTION public.notificar_cliente_envia_lista()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'validando' AND (OLD.status IS NULL OR OLD.status = 'rascunho') THEN
    PERFORM criar_notificacao(
      'cliente_envia_lista',
      NEW.empresa_id,
      NEW.id,
      'admin',
      jsonb_build_object(
        'competencia', NEW.competencia,
        'total_colaboradores', NEW.total_colaboradores,
        'obra_id', NEW.obra_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_cliente_envia_lista
AFTER UPDATE ON public.lotes_mensais
FOR EACH ROW
EXECUTE FUNCTION public.notificar_cliente_envia_lista();

-- Trigger: Admin confirma lista e coloca preço (status muda para 'em_cotacao')
CREATE OR REPLACE FUNCTION public.notificar_admin_confirma_lista()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_valor_plano NUMERIC;
BEGIN
  IF NEW.status = 'em_cotacao' AND OLD.status = 'validando' THEN
    -- Buscar o valor do plano
    SELECT valor INTO v_valor_plano
    FROM precos_planos
    WHERE lote_id = NEW.id
    LIMIT 1;
    
    PERFORM criar_notificacao(
      'admin_confirma_lista',
      NEW.empresa_id,
      NEW.id,
      'cliente',
      jsonb_build_object(
        'competencia', NEW.competencia,
        'total_colaboradores', NEW.total_colaboradores,
        'valor_plano', COALESCE(v_valor_plano, 0),
        'valor_total', NEW.valor_total
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_admin_confirma_lista
AFTER UPDATE ON public.lotes_mensais
FOR EACH ROW
EXECUTE FUNCTION public.notificar_admin_confirma_lista();

-- Trigger: Cliente aprova preço (status muda para 'cotado' ou 'aprovado')
CREATE OR REPLACE FUNCTION public.notificar_cliente_aprova_preco()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'aprovado' AND OLD.status = 'cotado' THEN
    PERFORM criar_notificacao(
      'cliente_aprova_preco',
      NEW.empresa_id,
      NEW.id,
      'admin',
      jsonb_build_object(
        'competencia', NEW.competencia,
        'valor_total', NEW.valor_total
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_cliente_aprova_preco
AFTER UPDATE ON public.lotes_mensais
FOR EACH ROW
EXECUTE FUNCTION public.notificar_cliente_aprova_preco();

-- Trigger: Admin envia para seguradora (status muda para 'enviado')
CREATE OR REPLACE FUNCTION public.notificar_admin_envia_seguradora()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'enviado' AND OLD.status = 'aprovado' THEN
    PERFORM criar_notificacao(
      'admin_envia_seguradora',
      NEW.empresa_id,
      NEW.id,
      'cliente',
      jsonb_build_object(
        'competencia', NEW.competencia,
        'total_colaboradores', NEW.total_colaboradores
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_admin_envia_seguradora
AFTER UPDATE ON public.lotes_mensais
FOR EACH ROW
EXECUTE FUNCTION public.notificar_admin_envia_seguradora();

-- Trigger: Admin gerencia aprovações (status muda para 'aguardando_finalizacao')
CREATE OR REPLACE FUNCTION public.notificar_admin_gerencia_aprovacoes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reprovados JSONB;
BEGIN
  IF NEW.status = 'aguardando_finalizacao' AND OLD.status = 'enviado' THEN
    -- Buscar lista de reprovados com nomes e motivos
    SELECT jsonb_agg(
      jsonb_build_object(
        'nome', nome,
        'cpf', cpf,
        'motivo', motivo_reprovacao_seguradora
      )
    ) INTO v_reprovados
    FROM colaboradores_lote
    WHERE lote_id = NEW.id
      AND status_seguradora = 'reprovado';
    
    PERFORM criar_notificacao(
      'admin_gerencia_aprovacoes',
      NEW.empresa_id,
      NEW.id,
      'cliente',
      jsonb_build_object(
        'competencia', NEW.competencia,
        'total_aprovados', NEW.total_aprovados,
        'total_reprovados', NEW.total_reprovados,
        'reprovados', COALESCE(v_reprovados, '[]'::jsonb)
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_admin_gerencia_aprovacoes
AFTER UPDATE ON public.lotes_mensais
FOR EACH ROW
EXECUTE FUNCTION public.notificar_admin_gerencia_aprovacoes();

-- Trigger: Cliente corrige reprovados e reenvia (detecta quando colaboradores_lote com tentativa_reenvio > 1 são criados)
CREATE OR REPLACE FUNCTION public.notificar_cliente_reenvia_reprovados()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id UUID;
  v_competencia TEXT;
  v_count INTEGER;
BEGIN
  -- Só dispara se for reenvio (tentativa > 1) e status pendente
  IF NEW.tentativa_reenvio > 1 AND NEW.status_seguradora = 'pendente' THEN
    -- Buscar empresa_id e competencia do lote
    SELECT empresa_id, competencia INTO v_empresa_id, v_competencia
    FROM lotes_mensais
    WHERE id = NEW.lote_id;
    
    -- Contar quantos colaboradores foram reenviados nesta tentativa
    SELECT COUNT(*) INTO v_count
    FROM colaboradores_lote
    WHERE lote_id = NEW.lote_id
      AND tentativa_reenvio = NEW.tentativa_reenvio
      AND status_seguradora = 'pendente';
    
    -- Criar notificação apenas uma vez por lote (usando tentativa_reenvio como chave)
    IF NOT EXISTS (
      SELECT 1 FROM notificacoes
      WHERE tipo = 'cliente_reenvia_reprovados'
        AND lote_id = NEW.lote_id
        AND dados->>'tentativa_reenvio' = NEW.tentativa_reenvio::text
    ) THEN
      PERFORM criar_notificacao(
        'cliente_reenvia_reprovados',
        v_empresa_id,
        NEW.lote_id,
        'admin',
        jsonb_build_object(
          'competencia', v_competencia,
          'tentativa_reenvio', NEW.tentativa_reenvio,
          'total_corrigidos', v_count
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_cliente_reenvia_reprovados
AFTER INSERT ON public.colaboradores_lote
FOR EACH ROW
EXECUTE FUNCTION public.notificar_cliente_reenvia_reprovados();

-- Trigger: Admin envia reenvios para seguradora (status_seguradora muda de 'pendente' para 'enviado' em reenvios)
CREATE OR REPLACE FUNCTION public.notificar_admin_envia_reenvios()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id UUID;
  v_competencia TEXT;
  v_count INTEGER;
BEGIN
  -- Só dispara se for reenvio e status mudou para enviado
  IF NEW.tentativa_reenvio > 1 AND NEW.status_seguradora = 'enviado' AND OLD.status_seguradora = 'pendente' THEN
    -- Buscar empresa_id e competencia do lote
    SELECT empresa_id, competencia INTO v_empresa_id, v_competencia
    FROM lotes_mensais
    WHERE id = NEW.lote_id;
    
    -- Contar quantos colaboradores foram enviados nesta tentativa
    SELECT COUNT(*) INTO v_count
    FROM colaboradores_lote
    WHERE lote_id = NEW.lote_id
      AND tentativa_reenvio = NEW.tentativa_reenvio
      AND status_seguradora = 'enviado';
    
    -- Criar notificação apenas uma vez por lote/tentativa
    IF NOT EXISTS (
      SELECT 1 FROM notificacoes
      WHERE tipo = 'admin_envia_reenvios'
        AND lote_id = NEW.lote_id
        AND dados->>'tentativa_reenvio' = NEW.tentativa_reenvio::text
    ) THEN
      PERFORM criar_notificacao(
        'admin_envia_reenvios',
        v_empresa_id,
        NEW.lote_id,
        'cliente',
        jsonb_build_object(
          'competencia', v_competencia,
          'tentativa_reenvio', NEW.tentativa_reenvio,
          'total_enviados', v_count
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_admin_envia_reenvios
AFTER UPDATE ON public.colaboradores_lote
FOR EACH ROW
EXECUTE FUNCTION public.notificar_admin_envia_reenvios();

-- Trigger: Admin gerencia reenvios (similar ao gerencia_aprovacoes, mas para reenvios)
CREATE OR REPLACE FUNCTION public.notificar_admin_gerencia_reenvios()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id UUID;
  v_competencia TEXT;
  v_aprovados INTEGER;
  v_reprovados INTEGER;
  v_reprovados_list JSONB;
BEGIN
  -- Dispara quando status_seguradora muda para aprovado ou reprovado em reenvios
  IF NEW.tentativa_reenvio > 1 AND 
     (NEW.status_seguradora IN ('aprovado', 'reprovado')) AND 
     (OLD.status_seguradora = 'enviado') THEN
    
    -- Buscar empresa_id e competencia
    SELECT empresa_id, competencia INTO v_empresa_id, v_competencia
    FROM lotes_mensais
    WHERE id = NEW.lote_id;
    
    -- Contar aprovados e reprovados desta tentativa
    SELECT 
      COUNT(*) FILTER (WHERE status_seguradora = 'aprovado'),
      COUNT(*) FILTER (WHERE status_seguradora = 'reprovado')
    INTO v_aprovados, v_reprovados
    FROM colaboradores_lote
    WHERE lote_id = NEW.lote_id
      AND tentativa_reenvio = NEW.tentativa_reenvio;
    
    -- Buscar lista de reprovados
    SELECT jsonb_agg(
      jsonb_build_object(
        'nome', nome,
        'cpf', cpf,
        'motivo', motivo_reprovacao_seguradora
      )
    ) INTO v_reprovados_list
    FROM colaboradores_lote
    WHERE lote_id = NEW.lote_id
      AND tentativa_reenvio = NEW.tentativa_reenvio
      AND status_seguradora = 'reprovado';
    
    -- Criar notificação apenas uma vez por lote/tentativa
    IF NOT EXISTS (
      SELECT 1 FROM notificacoes
      WHERE tipo = 'admin_gerencia_reenvios'
        AND lote_id = NEW.lote_id
        AND dados->>'tentativa_reenvio' = NEW.tentativa_reenvio::text
    ) THEN
      PERFORM criar_notificacao(
        'admin_gerencia_reenvios',
        v_empresa_id,
        NEW.lote_id,
        'cliente',
        jsonb_build_object(
          'competencia', v_competencia,
          'tentativa_reenvio', NEW.tentativa_reenvio,
          'total_aprovados', v_aprovados,
          'total_reprovados', v_reprovados,
          'reprovados', COALESCE(v_reprovados_list, '[]'::jsonb)
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_admin_gerencia_reenvios
AFTER UPDATE ON public.colaboradores_lote
FOR EACH ROW
EXECUTE FUNCTION public.notificar_admin_gerencia_reenvios();

-- Trigger: Admin finaliza lote (status muda para 'concluido')
CREATE OR REPLACE FUNCTION public.notificar_admin_finaliza_lote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'concluido' AND OLD.status = 'aguardando_finalizacao' THEN
    PERFORM criar_notificacao(
      'admin_finaliza_lote',
      NEW.empresa_id,
      NEW.id,
      'cliente',
      jsonb_build_object(
        'competencia', NEW.competencia,
        'total_aprovados', NEW.total_aprovados,
        'valor_total', NEW.valor_total
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_admin_finaliza_lote
AFTER UPDATE ON public.lotes_mensais
FOR EACH ROW
EXECUTE FUNCTION public.notificar_admin_finaliza_lote();