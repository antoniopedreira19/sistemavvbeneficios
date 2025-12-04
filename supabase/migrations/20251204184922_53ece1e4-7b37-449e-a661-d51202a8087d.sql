-- Verificar e corrigir triggers que usam valores antigos do enum

-- Atualizar a função notificar_cliente_envia_lista para usar os novos status
CREATE OR REPLACE FUNCTION public.notificar_cliente_envia_lista()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_nome_empresa TEXT;
  v_nome_obra TEXT;
BEGIN
  -- Mudou de 'em_cotacao' para 'aguardando_processamento' (novo fluxo BPO)
  IF (TG_OP = 'INSERT' AND NEW.status = 'aguardando_processamento') OR 
     (TG_OP = 'UPDATE' AND NEW.status = 'aguardando_processamento' AND (OLD.status IS NULL OR OLD.status != 'aguardando_processamento')) THEN
    
    -- Buscar nome da empresa
    SELECT nome INTO v_nome_empresa
    FROM empresas
    WHERE id = NEW.empresa_id;
    
    -- Buscar nome da obra (se houver)
    IF NEW.obra_id IS NOT NULL THEN
      SELECT nome INTO v_nome_obra
      FROM obras
      WHERE id = NEW.obra_id;
    END IF;
    
    PERFORM criar_notificacao(
      'cliente_envia_lista',
      NEW.empresa_id,
      NEW.id,
      'admin',
      jsonb_build_object(
        'nome_empresa', v_nome_empresa,
        'competencia', NEW.competencia,
        'total_colaboradores', NEW.total_colaboradores,
        'nome_obra', COALESCE(v_nome_obra, 'Sem obra especificada')
      ),
      NEW.obra_id
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- Atualizar a função notificar_admin_confirma_lista para usar os novos status
CREATE OR REPLACE FUNCTION public.notificar_admin_confirma_lista()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_valor_plano NUMERIC;
  v_nome_obra   TEXT;
BEGIN
  -- Mudou de 'cotado' e 'em_cotacao' para novos status do BPO
  IF NEW.status = 'em_analise_seguradora' AND OLD.status = 'aguardando_processamento' THEN
    -- Valor do plano (se existir)
    SELECT valor
      INTO v_valor_plano
      FROM precos_planos
     WHERE lote_id = NEW.id
     LIMIT 1;

    -- Nome da obra (se houver obra vinculada)
    IF NEW.obra_id IS NOT NULL THEN
      SELECT nome
        INTO v_nome_obra
        FROM obras
       WHERE id = NEW.obra_id;
    END IF;

    PERFORM criar_notificacao(
      'admin_confirma_lista',
      NEW.empresa_id,
      NEW.id,
      'cliente',
      jsonb_build_object(
        'competencia',         NEW.competencia,
        'total_colaboradores', NEW.total_colaboradores,
        'valor_plano',         COALESCE(v_valor_plano, 0),
        'valor_total',         NEW.valor_total,
        'nome_obra',           COALESCE(v_nome_obra, 'Sem obra especificada')
      ),
      NEW.obra_id
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- Atualizar a função notificar_cliente_aprova_preco para usar os novos status
CREATE OR REPLACE FUNCTION public.notificar_cliente_aprova_preco()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_nome_empresa TEXT;
  v_nome_obra TEXT;
BEGIN
  -- No novo fluxo BPO, essa notificação não é mais necessária
  -- Mantendo a função mas sem ação (o fluxo agora é direto: processamento -> análise -> conclusão)
  RETURN NEW;
END;
$function$;

-- Atualizar a função notificar_admin_envia_seguradora para usar os novos status
CREATE OR REPLACE FUNCTION public.notificar_admin_envia_seguradora()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_nome_obra TEXT;
BEGIN
  -- Mudou de 'enviado' e 'aprovado' para novos status
  IF NEW.status = 'em_analise_seguradora' AND OLD.status = 'aguardando_processamento' THEN
    -- Buscar nome da obra (se houver)
    IF NEW.obra_id IS NOT NULL THEN
      SELECT nome INTO v_nome_obra
      FROM obras
      WHERE id = NEW.obra_id;
    END IF;
    
    PERFORM criar_notificacao(
      'admin_envia_seguradora',
      NEW.empresa_id,
      NEW.id,
      'cliente',
      jsonb_build_object(
        'competencia', NEW.competencia,
        'total_colaboradores', NEW.total_colaboradores,
        'nome_obra', COALESCE(v_nome_obra, 'Sem obra especificada')
      ),
      NEW.obra_id
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- Atualizar a função notificar_admin_gerencia_aprovacoes para usar os novos status
CREATE OR REPLACE FUNCTION public.notificar_admin_gerencia_aprovacoes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_reprovados JSONB;
  v_nome_obra TEXT;
BEGIN
  -- Mudou de 'enviado' para 'em_analise_seguradora' e 'aguardando_correcao' para 'com_pendencia'
  IF NEW.status = 'com_pendencia' AND OLD.status = 'em_analise_seguradora' THEN
    SELECT jsonb_agg(
      jsonb_build_object('nome', nome, 'cpf', cpf, 'motivo', motivo_reprovacao_seguradora)
    )
    INTO v_reprovados
    FROM colaboradores_lote
    WHERE lote_id = NEW.id
      AND status_seguradora = 'reprovado';

    IF NEW.obra_id IS NOT NULL THEN
      SELECT nome INTO v_nome_obra FROM obras WHERE id = NEW.obra_id;
    END IF;

    PERFORM criar_notificacao(
      'admin_gerencia_aprovacoes',
      NEW.empresa_id,
      NEW.id,
      'cliente',
      jsonb_build_object(
        'competencia', NEW.competencia,
        'total_aprovados', NEW.total_aprovados,
        'total_reprovados', NEW.total_reprovados,
        'reprovados', COALESCE(v_reprovados, '[]'::jsonb),
        'nome_obra', COALESCE(v_nome_obra, 'Sem obra especificada')
      ),
      NEW.obra_id
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- Atualizar a função notificar_admin_finaliza_lote para usar os novos status
CREATE OR REPLACE FUNCTION public.notificar_admin_finaliza_lote()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_nome_obra TEXT;
BEGIN
  -- Mudou de 'aguardando_finalizacao' para 'em_analise_seguradora'
  IF NEW.status = 'concluido' AND OLD.status = 'em_analise_seguradora' THEN
    -- Buscar nome da obra (se houver)
    IF NEW.obra_id IS NOT NULL THEN
      SELECT nome INTO v_nome_obra
      FROM obras
      WHERE id = NEW.obra_id;
    END IF;
    
    PERFORM criar_notificacao(
      'admin_finaliza_lote',
      NEW.empresa_id,
      NEW.id,
      'cliente',
      jsonb_build_object(
        'competencia', NEW.competencia,
        'total_aprovados', NEW.total_aprovados,
        'valor_total', NEW.valor_total,
        'nome_obra', COALESCE(v_nome_obra, 'Sem obra especificada')
      ),
      NEW.obra_id
    );
  END IF;
  RETURN NEW;
END;
$function$;