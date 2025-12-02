-- Função para atualizar status da empresa quando nota fiscal é emitida
CREATE OR REPLACE FUNCTION public.atualizar_empresa_ao_emitir_nf()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verifica se nf_emitida mudou para true
  IF NEW.nf_emitida = true AND (OLD.nf_emitida IS NULL OR OLD.nf_emitida = false) THEN
    -- Atualiza o status da empresa para 'ativa'
    UPDATE empresas
    SET status = 'ativa'
    WHERE id = NEW.empresa_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para atualizar empresa quando nota fiscal é emitida
DROP TRIGGER IF EXISTS trigger_atualizar_empresa_ao_emitir_nf ON notas_fiscais;

CREATE TRIGGER trigger_atualizar_empresa_ao_emitir_nf
  AFTER UPDATE ON notas_fiscais
  FOR EACH ROW
  EXECUTE FUNCTION public.atualizar_empresa_ao_emitir_nf();