-- Função para criar registro de apólice quando lote é concluído
CREATE OR REPLACE FUNCTION public.criar_apolice_ao_concluir_lote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_status empresa_status;
  v_total_colaboradores INTEGER;
BEGIN
  -- Verifica se o status mudou para 'concluido'
  IF NEW.status = 'concluido' AND (OLD.status IS NULL OR OLD.status != 'concluido') THEN
    
    -- Busca o status da empresa
    SELECT status INTO v_empresa_status
    FROM empresas
    WHERE id = NEW.empresa_id;
    
    -- Busca o total de colaboradores do lote
    SELECT COUNT(*) INTO v_total_colaboradores
    FROM colaboradores_lote
    WHERE lote_id = NEW.id;
    
    -- Verifica se a empresa está em implementação
    IF v_empresa_status = 'em_implementacao' THEN
      -- Cria ou atualiza o registro na tabela apolices
      INSERT INTO apolices (
        empresa_id,
        lote_id,
        numero_vidas_enviado,
        adendo_assinado,
        codigo_enviado,
        boas_vindas_enviado,
        numero_vidas_adendo,
        numero_vidas_vitalmed
      )
      VALUES (
        NEW.empresa_id,
        NEW.id,
        COALESCE(v_total_colaboradores, 0),
        false,
        false,
        false,
        0,
        0
      )
      ON CONFLICT (empresa_id, lote_id) 
      DO UPDATE SET
        numero_vidas_enviado = COALESCE(v_total_colaboradores, 0),
        updated_at = now();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para executar a função
DROP TRIGGER IF EXISTS trigger_criar_apolice_ao_concluir ON lotes_mensais;

CREATE TRIGGER trigger_criar_apolice_ao_concluir
AFTER INSERT OR UPDATE ON lotes_mensais
FOR EACH ROW
EXECUTE FUNCTION public.criar_apolice_ao_concluir_lote();