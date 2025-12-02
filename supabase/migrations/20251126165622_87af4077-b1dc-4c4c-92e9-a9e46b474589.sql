-- Adicionar coluna email_destinatario na tabela notificacoes
ALTER TABLE public.notificacoes 
ADD COLUMN email_destinatario text;

-- Atualizar a função criar_notificacao para incluir email do destinatário
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
  v_email_destinatario TEXT;
BEGIN
  -- Determinar o email do destinatário baseado no role
  IF p_destinatario_role = 'admin' THEN
    v_email_destinatario := 'antoniopvo19@gmail.com';
  ELSIF p_destinatario_role = 'cliente' THEN
    SELECT email_contato INTO v_email_destinatario
    FROM empresas
    WHERE id = p_empresa_id;
  END IF;
  
  INSERT INTO notificacoes (tipo, empresa_id, lote_id, destinatario_role, dados, obra_id, email_destinatario)
  VALUES (p_tipo, p_empresa_id, p_lote_id, p_destinatario_role, p_dados, p_obra_id, v_email_destinatario)
  RETURNING id INTO v_notificacao_id;
  
  RETURN v_notificacao_id;
END;
$function$;