
-- Remove registros duplicados do lote AD LOCAÇÕES
-- Mantém apenas os 2 colaboradores corretos: JAILSON e ADRIANO
DELETE FROM colaboradores_lote
WHERE lote_id = 'a7fb6baa-dac2-4e2a-a242-acad2fc0a9ac'
AND cpf NOT IN ('07602945506', '02110749504');
