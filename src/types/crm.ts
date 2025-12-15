export type EmpresaStatus = 
  | 'sem_retorno' 
  | 'tratativa' 
  | 'contrato_assinado' 
  | 'apolices_emitida' 
  | 'acolhimento' 
  | 'ativa' 
  | 'inativa' 
  | 'cancelada';

export interface EmpresaCRM {
  id: string;
  nome: string;
  cnpj: string;
  email_contato: string | null;
  telefone_contato: string | null;
  nome_responsavel: string[] | string | null;
  responsavel_cpf?: string[] | null;
  status: EmpresaStatus;
  created_at: string;
  emails_contato?: string[];
  telefones_contato?: string[];
  contrato_url?: string | null;
}

export const CRM_STATUS_LABELS: Record<string, string> = {
  sem_retorno: "Sem Retorno",
  tratativa: "Em Tratativa",
  contrato_assinado: "Contrato Assinado",
  apolices_emitida: "Apólices Emitida",
  acolhimento: "Acolhimento",
  ativa: "Empresa Ativa",
  inativa: "Inativa",
  cancelada: "Cancelada",
};

export const CRM_FUNNEL_STATUSES: EmpresaStatus[] = [
  'sem_retorno',
  'tratativa',
  'contrato_assinado',
  'apolices_emitida',
  'acolhimento',
];

export const LOTE_STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  aguardando_processamento: "Aguardando Processamento",
  em_analise_seguradora: "Em Análise Seguradora",
  com_pendencia: "Com Pendência",
  concluido: "Concluído",
  faturado: "Faturado",
};
