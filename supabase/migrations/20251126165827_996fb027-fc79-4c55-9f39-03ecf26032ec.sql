-- Ajustar função para notificar quando o admin confirma a "cotação" (confirmação de lista)
CREATE OR REPLACE FUNCTION public.notificar_admin_confirma_lista()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_valor_plano NUMERIC;
BEGIN
  -- Dispara quando o lote sai de em_cotacao e vai para cotado (aguardando aprovação do cliente)
  IF NEW.status = 'cotado' AND OLD.status = 'em_cotacao' THEN
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
      ),
      NEW.obra_id
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- Garantir que exista o trigger ligado à tabela lotes_mensais
DROP TRIGGER IF EXISTS trigger_admin_confirma_lista ON public.lotes_mensais;

CREATE TRIGGER trigger_admin_confirma_lista
AFTER UPDATE ON public.lotes_mensais
FOR EACH ROW
EXECUTE FUNCTION public.notificar_admin_confirma_lista();