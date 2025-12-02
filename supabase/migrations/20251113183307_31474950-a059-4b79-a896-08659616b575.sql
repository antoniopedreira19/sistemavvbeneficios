-- Adicionar novo tipo de usuário "operacional" ao enum app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'operacional';

-- Atualizar políticas RLS para incluir operacional com acesso semelhante ao admin

-- COLABORADORES
DROP POLICY IF EXISTS "Admin pode gerenciar todos colaboradores" ON public.colaboradores;
DROP POLICY IF EXISTS "Admin pode ver todos colaboradores" ON public.colaboradores;

CREATE POLICY "Admin e Operacional podem gerenciar todos colaboradores" 
ON public.colaboradores 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role));

CREATE POLICY "Admin e Operacional podem ver todos colaboradores" 
ON public.colaboradores 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role));

-- COLABORADORES_LOTE
DROP POLICY IF EXISTS "Admin pode gerenciar todos colaboradores de lote" ON public.colaboradores_lote;
DROP POLICY IF EXISTS "Admin pode ver todos colaboradores de lote" ON public.colaboradores_lote;

CREATE POLICY "Admin e Operacional podem gerenciar todos colaboradores de lote" 
ON public.colaboradores_lote 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role));

CREATE POLICY "Admin e Operacional podem ver todos colaboradores de lote" 
ON public.colaboradores_lote 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role));

-- EMPRESAS
DROP POLICY IF EXISTS "Admin pode gerenciar empresas" ON public.empresas;
DROP POLICY IF EXISTS "Admin pode ver todas empresas" ON public.empresas;

CREATE POLICY "Admin e Operacional podem gerenciar empresas" 
ON public.empresas 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role));

CREATE POLICY "Admin e Operacional podem ver todas empresas" 
ON public.empresas 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role));

-- HISTORICO_LOGS
DROP POLICY IF EXISTS "Admin pode ver todos logs" ON public.historico_logs;

CREATE POLICY "Admin e Operacional podem ver todos logs" 
ON public.historico_logs 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role));

-- LOTES_MENSAIS
DROP POLICY IF EXISTS "Admin pode gerenciar todos lotes" ON public.lotes_mensais;
DROP POLICY IF EXISTS "Admin pode ver todos lotes" ON public.lotes_mensais;

CREATE POLICY "Admin e Operacional podem gerenciar todos lotes" 
ON public.lotes_mensais 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role));

CREATE POLICY "Admin e Operacional podem ver todos lotes" 
ON public.lotes_mensais 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role));

-- PRECOS_PLANOS
DROP POLICY IF EXISTS "Admin pode gerenciar preços" ON public.precos_planos;

CREATE POLICY "Admin e Operacional podem gerenciar preços" 
ON public.precos_planos 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role));

-- PROFILES
DROP POLICY IF EXISTS "Admin pode gerenciar perfis" ON public.profiles;
DROP POLICY IF EXISTS "Admin pode ver todos perfis" ON public.profiles;

CREATE POLICY "Admin e Operacional podem gerenciar perfis" 
ON public.profiles 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role));

CREATE POLICY "Admin e Operacional podem ver todos perfis" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role));

-- USER_ROLES
DROP POLICY IF EXISTS "Admin pode gerenciar roles" ON public.user_roles;

CREATE POLICY "Admin e Operacional podem gerenciar roles" 
ON public.user_roles 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role));