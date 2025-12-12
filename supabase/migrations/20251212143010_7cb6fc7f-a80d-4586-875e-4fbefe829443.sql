
-- Excluir colaboradores duplicados da AD LOCAÇÕES, mantendo apenas os 2 corretos
DELETE FROM colaboradores
WHERE empresa_id = '0b3eb268-1b7c-4143-8472-df0394d93794'
AND cpf NOT IN ('07602945506', '02110749504');
