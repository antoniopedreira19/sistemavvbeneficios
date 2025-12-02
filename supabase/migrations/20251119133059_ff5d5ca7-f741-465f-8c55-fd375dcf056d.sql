-- Conceder acesso de leitura às empresas para usuários com role financeiro
CREATE POLICY "Financeiro pode ver todas empresas"
ON public.empresas
FOR SELECT
USING (has_role(auth.uid(), 'financeiro'::app_role));