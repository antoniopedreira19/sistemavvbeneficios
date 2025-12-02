-- Adicionar política RLS para clientes poderem inserir colaboradores de lote
DROP POLICY IF EXISTS "Sistema pode inserir colaboradores de lote" ON colaboradores_lote;

CREATE POLICY "Cliente pode inserir colaboradores de lote da sua empresa"
ON colaboradores_lote
FOR INSERT
TO authenticated
WITH CHECK (
  lote_id IN (
    SELECT id FROM lotes_mensais
    WHERE empresa_id IN (
      SELECT empresa_id FROM profiles
      WHERE id = auth.uid()
    )
  )
);