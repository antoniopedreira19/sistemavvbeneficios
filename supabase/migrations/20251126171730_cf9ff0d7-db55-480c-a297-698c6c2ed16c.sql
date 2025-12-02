-- Atualizar a função criar_notificacao para buscar email corretamente
CREATE OR REPLACE FUNCTION public.criar_notificacao(
  p_tipo text, 
  p_empresa_id uuid, 
  p_lote_id uuid, 
  p_destinatario_role text, 
  p_dados jsonb DEFAULT '{}'::jsonb, 
  p_obra_id uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notificacao_id UUID;
  v_email_destinatario TEXT;
BEGIN
  -- Determinar o email do destinatário baseado no role
  IF p_destinatario_role = 'admin' THEN
    v_email_destinatario := 'antoniopvo19@gmail.com';
  ELSIF p_destinatario_role = 'cliente' THEN
    -- Buscar email_contato da empresa
    SELECT email_contato INTO v_email_destinatario
    FROM empresas
    WHERE id = p_empresa_id;
    
    -- Se email_contato estiver NULL, buscar email do profile do usuário da empresa
    IF v_email_destinatario IS NULL THEN
      SELECT email INTO v_email_destinatario
      FROM profiles
      WHERE empresa_id = p_empresa_id
      LIMIT 1;
    END IF;
  END IF;
  
  INSERT INTO notificacoes (tipo, empresa_id, lote_id, destinatario_role, dados, obra_id, email_destinatario)
  VALUES (p_tipo, p_empresa_id, p_lote_id, p_destinatario_role, p_dados, p_obra_id, v_email_destinatario)
  RETURNING id INTO v_notificacao_id;
  
  RETURN v_notificacao_id;
END;
$$;