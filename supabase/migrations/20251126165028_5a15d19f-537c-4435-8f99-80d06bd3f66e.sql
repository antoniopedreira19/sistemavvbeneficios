-- Adicionar coluna obra_id na tabela notificacoes
ALTER TABLE public.notificacoes 
ADD COLUMN obra_id uuid REFERENCES public.obras(id) ON DELETE CASCADE;

-- Criar índice para melhor performance
CREATE INDEX idx_notificacoes_obra_id ON public.notificacoes(obra_id);

-- Atualizar a função criar_notificacao para aceitar obra_id
CREATE OR REPLACE FUNCTION public.criar_notificacao(
  p_tipo text,
  p_empresa_id uuid,
  p_lote_id uuid,
  p_destinatario_role text,
  p_dados jsonb DEFAULT '{}'::jsonb,
  p_obra_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_notificacao_id UUID;
BEGIN
  INSERT INTO notificacoes (tipo, empresa_id, lote_id, destinatario_role, dados, obra_id)
  VALUES (p_tipo, p_empresa_id, p_lote_id, p_destinatario_role, p_dados, p_obra_id)
  RETURNING id INTO v_notificacao_id;
  
  RETURN v_notificacao_id;
END;
$function$;

-- Atualizar função notificar_cliente_envia_lista para incluir nome da obra
CREATE OR REPLACE FUNCTION public.notificar_cliente_envia_lista()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_nome_empresa TEXT;
  v_nome_obra TEXT;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'em_cotacao') OR 
     (TG_OP = 'UPDATE' AND NEW.status = 'em_cotacao' AND (OLD.status IS NULL OR OLD.status != 'em_cotacao')) THEN
    
    -- Buscar nome da empresa
    SELECT nome INTO v_nome_empresa
    FROM empresas
    WHERE id = NEW.empresa_id;
    
    -- Buscar nome da obra (se houver)
    IF NEW.obra_id IS NOT NULL THEN
      SELECT nome INTO v_nome_obra
      FROM obras
      WHERE id = NEW.obra_id;
    END IF;
    
    PERFORM criar_notificacao(
      'cliente_envia_lista',
      NEW.empresa_id,
      NEW.id,
      'admin',
      jsonb_build_object(
        'nome_empresa', v_nome_empresa,
        'competencia', NEW.competencia,
        'total_colaboradores', NEW.total_colaboradores,
        'nome_obra', COALESCE(v_nome_obra, 'Sem obra especificada')
      ),
      NEW.obra_id
    );
  END IF;
  RETURN NEW;
END;
$function$;