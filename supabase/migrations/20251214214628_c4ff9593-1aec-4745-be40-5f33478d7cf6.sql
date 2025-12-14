-- Convert responsavel_nome and responsavel_cpf from TEXT to JSONB arrays
-- This preserves existing data by wrapping single values in arrays

ALTER TABLE empresas 
  ALTER COLUMN responsavel_nome TYPE jsonb USING 
    CASE 
      WHEN responsavel_nome IS NOT NULL AND responsavel_nome != '' THEN jsonb_build_array(responsavel_nome)
      ELSE '[]'::jsonb 
    END,
  ALTER COLUMN responsavel_cpf TYPE jsonb USING 
    CASE 
      WHEN responsavel_cpf IS NOT NULL AND responsavel_cpf != '' THEN jsonb_build_array(responsavel_cpf)
      ELSE '[]'::jsonb 
    END;

-- Set default as empty arrays
ALTER TABLE empresas 
  ALTER COLUMN responsavel_nome SET DEFAULT '[]'::jsonb,
  ALTER COLUMN responsavel_cpf SET DEFAULT '[]'::jsonb;