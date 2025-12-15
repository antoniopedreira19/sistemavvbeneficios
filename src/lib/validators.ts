export const formatCPF = (value: string | number | string[] | null | undefined) => {
  if (!value) return "";

  // Se for array (JSONB), pega o primeiro item ou string vazia
  if (Array.isArray(value)) {
    value = value[0] || "";
  }

  // Converte para string com segurança
  const stringValue = String(value);

  // Remove tudo que não é dígito
  const cleanValue = stringValue.replace(/\D/g, "");

  // Aplica a máscara
  return cleanValue
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})/, "$1-$2")
    .replace(/(-\d{2})\d+?$/, "$1");
};

// Aproveite e blinde o CNPJ também
export const formatCNPJ = (value: string | number | null | undefined) => {
  if (!value) return "";
  const stringValue = String(value);

  const cleanValue = stringValue.replace(/\D/g, "");

  return cleanValue
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2")
    .replace(/(-\d{2})\d+?$/, "$1");
};

export const formatTelefone = (value: string | number | null | undefined) => {
  if (!value) return "";
  const stringValue = String(value);

  const cleanValue = stringValue.replace(/\D/g, "");

  if (cleanValue.length === 11) {
    return cleanValue.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
  } else {
    return cleanValue.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  }
};
