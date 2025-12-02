-- Adiciona novo status ao enum lote_status para quando houver reprovados
ALTER TYPE lote_status ADD VALUE IF NOT EXISTS 'aguardando_correcao';

-- Comentário explicativo: Este status indica que o lote tem colaboradores reprovados
-- aguardando correção e reenvio pelo cliente