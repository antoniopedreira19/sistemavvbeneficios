-- Adicionar colunas JSON para múltiplos emails e telefones
ALTER TABLE empresas 
ADD COLUMN IF NOT EXISTS emails_contato jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS telefones_contato jsonb DEFAULT '[]'::jsonb;

-- Migrar dados existentes para os novos campos JSON
UPDATE empresas 
SET emails_contato = CASE 
  WHEN email_contato IS NOT NULL THEN jsonb_build_array(email_contato)
  ELSE '[]'::jsonb
END,
telefones_contato = CASE 
  WHEN telefone_contato IS NOT NULL THEN jsonb_build_array(telefone_contato)
  ELSE '[]'::jsonb
END
WHERE emails_contato = '[]'::jsonb OR telefones_contato = '[]'::jsonb;