-- Remove trigger obsoleta que referencia status_crm (que não existe mais)
DROP TRIGGER IF EXISTS trigger_sincronizar_status_crm ON public.empresas;

-- Remove a função obsoleta também
DROP FUNCTION IF EXISTS public.sincronizar_status_empresa_crm();