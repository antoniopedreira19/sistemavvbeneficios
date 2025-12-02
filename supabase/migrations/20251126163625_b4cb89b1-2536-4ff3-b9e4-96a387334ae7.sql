-- Remover trigger antigo e criar novo que funciona em INSERT também
DROP TRIGGER IF EXISTS trigger_cliente_envia_lista ON public.lotes_mensais;

-- Recriar função com lógica para INSERT e UPDATE
CREATE OR REPLACE FUNCTION public.notificar_cliente_envia_lista()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome_empresa TEXT;
BEGIN
  -- Para INSERT: verifica se o status inicial é 'validando'
  -- Para UPDATE: verifica se mudou para 'validando'
  IF (TG_OP = 'INSERT' AND NEW.status = 'validando') OR 
     (TG_OP = 'UPDATE' AND NEW.status = 'validando' AND (OLD.status IS NULL OR OLD.status != 'validando')) THEN
    
    -- Buscar nome da empresa
    SELECT nome INTO v_nome_empresa
    FROM empresas
    WHERE id = NEW.empresa_id;
    
    PERFORM criar_notificacao(
      'cliente_envia_lista',
      NEW.empresa_id,
      NEW.id,
      'admin',
      jsonb_build_object(
        'nome_empresa', v_nome_empresa,
        'competencia', NEW.competencia,
        'total_colaboradores', NEW.total_colaboradores,
        'obra_id', NEW.obra_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Criar trigger que funciona tanto para INSERT quanto UPDATE
CREATE TRIGGER trigger_cliente_envia_lista
AFTER INSERT OR UPDATE ON public.lotes_mensais
FOR EACH ROW
EXECUTE FUNCTION public.notificar_cliente_envia_lista();