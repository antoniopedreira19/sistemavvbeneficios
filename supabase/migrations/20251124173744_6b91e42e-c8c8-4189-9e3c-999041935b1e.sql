-- Remover a constraint única que impede múltiplos lotes para mesma empresa/obra/competência
ALTER TABLE lotes_mensais DROP CONSTRAINT IF EXISTS lotes_mensais_empresa_obra_competencia_key;

-- Criar uma constraint única apenas para lotes principais (não sublotes)
CREATE UNIQUE INDEX lotes_mensais_empresa_obra_competencia_unique 
ON lotes_mensais (empresa_id, obra_id, competencia) 
WHERE lote_pai_id IS NULL;