-- Calcular e preencher valor_total em lotes_mensais com base em precos_planos.valor × total_colaboradores
WITH precos_por_lote AS (
  SELECT lote_id, MAX(valor) AS valor_plano
  FROM precos_planos
  GROUP BY lote_id
)
UPDATE lotes_mensais lm
SET valor_total = COALESCE(pp.valor_plano, 0) * COALESCE(lm.total_colaboradores, 0)
FROM precos_por_lote pp
WHERE lm.id = pp.lote_id
  AND (lm.valor_total IS NULL OR lm.valor_total = 0);

-- Garantir que notas_fiscais.valor_total reflita o valor_total do lote correspondente
UPDATE notas_fiscais nf
SET valor_total = COALESCE(lm.valor_total, 0)
FROM lotes_mensais lm
WHERE nf.lote_id = lm.id;