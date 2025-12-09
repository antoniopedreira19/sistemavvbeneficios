/**
 * Utilitários para importação de planilhas Excel
 * Suporta múltiplas variações de nomes de colunas
 */

// Normaliza header removendo acentos, espaços e caracteres especiais
export const normalizeHeader = (h: string): string =>
  h
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[^a-z0-9]/g, ""); // Remove espaços e especiais

// Variações aceitas para cada coluna obrigatória
export const COLUMN_VARIATIONS = {
  nome: [
    "nome",
    "nomecompleto",
    "funcionario",
    "colaborador",
    "empregado",
    "trabalhador",
    "nomecolaborador",
    "nomefuncionario",
    "nometrabalhador",
    "nomefunc",
    "nomecolab",
  ],
  cpf: ["cpf", "documento", "doc", "cpfcnpj", "numcpf", "numerocpf", "cpfcolaborador"],
  salario: [
    "salario",
    "salariobase",
    "vencimento",
    "vencimentos",
    "remuneracao",
    "sal",
    "renda",
    "valor",
    "pagamento",
  ],
  nascimento: [
    "nascimento",
    "nasc",
    "dtnasc",
    "dtnascimento",
    "datanasc",
    "datanascimento",
    "datadenasc",
    "datadenascimento",
    "dtdenascimento",
    "dtnasci",
  ],
  sexo: ["sexo", "genero", "gen", "sx", "masculinofeminino", "mf"],
};

/**
 * Encontra a linha de cabeçalho em um array de dados do Excel
 * Procura pela primeira linha que contenha pelo menos 3 colunas reconhecíveis
 */
export const findHeaderRowIndex = (data: any[][]): number => {
  for (let i = 0; i < Math.min(data.length, 10); i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    // Normaliza headers da linha atual
    const normalizedRow = row.map((cell) => normalizeHeader(String(cell || "")));

    // Conta quantas colunas conhecidas encontramos
    let matchCount = 0;
    for (const variations of Object.values(COLUMN_VARIATIONS)) {
      const found = normalizedRow.some((h) => variations.some((v) => h.includes(v) || v.includes(h)));
      if (found) matchCount++;
    }

    // Se encontrou pelo menos 3 colunas reconhecíveis, é o header
    if (matchCount >= 3) {
      return i;
    }
  }
  return 0; // Fallback: primeira linha
};

/**
 * Mapeia os índices das colunas baseado nas variações conhecidas
 */
export const mapColumnIndexes = (
  headers: string[],
): {
  idxNome: number;
  idxCPF: number;
  idxSalario: number;
  idxNasc: number;
  idxSexo: number;
} => {
  const normalizedHeaders = headers.map(normalizeHeader);

  const findIndex = (variations: string[]) =>
    normalizedHeaders.findIndex((h) => {
      // Verifica se alguma variação está contida no header ou vice-versa
      return variations.some((v) => h.includes(v) || v.includes(h));
    });

  return {
    idxNome: findIndex(COLUMN_VARIATIONS.nome),
    idxCPF: findIndex(COLUMN_VARIATIONS.cpf),
    idxSalario: findIndex(COLUMN_VARIATIONS.salario),
    idxNasc: findIndex(COLUMN_VARIATIONS.nascimento),
    idxSexo: findIndex(COLUMN_VARIATIONS.sexo),
  };
};

/**
 * Valida se as colunas obrigatórias foram encontradas
 */
export const validateRequiredColumns = (indexes: ReturnType<typeof mapColumnIndexes>): string[] => {
  const missing: string[] = [];
  if (indexes.idxNome === -1) missing.push("Nome");
  if (indexes.idxCPF === -1) missing.push("CPF");
  if (indexes.idxSalario === -1) missing.push("Salário");
  return missing;
};
