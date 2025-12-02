-- Adicionar novo status "aguardando_finalizacao" ao enum lote_status
ALTER TYPE lote_status ADD VALUE IF NOT EXISTS 'aguardando_finalizacao';