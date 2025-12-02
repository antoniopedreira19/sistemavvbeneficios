-- Criar profile apenas para o usuário admin que existe
INSERT INTO profiles (id, nome, email, empresa_id)
VALUES (
  '12ecd9ad-8d52-4915-b6ce-3de10fd4dcbb',
  'Antonio',
  'antoniopvo19@gmail.com',
  NULL
)
ON CONFLICT (id) DO NOTHING;