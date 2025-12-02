-- Drop existing trigger
DROP TRIGGER IF EXISTS trigger_cliente_envia_lista ON public.lotes_mensais;

-- Update function to watch for em_cotacao status
CREATE OR REPLACE FUNCTION public.notificar_cliente_envia_lista()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_nome_empresa TEXT;
BEGIN
  -- Para INSERT: verifica se o status inicial é 'em_cotacao'
  -- Para UPDATE: verifica se mudou para 'em_cotacao'
  IF (TG_OP = 'INSERT' AND NEW.status = 'em_cotacao') OR 
     (TG_OP = 'UPDATE' AND NEW.status = 'em_cotacao' AND (OLD.status IS NULL OR OLD.status != 'em_cotacao')) THEN
    
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
$function$;

-- Recreate trigger with INSERT and UPDATE
CREATE TRIGGER trigger_cliente_envia_lista
  AFTER INSERT OR UPDATE ON public.lotes_mensais
  FOR EACH ROW
  EXECUTE FUNCTION public.notificar_cliente_envia_lista();