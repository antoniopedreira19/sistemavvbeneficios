export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      apolices: {
        Row: {
          adendo_assinado: boolean
          boas_vindas_enviado: boolean
          codigo_enviado: boolean
          created_at: string
          empresa_id: string
          id: string
          lote_id: string
          numero_vidas_adendo: number | null
          numero_vidas_enviado: number | null
          numero_vidas_vitalmed: number | null
          obra_id: string | null
          updated_at: string
        }
        Insert: {
          adendo_assinado?: boolean
          boas_vindas_enviado?: boolean
          codigo_enviado?: boolean
          created_at?: string
          empresa_id: string
          id?: string
          lote_id: string
          numero_vidas_adendo?: number | null
          numero_vidas_enviado?: number | null
          numero_vidas_vitalmed?: number | null
          obra_id?: string | null
          updated_at?: string
        }
        Update: {
          adendo_assinado?: boolean
          boas_vindas_enviado?: boolean
          codigo_enviado?: boolean
          created_at?: string
          empresa_id?: string
          id?: string
          lote_id?: string
          numero_vidas_adendo?: number | null
          numero_vidas_enviado?: number | null
          numero_vidas_vitalmed?: number | null
          obra_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "apolices_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apolices_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes_mensais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apolices_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      colaboradores: {
        Row: {
          afastado: boolean | null
          aposentado: boolean | null
          cargo: string | null
          cid: string | null
          classificacao: string | null
          classificacao_salario: string | null
          cpf: string
          created_at: string
          created_by: string | null
          data_nascimento: string
          email: string | null
          empresa_id: string
          id: string
          matricula: string | null
          nome: string
          obra_id: string | null
          salario: number | null
          setor: string | null
          sexo: string | null
          status: Database["public"]["Enums"]["colaborador_status"]
          updated_at: string
        }
        Insert: {
          afastado?: boolean | null
          aposentado?: boolean | null
          cargo?: string | null
          cid?: string | null
          classificacao?: string | null
          classificacao_salario?: string | null
          cpf: string
          created_at?: string
          created_by?: string | null
          data_nascimento: string
          email?: string | null
          empresa_id: string
          id?: string
          matricula?: string | null
          nome: string
          obra_id?: string | null
          salario?: number | null
          setor?: string | null
          sexo?: string | null
          status?: Database["public"]["Enums"]["colaborador_status"]
          updated_at?: string
        }
        Update: {
          afastado?: boolean | null
          aposentado?: boolean | null
          cargo?: string | null
          cid?: string | null
          classificacao?: string | null
          classificacao_salario?: string | null
          cpf?: string
          created_at?: string
          created_by?: string | null
          data_nascimento?: string
          email?: string | null
          empresa_id?: string
          id?: string
          matricula?: string | null
          nome?: string
          obra_id?: string | null
          salario?: number | null
          setor?: string | null
          sexo?: string | null
          status?: Database["public"]["Enums"]["colaborador_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "colaboradores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaboradores_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      colaboradores_lote: {
        Row: {
          afastado: boolean | null
          aposentado: boolean | null
          cid: string | null
          classificacao: string | null
          classificacao_salario: string | null
          colaborador_id: string | null
          cpf: string
          created_at: string
          data_nascimento: string
          data_tentativa: string | null
          id: string
          lote_id: string
          motivo_reprovacao_seguradora: string | null
          nome: string
          salario: number
          sexo: string | null
          status_seguradora: string | null
          tentativa_reenvio: number
          tipo_alteracao: string | null
          updated_at: string
        }
        Insert: {
          afastado?: boolean | null
          aposentado?: boolean | null
          cid?: string | null
          classificacao?: string | null
          classificacao_salario?: string | null
          colaborador_id?: string | null
          cpf: string
          created_at?: string
          data_nascimento: string
          data_tentativa?: string | null
          id?: string
          lote_id: string
          motivo_reprovacao_seguradora?: string | null
          nome: string
          salario: number
          sexo?: string | null
          status_seguradora?: string | null
          tentativa_reenvio?: number
          tipo_alteracao?: string | null
          updated_at?: string
        }
        Update: {
          afastado?: boolean | null
          aposentado?: boolean | null
          cid?: string | null
          classificacao?: string | null
          classificacao_salario?: string | null
          colaborador_id?: string | null
          cpf?: string
          created_at?: string
          data_nascimento?: string
          data_tentativa?: string | null
          id?: string
          lote_id?: string
          motivo_reprovacao_seguradora?: string | null
          nome?: string
          salario?: number
          sexo?: string | null
          status_seguradora?: string | null
          tentativa_reenvio?: number
          tipo_alteracao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "colaboradores_lote_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaboradores_lote_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes_mensais"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_import_layouts: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          map_schema: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          map_schema?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          map_schema?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresa_import_layouts_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          cnpj: string
          contrato_url: string | null
          created_at: string
          email_contato: string | null
          emails_contato: Json | null
          endereco: string | null
          id: string
          implantada: boolean | null
          nome: string
          nome_responsavel: string | null
          responsavel_cpf: Json | null
          responsavel_nome: Json | null
          status: Database["public"]["Enums"]["empresa_status"]
          telefone_contato: string | null
          telefones_contato: Json | null
          updated_at: string
        }
        Insert: {
          cnpj: string
          contrato_url?: string | null
          created_at?: string
          email_contato?: string | null
          emails_contato?: Json | null
          endereco?: string | null
          id?: string
          implantada?: boolean | null
          nome: string
          nome_responsavel?: string | null
          responsavel_cpf?: Json | null
          responsavel_nome?: Json | null
          status?: Database["public"]["Enums"]["empresa_status"]
          telefone_contato?: string | null
          telefones_contato?: Json | null
          updated_at?: string
        }
        Update: {
          cnpj?: string
          contrato_url?: string | null
          created_at?: string
          email_contato?: string | null
          emails_contato?: Json | null
          endereco?: string | null
          id?: string
          implantada?: boolean | null
          nome?: string
          nome_responsavel?: string | null
          responsavel_cpf?: Json | null
          responsavel_nome?: Json | null
          status?: Database["public"]["Enums"]["empresa_status"]
          telefone_contato?: string | null
          telefones_contato?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      historico_cobrancas: {
        Row: {
          competencia: string
          created_at: string
          disparado_por: string | null
          empresas_notificadas: Json
          id: string
          total_empresas: number
        }
        Insert: {
          competencia: string
          created_at?: string
          disparado_por?: string | null
          empresas_notificadas?: Json
          id?: string
          total_empresas?: number
        }
        Update: {
          competencia?: string
          created_at?: string
          disparado_por?: string | null
          empresas_notificadas?: Json
          id?: string
          total_empresas?: number
        }
        Relationships: []
      }
      historico_logs: {
        Row: {
          acao: string
          colaborador_id: string | null
          created_at: string
          detalhes: Json | null
          empresa_id: string | null
          id: string
          lote_id: string | null
          user_id: string | null
        }
        Insert: {
          acao: string
          colaborador_id?: string | null
          created_at?: string
          detalhes?: Json | null
          empresa_id?: string | null
          id?: string
          lote_id?: string | null
          user_id?: string | null
        }
        Update: {
          acao?: string
          colaborador_id?: string | null
          created_at?: string
          detalhes?: Json | null
          empresa_id?: string | null
          id?: string
          lote_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "historico_logs_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_logs_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_logs_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes_mensais"
            referencedColumns: ["id"]
          },
        ]
      }
      lotes_mensais: {
        Row: {
          aprovado_em: string | null
          arquivo_url: string | null
          competencia: string
          cotado_em: string | null
          created_at: string
          empresa_id: string
          enviado_cotacao_em: string | null
          enviado_seguradora_em: string | null
          id: string
          motivo_reprovacao: string | null
          obra_id: string | null
          observacoes: string | null
          status: Database["public"]["Enums"]["lote_status"]
          total_alterados: number | null
          total_aprovados: number | null
          total_colaboradores: number | null
          total_desligados: number | null
          total_novos: number | null
          total_reprovados: number | null
          updated_at: string
          valor_total: number | null
        }
        Insert: {
          aprovado_em?: string | null
          arquivo_url?: string | null
          competencia: string
          cotado_em?: string | null
          created_at?: string
          empresa_id: string
          enviado_cotacao_em?: string | null
          enviado_seguradora_em?: string | null
          id?: string
          motivo_reprovacao?: string | null
          obra_id?: string | null
          observacoes?: string | null
          status?: Database["public"]["Enums"]["lote_status"]
          total_alterados?: number | null
          total_aprovados?: number | null
          total_colaboradores?: number | null
          total_desligados?: number | null
          total_novos?: number | null
          total_reprovados?: number | null
          updated_at?: string
          valor_total?: number | null
        }
        Update: {
          aprovado_em?: string | null
          arquivo_url?: string | null
          competencia?: string
          cotado_em?: string | null
          created_at?: string
          empresa_id?: string
          enviado_cotacao_em?: string | null
          enviado_seguradora_em?: string | null
          id?: string
          motivo_reprovacao?: string | null
          obra_id?: string | null
          observacoes?: string | null
          status?: Database["public"]["Enums"]["lote_status"]
          total_alterados?: number | null
          total_aprovados?: number | null
          total_colaboradores?: number | null
          total_desligados?: number | null
          total_novos?: number | null
          total_reprovados?: number | null
          updated_at?: string
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lotes_mensais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotes_mensais_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_fiscais: {
        Row: {
          competencia: string
          created_at: string
          empresa_id: string
          id: string
          lote_id: string
          nf_emitida: boolean
          numero_vidas: number
          obra_id: string | null
          updated_at: string
          valor_total: number
        }
        Insert: {
          competencia: string
          created_at?: string
          empresa_id: string
          id?: string
          lote_id: string
          nf_emitida?: boolean
          numero_vidas?: number
          obra_id?: string | null
          updated_at?: string
          valor_total?: number
        }
        Update: {
          competencia?: string
          created_at?: string
          empresa_id?: string
          id?: string
          lote_id?: string
          nf_emitida?: boolean
          numero_vidas?: number
          obra_id?: string | null
          updated_at?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "notas_fiscais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes_mensais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          created_at: string | null
          dados: Json | null
          destinatario_role: string
          email_destinatario: string | null
          empresa_id: string | null
          enviado: boolean | null
          id: string
          lote_id: string | null
          obra_id: string | null
          tipo: string
        }
        Insert: {
          created_at?: string | null
          dados?: Json | null
          destinatario_role: string
          email_destinatario?: string | null
          empresa_id?: string | null
          enviado?: boolean | null
          id?: string
          lote_id?: string | null
          obra_id?: string | null
          tipo: string
        }
        Update: {
          created_at?: string | null
          dados?: Json | null
          destinatario_role?: string
          email_destinatario?: string | null
          empresa_id?: string | null
          enviado?: boolean | null
          id?: string
          lote_id?: string | null
          obra_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes_mensais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obras: {
        Row: {
          created_at: string
          data_previsao_termino: string | null
          empresa_id: string
          id: string
          nome: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_previsao_termino?: string | null
          empresa_id: string
          id?: string
          nome: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_previsao_termino?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      precos_planos: {
        Row: {
          created_at: string
          faixa_etaria: string
          id: string
          lote_id: string
          observacoes: string | null
          plano: string
          updated_at: string
          valor: number
        }
        Insert: {
          created_at?: string
          faixa_etaria: string
          id?: string
          lote_id: string
          observacoes?: string | null
          plano: string
          updated_at?: string
          valor: number
        }
        Update: {
          created_at?: string
          faixa_etaria?: string
          id?: string
          lote_id?: string
          observacoes?: string | null
          plano?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "precos_planos_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes_mensais"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          celular: string | null
          created_at: string
          email: string
          empresa_id: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          celular?: string | null
          created_at?: string
          email: string
          empresa_id?: string | null
          id: string
          nome: string
          updated_at?: string
        }
        Update: {
          celular?: string | null
          created_at?: string
          email?: string
          empresa_id?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      criar_notificacao:
        | {
            Args: {
              p_dados?: Json
              p_destinatario_role: string
              p_empresa_id: string
              p_lote_id: string
              p_tipo: string
            }
            Returns: string
          }
        | {
            Args: {
              p_dados?: Json
              p_destinatario_role: string
              p_empresa_id: string
              p_lote_id: string
              p_obra_id?: string
              p_tipo: string
            }
            Returns: string
          }
      get_empresas_pendentes: {
        Args: { p_competencia: string }
        Returns: {
          cnpj: string
          email: string
          id: string
          nome: string
          responsavel: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "cliente" | "operacional" | "financeiro"
      colaborador_status: "ativo" | "desligado"
      empresa_status:
        | "sem_retorno"
        | "tratativa"
        | "contrato_assinado"
        | "apolices_emitida"
        | "acolhimento"
        | "ativa"
        | "inativa"
        | "cancelada"
      lote_status:
        | "rascunho"
        | "aguardando_processamento"
        | "em_analise_seguradora"
        | "com_pendencia"
        | "concluido"
        | "faturado"
        | "aguardando_reanalise"
        | "em_reanalise"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "cliente", "operacional", "financeiro"],
      colaborador_status: ["ativo", "desligado"],
      empresa_status: [
        "sem_retorno",
        "tratativa",
        "contrato_assinado",
        "apolices_emitida",
        "acolhimento",
        "ativa",
        "inativa",
        "cancelada",
      ],
      lote_status: [
        "rascunho",
        "aguardando_processamento",
        "em_analise_seguradora",
        "com_pendencia",
        "concluido",
        "faturado",
        "aguardando_reanalise",
        "em_reanalise",
      ],
    },
  },
} as const
