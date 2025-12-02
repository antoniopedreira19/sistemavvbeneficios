-- Criar trigger para enviar notificações para o webhook quando inseridas
CREATE OR REPLACE FUNCTION public.enviar_notificacao_para_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Invoca a edge function para enviar a notificação para o webhook
  PERFORM net.http_post(
    url := (SELECT current_setting('app.settings.supabase_url', true) || '/functions/v1/enviar-notificacao-webhook'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT current_setting('app.settings.supabase_service_role_key', true))
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'notificacoes',
      'record', row_to_json(NEW)
    )
  );
  
  RETURN NEW;
END;
$$;

-- Drop o trigger se já existir
DROP TRIGGER IF EXISTS trigger_enviar_notificacao_webhook ON public.notificacoes;

-- Criar trigger que dispara após inserção de notificação
CREATE TRIGGER trigger_enviar_notificacao_webhook
  AFTER INSERT ON public.notificacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.enviar_notificacao_para_webhook();