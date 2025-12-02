-- Remover a constraint antiga
ALTER TABLE empresas DROP CONSTRAINT IF EXISTS empresas_status_crm_check;

-- Adicionar a nova constraint incluindo 'sem_retorno'
ALTER TABLE empresas ADD CONSTRAINT empresas_status_crm_check 
CHECK (status_crm IN ('sem_retorno', 'tratativa', 'contrato_assinado', 'apolices_emitida', 'acolhimento', 'empresa_ativa'));