-- Remove a constraint antiga que está causando o erro
ALTER TABLE colaboradores_lote DROP CONSTRAINT IF EXISTS colaboradores_lote_status_seguradora_check;

-- Adiciona uma nova constraint com todos os valores permitidos
ALTER TABLE colaboradores_lote 
ADD CONSTRAINT colaboradores_lote_status_seguradora_check 
CHECK (status_seguradora IN ('pendente', 'aprovado', 'reprovado', 'reenviado'));

-- Cria um comentário explicativo
COMMENT ON COLUMN colaboradores_lote.status_seguradora IS 'Status do colaborador na seguradora: pendente (aguardando validação), aprovado (aceito pela seguradora), reprovado (rejeitado pela seguradora), reenviado (reprovado que foi corrigido e reenviado)';