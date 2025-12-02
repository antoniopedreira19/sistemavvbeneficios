-- Adicionar o status "concluido" ao enum lote_status
ALTER TYPE lote_status ADD VALUE IF NOT EXISTS 'concluido';