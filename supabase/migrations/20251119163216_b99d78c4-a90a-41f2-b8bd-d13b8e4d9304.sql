-- Remove a constraint antiga que impede múltiplas obras da mesma empresa na mesma competência
ALTER TABLE lotes_mensais DROP CONSTRAINT IF EXISTS lotes_mensais_empresa_id_competencia_key;

-- Adiciona nova constraint que permite múltiplas obras, mas cada obra só pode ter um lote por competência
ALTER TABLE lotes_mensais ADD CONSTRAINT lotes_mensais_empresa_obra_competencia_key 
  UNIQUE (empresa_id, obra_id, competencia);