-- Update companies with extracted contract data (Batch 3 of 4)

-- 41. SOLUÇÕES PREDIAIS
UPDATE empresas SET 
  endereco = 'Rua Marquês de Monte Santo, 44, Sala 502, Ed. Camaçari, Rio Vermelho, Salvador-BA',
  responsavel_nome = '["Jameson Salis Costa Loura"]'::jsonb,
  responsavel_cpf = '["79389163591"]'::jsonb
WHERE cnpj = '20929604000188';

-- 42. SUPRICEL
UPDATE empresas SET 
  endereco = 'Av. Luís Viana Filho, 9900, Sala 403/404, Centro Empresarial Paralela, Paralela, Salvador-BA',
  responsavel_nome = '["Karla Sueli Lisboa de Souza"]'::jsonb,
  responsavel_cpf = '["71058346534"]'::jsonb
WHERE cnpj = '73568284000155';

-- 43. VB ENGENHARIA
UPDATE empresas SET 
  endereco = 'Av. Dom João VI, 138, Brotas, Salvador-BA',
  responsavel_nome = '["Valter Sena Bonfim"]'::jsonb,
  responsavel_cpf = '["14212471587"]'::jsonb
WHERE cnpj = '05188247000172';

-- 44. VDF CONSTRUTORA
UPDATE empresas SET 
  endereco = 'Rua Vergueiro, 2949, Cjto. 707, Vila Mariana, São Paulo-SP',
  responsavel_nome = '["Flávio Castro de Figueiredo"]'::jsonb,
  responsavel_cpf = '["17282102844"]'::jsonb
WHERE cnpj = '20148016000188';

-- 45. VICLA
UPDATE empresas SET 
  endereco = 'AV. Dom João VI, 1341/1343, Brotas, Salvador-BA',
  responsavel_nome = '["Pablo Claudio Cardoso Souza"]'::jsonb,
  responsavel_cpf = '["42299390549"]'::jsonb
WHERE cnpj = '03656461000160';

-- 46. VIRGINIA
UPDATE empresas SET 
  endereco = 'Rua Miguel Calmon, 555, Ed. Suarez Trade, sala 614, Comércio, Salvador-BA',
  responsavel_nome = '["Lucia Maria Malta Neto"]'::jsonb,
  responsavel_cpf = '["12261971591"]'::jsonb
WHERE cnpj = '03604810000166';

-- 47. VIVIA CONSTRUTORA
UPDATE empresas SET 
  endereco = 'Rua da Graviola, 126, Ed. Metropolis, Sala 1205, Caminho das Árvores, Salvador-BA',
  responsavel_nome = '["Cleiton Figueiredo dos Santos"]'::jsonb,
  responsavel_cpf = '["72457091591"]'::jsonb
WHERE cnpj = '36389355000120';

-- 48. VL ENGENHARIA
UPDATE empresas SET 
  endereco = 'Av. Tancredo Neves, 805, sala 101, Loja 14, Caminho das Árvores, Salvador-BA',
  responsavel_nome = '["Vinícius Lins Nascimento"]'::jsonb,
  responsavel_cpf = '["97693758504"]'::jsonb
WHERE cnpj = '37506159000131';

-- 49. VITALE ENGENHARIA
UPDATE empresas SET 
  endereco = 'Av. Tancredo Neves, 805, Ed. Esplanada Tower, Sala 704, Caminho das Árvores, Salvador-BA',
  responsavel_nome = '["Pedro Paulo Bulhões Cerqueira"]'::jsonb,
  responsavel_cpf = '["75912317534"]'::jsonb
WHERE cnpj = '26867178000100';

-- 50. VP FIOS CABOS
UPDATE empresas SET 
  endereco = 'Rua Humberto de Campos, 218, Galpão E, Centro, Simões Filho-BA',
  responsavel_nome = '["Victor Bruno Peixoto Santos"]'::jsonb,
  responsavel_cpf = '["02765116543"]'::jsonb
WHERE cnpj = '44285818000175';

-- 51. WG CONSTRUÇÕES (apenas endereço - sem CPF válido)
UPDATE empresas SET 
  endereco = 'Av. Tancredo Neves, 3343, Sl. 1404, Ed. Cempre, Caminho das Árvores, Salvador-BA'
WHERE cnpj = '09044478000171';

-- 52. WORKPOWER
UPDATE empresas SET 
  endereco = 'Av. Jorge Amado, 219, Torre A, Sala 1602, Imbuí, Salvador-BA',
  responsavel_nome = '["Marcone de Sousa Moura"]'::jsonb,
  responsavel_cpf = '["65420179172"]'::jsonb
WHERE cnpj = '07127579000180';

-- 53. WRS ENGENHARIA
UPDATE empresas SET 
  endereco = 'Rua Dr. José Peroba, 275, Sala 415, Ed. Metropolis, Stiep, Salvador-BA',
  responsavel_nome = '["Wilton Ramos de Souza"]'::jsonb,
  responsavel_cpf = '["59177128520"]'::jsonb
WHERE cnpj = '08296310000141';

-- EMPRESAS COM APENAS ENDEREÇO (referência a estatuto, sem CPF válido)

-- 54. INSTITUTO ACARAJÉ
UPDATE empresas SET 
  endereco = 'Av. Dom João VI, 134, Brotas, Salvador-BA'
WHERE cnpj = '03982704000130';

-- 55. SOS ELÉTRICA
UPDATE empresas SET 
  endereco = 'Av. Antônio Carlos Magalhães, 3213, Sala 1215, Centro Empresarial CEO Salvador Shopping, Salvador-BA'
WHERE cnpj = '22935009000103';