-- Habilitar extensão pg_net se não estiver habilitada
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remover trigger anterior se existir
DROP TRIGGER IF EXISTS trigger_enviar_notificacao_webhook ON public.notificacoes;
DROP FUNCTION IF EXISTS public.enviar_notificacao_para_webhook();

-- Criar função que envia notificação para o webhook do n8n
CREATE OR REPLACE FUNCTION public.enviar_notificacao_para_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Envia a notificação para o webhook do n8n usando pg_net
  PERFORM net.http_post(
    url := 'https://grifoworkspace.app.n8n.cloud/webhook/vvbeneficios',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'id', NEW.id,
      'tipo', NEW.tipo,
      'empresa_id', NEW.empresa_id,
      'lote_id', NEW.lote_id,
      'obra_id', NEW.obra_id,
      'destinatario_role', NEW.destinatario_role,
      'email_destinatario', NEW.email_destinatario,
      'dados', NEW.dados,
      'enviado', NEW.enviado,
      'created_at', NEW.created_at
    )
  );
  
  RETURN NEW;
END;
$$;

-- Criar trigger que dispara após inserção de notificação
CREATE TRIGGER trigger_enviar_notificacao_webhook
  AFTER INSERT ON public.notificacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.enviar_notificacao_para_webhook();