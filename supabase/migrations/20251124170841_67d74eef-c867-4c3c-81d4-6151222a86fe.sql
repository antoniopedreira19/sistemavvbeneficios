-- Adicionar política RLS para clientes poderem atualizar colaboradores de lote
CREATE POLICY "Cliente pode atualizar colaboradores de lote da sua empresa"
ON colaboradores_lote
FOR UPDATE
TO authenticated
USING (
  lote_id IN (
    SELECT id FROM lotes_mensais
    WHERE empresa_id IN (
      SELECT empresa_id FROM profiles
      WHERE id = auth.uid()
    )
  )
)
WITH CHECK (
  lote_id IN (
    SELECT id FROM lotes_mensais
    WHERE empresa_id IN (
      SELECT empresa_id FROM profiles
      WHERE id = auth.uid()
    )
  )
);