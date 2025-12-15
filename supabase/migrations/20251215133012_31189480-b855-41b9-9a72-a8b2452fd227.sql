-- Remover função existente e recriar com novos parâmetros
DROP FUNCTION IF EXISTS public.get_empresas_pendentes(text);

CREATE OR REPLACE FUNCTION public.get_empresas_pendentes(p_competencia text)
 RETURNS TABLE(id uuid, nome text, cnpj text, email text, responsavel text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.nome, 
    e.cnpj,
    e.email_contato,
    CASE 
      WHEN jsonb_typeof(e.responsavel_nome) = 'array' THEN e.responsavel_nome->>0
      ELSE e.responsavel_nome::text
    END
  FROM empresas e
  WHERE e.status = 'ativa'
  AND NOT EXISTS (
    SELECT 1 
    FROM lotes_mensais lm 
    WHERE lm.empresa_id = e.id 
    AND lm.competencia = p_competencia
  );
END;
$function$;