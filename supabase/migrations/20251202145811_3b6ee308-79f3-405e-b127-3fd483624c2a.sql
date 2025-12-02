-- Trigger para sincronizar status da empresa quando status_crm for 'empresa_ativa'
CREATE OR REPLACE FUNCTION public.sincronizar_status_empresa_crm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Quando status_crm mudar para 'empresa_ativa', atualiza status para 'ativa'
  IF NEW.status_crm = 'empresa_ativa' AND NEW.status != 'ativa' THEN
    NEW.status := 'ativa';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar o trigger
DROP TRIGGER IF EXISTS trigger_sincronizar_status_crm ON empresas;
CREATE TRIGGER trigger_sincronizar_status_crm
  BEFORE UPDATE ON empresas
  FOR EACH ROW
  EXECUTE FUNCTION public.sincronizar_status_empresa_crm();

-- Atualizar empresas existentes que já estão com status_crm 'empresa_ativa' mas status diferente de 'ativa'
UPDATE empresas
SET status = 'ativa'
WHERE status_crm = 'empresa_ativa' AND status != 'ativa';