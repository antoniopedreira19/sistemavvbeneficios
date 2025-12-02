-- Add CRM status to empresas table
ALTER TABLE public.empresas 
ADD COLUMN status_crm text NOT NULL DEFAULT 'tratativa';

-- Add constraint for valid CRM status values
ALTER TABLE public.empresas 
ADD CONSTRAINT empresas_status_crm_check 
CHECK (status_crm IN ('tratativa', 'contrato_assinado', 'apolices_emitida', 'acolhimento', 'empresa_ativa'));

-- Update existing companies based on their current status
UPDATE public.empresas 
SET status_crm = CASE 
  WHEN status = 'ativa' THEN 'empresa_ativa'
  ELSE 'tratativa'
END;