-- Add celular column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS celular text;

-- Add RLS policy to allow clients to update their company information
CREATE POLICY "Cliente pode atualizar sua empresa"
ON public.empresas
FOR UPDATE
TO authenticated
USING (id IN (
  SELECT empresa_id 
  FROM public.profiles 
  WHERE id = auth.uid()
))
WITH CHECK (id IN (
  SELECT empresa_id 
  FROM public.profiles 
  WHERE id = auth.uid()
));