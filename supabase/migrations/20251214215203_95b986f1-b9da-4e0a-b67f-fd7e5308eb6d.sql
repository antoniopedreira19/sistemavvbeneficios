-- Fix: Update companies with formatted CNPJs (Batch 1 of 3)

-- 1. AD LOCAÇÕES
UPDATE empresas SET 
  endereco = 'Av Ulysses Guimarães, 4295, Sala 203, Sussuarana, Salvador-BA',
  responsavel_nome = '["Ana Carolina Deichsel"]'::jsonb,
  responsavel_cpf = '["09518602590"]'::jsonb
WHERE cnpj = '47.018.586/0001-85';

-- 2. ALLPHA TECH
UPDATE empresas SET 
  endereco = 'Travessa Caio Gomes, 24, Centro, Simões Filho-BA',
  responsavel_nome = '["Diana Souza de Jesus"]'::jsonb,
  responsavel_cpf = '["04831166504"]'::jsonb
WHERE cnpj = '40.285.878/0001-37';

-- 3. ATL
UPDATE empresas SET 
  endereco = 'Estrada do CIA Sul, Quadra G4, Lotes 6, 7, 8, 9, 10 e 11, Galpão Número 04, CIA Sul, Simões Filho-BA',
  responsavel_nome = '["Antonio Nelson de Magalhães Soares"]'::jsonb,
  responsavel_cpf = '["34114351549"]'::jsonb
WHERE cnpj = '17.200.765/0001-98';

-- 4. BCN CONSTRUÇÕES
UPDATE empresas SET 
  endereco = 'R. Almirante Tamandaré, 45/403, Edifício Mabú, Comércio, Salvador-BA',
  responsavel_nome = '["Bruno Cortes Nascimento"]'::jsonb,
  responsavel_cpf = '["95392548504"]'::jsonb
WHERE cnpj = '18.124.168/0001-48';

-- 5. BRISA
UPDATE empresas SET 
  endereco = 'Rua Cônego Pereira, 166, Brotas, Salvador-BA',
  responsavel_nome = '["Luiz Henrique Fernandes Silva"]'::jsonb,
  responsavel_cpf = '["00657866571"]'::jsonb
WHERE cnpj = '30.177.255/0001-81';

-- 6. CALDERVOL (múltiplos responsáveis)
UPDATE empresas SET 
  endereco = 'Estrada Simões Filho Água Comprida, 101, Galpão I, Módulo C, CEP 43.700-000, Simões Filho-BA',
  responsavel_nome = '["Camila de Lacerda Bastos", "Mateus de Lacerda Bastos"]'::jsonb,
  responsavel_cpf = '["02282908508", "00656161560"]'::jsonb
WHERE cnpj = '07.119.091/0001-47';

-- 7. CONSTRU VALE
UPDATE empresas SET 
  endereco = 'Av. Ulysses Guimarães, 3701, CAB, Salvador-BA',
  responsavel_nome = '["Marcelo Augusto da Silva Cardoso"]'::jsonb,
  responsavel_cpf = '["02847139551"]'::jsonb
WHERE cnpj = '17.116.003/0001-22';

-- 8. CONSTRUTORA ANDRADE PINTO
UPDATE empresas SET 
  endereco = 'AV. Padre Antonio Vieira, 140, Ed. Amazonia Prime, Sala 1903, Recife (PE)',
  responsavel_nome = '["Ana Patricia Varjão de Andrade Pinto"]'::jsonb,
  responsavel_cpf = '["74645595720"]'::jsonb
WHERE cnpj = '08.904.261/0001-50';

-- 9. CONSTRUTORA BAMBERG
UPDATE empresas SET 
  endereco = 'Rua Amazonas, 1166, Pituba, Salvador-BA',
  responsavel_nome = '["Antônio Carlos Monteiro Teixeira Júnior"]'::jsonb,
  responsavel_cpf = '["83050043568"]'::jsonb
WHERE cnpj = '05.158.217/0001-52';

-- 10. CONSTRUTORA BONFIM
UPDATE empresas SET 
  endereco = 'Rua Guedes Cabral, 207, Graça, Salvador-BA',
  responsavel_nome = '["Antônio Jorge Ferreira dos Santos"]'::jsonb,
  responsavel_cpf = '["08768378587"]'::jsonb
WHERE cnpj = '14.689.695/0001-69';

-- 11. CONSTRUTORA CAVANI
UPDATE empresas SET 
  endereco = 'Av. Antonio Carlos Magalhães, 4281, sala 203, Pituba, Salvador-BA',
  responsavel_nome = '["Marcos Vinicius Cananéa Araújo"]'::jsonb,
  responsavel_cpf = '["49316095568"]'::jsonb
WHERE cnpj = '37.506.188/0001-02';

-- 12. CONSTRUTORA CUNHA LIMA
UPDATE empresas SET 
  endereco = 'Av. Tancredo Neves, 805, Ed. Esplanada Tower, Sala 1304, Caminho das Árvores, Salvador-BA',
  responsavel_nome = '["Jamile Karine Maciel Cunha Lima"]'::jsonb,
  responsavel_cpf = '["86951653549"]'::jsonb
WHERE cnpj = '09.067.310/0001-29';

-- 13. CONSTRUTORA GV
UPDATE empresas SET 
  endereco = 'Av. Jorge Amado, 257, Ed. Empresarial Mundo Plaza, Salas 603/604, Imbuí, Salvador-BA',
  responsavel_nome = '["José Roberto de Santana Santos Segundo"]'::jsonb,
  responsavel_cpf = '["91161932504"]'::jsonb
WHERE cnpj = '32.820.548/0001-55';

-- 14. CONSÓRCIO EXPRESSO MOBILIDADE SALVADOR (múltiplos responsáveis)
UPDATE empresas SET 
  endereco = 'Av. Luís Viana, 2335-B, Alphaville, Salvador-BA',
  responsavel_nome = '["Marcelo Salvador Martins Dourado", "André Cardoso Costa Barboza", "José Guilherme Cunha Dantas"]'::jsonb,
  responsavel_cpf = '["15517981572", "01606732576", "01906313504"]'::jsonb
WHERE cnpj = '49.014.667/0001-39';

-- 15. CONSÓRCIO SOL DE BROTAS (múltiplos responsáveis)
UPDATE empresas SET 
  endereco = 'Rua Ari Barroso, 52, Edifício Torre Centro Empresarial, Jardim Aeroporto, Lauro de Freitas-BA',
  responsavel_nome = '["Luiza Maria de Souza Farias", "Antônio Mário Melo Vieira"]'::jsonb,
  responsavel_cpf = '["47858923572", "27970612587"]'::jsonb
WHERE cnpj = '32.757.315/0001-26';

-- 16. CONSÓRCIO SVC (múltiplos responsáveis)
UPDATE empresas SET 
  endereco = 'Estrada de Acesso ao Hotel Iberostar, S/N, Alphaville, Salvador-BA',
  responsavel_nome = '["Adriana Portela Teixeira Lopes", "Ana Amélia Chagas Teixeira", "Maria Cristina Teixeira Mendes"]'::jsonb,
  responsavel_cpf = '["85339601549", "00207858504", "00163174572"]'::jsonb
WHERE cnpj = '53.232.395/0001-03';

-- 17. ECOSERV
UPDATE empresas SET 
  endereco = 'Loteamento Caminho do Mar, Lot. GV-13, Galpões 01 e 02, Camaçari-BA',
  responsavel_nome = '["Alessandra Borges Paixão"]'::jsonb,
  responsavel_cpf = '["72556510587"]'::jsonb
WHERE cnpj = '04.063.791/0001-79';

-- 18. ENGECIVIL
UPDATE empresas SET 
  endereco = 'Rua da Graviola, Nº 126, sala 1210, Caminho das Árvores, Salvador-BA',
  responsavel_nome = '["Roberto Silva Garcia"]'::jsonb,
  responsavel_cpf = '["48412295515"]'::jsonb
WHERE cnpj = '02.339.252/0001-09';

-- 19. ENGETEC
UPDATE empresas SET 
  endereco = 'AV. Luis Viana Filho, 2345-B, Sala 1021, CEP 41.820-001 - Salvador-BA',
  responsavel_nome = '["Helton Mauro Pereira de Andrade"]'::jsonb,
  responsavel_cpf = '["28149734568"]'::jsonb
WHERE cnpj = '05.019.296/0001-30';

-- 20. ENGEVI
UPDATE empresas SET 
  endereco = 'Rua Manoel Bonfim, 89, Calçada, Salvador-BA',
  responsavel_nome = '["Victor Daniel Bezerra dos Santos"]'::jsonb,
  responsavel_cpf = '["80587860582"]'::jsonb
WHERE cnpj = '12.162.869/0001-88';