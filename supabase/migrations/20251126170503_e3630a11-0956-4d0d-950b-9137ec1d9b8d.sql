-- ============================================
-- ATUALIZAÇÃO COMPLETA DO SISTEMA DE NOTIFICAÇÕES
-- Mapeia todo o fluxo cliente-admin com obra_id e dados completos
-- ============================================

-- ============================================
-- 1. CLIENTE ENVIA LISTA
-- Status: muda para "em_cotacao"
-- Notifica: admin
-- ============================================
-- JÁ ESTÁ CORRETO (notificar_cliente_envia_lista)

-- ============================================
-- 2. ADMIN CONFIRMA LISTA COM PREÇO
-- Status: "em_cotacao" -> "cotado"
-- Notifica: cliente
-- ============================================
-- JÁ ESTÁ CORRETO (notificar_admin_confirma_lista)

-- ============================================
-- 3. CLIENTE APROVA PREÇO
-- Status: "cotado" -> "aprovado"
-- Notifica: admin
-- ============================================
CREATE OR REPLACE FUNCTION public.notificar_cliente_aprova_preco()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_nome_empresa TEXT;
  v_nome_obra TEXT;
BEGIN
  IF NEW.status = 'aprovado' AND OLD.status = 'cotado' THEN
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
      'cliente_aprova_preco',
      NEW.empresa_id,
      NEW.id,
      'admin',
      jsonb_build_object(
        'nome_empresa', v_nome_empresa,
        'competencia', NEW.competencia,
        'valor_total', NEW.valor_total,
        'total_colaboradores', NEW.total_colaboradores,
        'nome_obra', COALESCE(v_nome_obra, 'Sem obra especificada')
      ),
      NEW.obra_id
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- ============================================
-- 4. ADMIN ENVIA PARA SEGURADORA
-- Status: "aprovado" -> "enviado"
-- Notifica: cliente
-- ============================================
CREATE OR REPLACE FUNCTION public.notificar_admin_envia_seguradora()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_nome_obra TEXT;
BEGIN
  IF NEW.status = 'enviado' AND OLD.status = 'aprovado' THEN
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

-- ============================================
-- 5. ADMIN GERENCIA APROVAÇÕES (primeira vez)
-- Status: "enviado" -> "aguardando_finalizacao"
-- Notifica: cliente
-- ============================================
CREATE OR REPLACE FUNCTION public.notificar_admin_gerencia_aprovacoes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_reprovados JSONB;
  v_nome_obra TEXT;
BEGIN
  IF NEW.status = 'aguardando_finalizacao' AND OLD.status = 'enviado' THEN
    -- Buscar lista de reprovados com nomes e motivos
    SELECT jsonb_agg(
      jsonb_build_object(
        'nome', nome,
        'cpf', cpf,
        'motivo', motivo_reprovacao_seguradora
      )
    ) INTO v_reprovados
    FROM colaboradores_lote
    WHERE lote_id = NEW.id
      AND status_seguradora = 'reprovado';
    
    -- Buscar nome da obra (se houver)
    IF NEW.obra_id IS NOT NULL THEN
      SELECT nome INTO v_nome_obra
      FROM obras
      WHERE id = NEW.obra_id;
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

-- ============================================
-- 6. CLIENTE CORRIGE E REENVIA REPROVADOS
-- Evento: colaboradores_lote com tentativa > 1 e status = 'pendente'
-- Notifica: admin
-- ============================================
CREATE OR REPLACE FUNCTION public.notificar_cliente_reenvia_reprovados()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_empresa_id UUID;
  v_competencia TEXT;
  v_count INTEGER;
  v_nome_empresa TEXT;
  v_obra_id UUID;
  v_nome_obra TEXT;
BEGIN
  -- Só dispara se for reenvio (tentativa > 1) e status pendente
  IF NEW.tentativa_reenvio > 1 AND NEW.status_seguradora = 'pendente' THEN
    -- Buscar dados do lote
    SELECT empresa_id, competencia, obra_id 
    INTO v_empresa_id, v_competencia, v_obra_id
    FROM lotes_mensais
    WHERE id = NEW.lote_id;
    
    -- Buscar nome da empresa
    SELECT nome INTO v_nome_empresa
    FROM empresas
    WHERE id = v_empresa_id;
    
    -- Buscar nome da obra (se houver)
    IF v_obra_id IS NOT NULL THEN
      SELECT nome INTO v_nome_obra
      FROM obras
      WHERE id = v_obra_id;
    END IF;
    
    -- Contar quantos colaboradores foram reenviados nesta tentativa
    SELECT COUNT(*) INTO v_count
    FROM colaboradores_lote
    WHERE lote_id = NEW.lote_id
      AND tentativa_reenvio = NEW.tentativa_reenvio
      AND status_seguradora = 'pendente';
    
    -- Criar notificação apenas uma vez por lote/tentativa
    IF NOT EXISTS (
      SELECT 1 FROM notificacoes
      WHERE tipo = 'cliente_reenvia_reprovados'
        AND lote_id = NEW.lote_id
        AND dados->>'tentativa_reenvio' = NEW.tentativa_reenvio::text
    ) THEN
      PERFORM criar_notificacao(
        'cliente_reenvia_reprovados',
        v_empresa_id,
        NEW.lote_id,
        'admin',
        jsonb_build_object(
          'nome_empresa', v_nome_empresa,
          'competencia', v_competencia,
          'tentativa_reenvio', NEW.tentativa_reenvio,
          'total_corrigidos', v_count,
          'nome_obra', COALESCE(v_nome_obra, 'Sem obra especificada')
        ),
        v_obra_id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- ============================================
-- 7. ADMIN ENVIA REENVIOS PARA SEGURADORA
-- Evento: colaboradores_lote tentativa > 1 muda 'pendente' -> 'enviado'
-- Notifica: cliente
-- ============================================
CREATE OR REPLACE FUNCTION public.notificar_admin_envia_reenvios()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_empresa_id UUID;
  v_competencia TEXT;
  v_count INTEGER;
  v_obra_id UUID;
  v_nome_obra TEXT;
BEGIN
  -- Só dispara se for reenvio e status mudou para enviado
  IF NEW.tentativa_reenvio > 1 AND NEW.status_seguradora = 'enviado' AND OLD.status_seguradora = 'pendente' THEN
    -- Buscar dados do lote
    SELECT empresa_id, competencia, obra_id 
    INTO v_empresa_id, v_competencia, v_obra_id
    FROM lotes_mensais
    WHERE id = NEW.lote_id;
    
    -- Buscar nome da obra (se houver)
    IF v_obra_id IS NOT NULL THEN
      SELECT nome INTO v_nome_obra
      FROM obras
      WHERE id = v_obra_id;
    END IF;
    
    -- Contar quantos colaboradores foram enviados nesta tentativa
    SELECT COUNT(*) INTO v_count
    FROM colaboradores_lote
    WHERE lote_id = NEW.lote_id
      AND tentativa_reenvio = NEW.tentativa_reenvio
      AND status_seguradora = 'enviado';
    
    -- Criar notificação apenas uma vez por lote/tentativa
    IF NOT EXISTS (
      SELECT 1 FROM notificacoes
      WHERE tipo = 'admin_envia_reenvios'
        AND lote_id = NEW.lote_id
        AND dados->>'tentativa_reenvio' = NEW.tentativa_reenvio::text
    ) THEN
      PERFORM criar_notificacao(
        'admin_envia_reenvios',
        v_empresa_id,
        NEW.lote_id,
        'cliente',
        jsonb_build_object(
          'competencia', v_competencia,
          'tentativa_reenvio', NEW.tentativa_reenvio,
          'total_enviados', v_count,
          'nome_obra', COALESCE(v_nome_obra, 'Sem obra especificada')
        ),
        v_obra_id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- ============================================
-- 8. ADMIN GERENCIA REENVIOS (aprovações de reenvios)
-- Evento: colaboradores_lote tentativa > 1 muda 'enviado' -> 'aprovado'/'reprovado'
-- Notifica: cliente
-- ============================================
CREATE OR REPLACE FUNCTION public.notificar_admin_gerencia_reenvios()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_empresa_id UUID;
  v_competencia TEXT;
  v_aprovados INTEGER;
  v_reprovados INTEGER;
  v_reprovados_list JSONB;
  v_obra_id UUID;
  v_nome_obra TEXT;
BEGIN
  -- Dispara quando status_seguradora muda para aprovado ou reprovado em reenvios
  IF NEW.tentativa_reenvio > 1 AND 
     (NEW.status_seguradora IN ('aprovado', 'reprovado')) AND 
     (OLD.status_seguradora = 'enviado') THEN
    
    -- Buscar dados do lote
    SELECT empresa_id, competencia, obra_id 
    INTO v_empresa_id, v_competencia, v_obra_id
    FROM lotes_mensais
    WHERE id = NEW.lote_id;
    
    -- Buscar nome da obra (se houver)
    IF v_obra_id IS NOT NULL THEN
      SELECT nome INTO v_nome_obra
      FROM obras
      WHERE id = v_obra_id;
    END IF;
    
    -- Contar aprovados e reprovados desta tentativa
    SELECT 
      COUNT(*) FILTER (WHERE status_seguradora = 'aprovado'),
      COUNT(*) FILTER (WHERE status_seguradora = 'reprovado')
    INTO v_aprovados, v_reprovados
    FROM colaboradores_lote
    WHERE lote_id = NEW.lote_id
      AND tentativa_reenvio = NEW.tentativa_reenvio;
    
    -- Buscar lista de reprovados
    SELECT jsonb_agg(
      jsonb_build_object(
        'nome', nome,
        'cpf', cpf,
        'motivo', motivo_reprovacao_seguradora
      )
    ) INTO v_reprovados_list
    FROM colaboradores_lote
    WHERE lote_id = NEW.lote_id
      AND tentativa_reenvio = NEW.tentativa_reenvio
      AND status_seguradora = 'reprovado';
    
    -- Criar notificação apenas uma vez por lote/tentativa
    IF NOT EXISTS (
      SELECT 1 FROM notificacoes
      WHERE tipo = 'admin_gerencia_reenvios'
        AND lote_id = NEW.lote_id
        AND dados->>'tentativa_reenvio' = NEW.tentativa_reenvio::text
    ) THEN
      PERFORM criar_notificacao(
        'admin_gerencia_reenvios',
        v_empresa_id,
        NEW.lote_id,
        'cliente',
        jsonb_build_object(
          'competencia', v_competencia,
          'tentativa_reenvio', NEW.tentativa_reenvio,
          'total_aprovados', v_aprovados,
          'total_reprovados', v_reprovados,
          'reprovados', COALESCE(v_reprovados_list, '[]'::jsonb),
          'nome_obra', COALESCE(v_nome_obra, 'Sem obra especificada')
        ),
        v_obra_id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- ============================================
-- 9. ADMIN FINALIZA LOTE
-- Status: "aguardando_finalizacao" -> "concluido"
-- Notifica: cliente
-- ============================================
CREATE OR REPLACE FUNCTION public.notificar_admin_finaliza_lote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_nome_obra TEXT;
BEGIN
  IF NEW.status = 'concluido' AND OLD.status = 'aguardando_finalizacao' THEN
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