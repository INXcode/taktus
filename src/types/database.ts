export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      ai_config: {
        Row: {
          api_key: string | null
          base_url: string | null
          enabled: boolean
          id: number
          max_input_chars: number
          model: string | null
          provider: Database["public"]["Enums"]["ai_provider"]
          updated_at: string
        }
        Insert: {
          api_key?: string | null
          base_url?: string | null
          enabled?: boolean
          id?: number
          max_input_chars?: number
          model?: string | null
          provider?: Database["public"]["Enums"]["ai_provider"]
          updated_at?: string
        }
        Update: {
          api_key?: string | null
          base_url?: string | null
          enabled?: boolean
          id?: number
          max_input_chars?: number
          model?: string | null
          provider?: Database["public"]["Enums"]["ai_provider"]
          updated_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          changed_fields: string[] | null
          entity_id: string | null
          entity_type: string
          id: number
          occurred_at: string
          tenant_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          changed_fields?: string[] | null
          entity_id?: string | null
          entity_type: string
          id?: never
          occurred_at?: string
          tenant_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          changed_fields?: string[] | null
          entity_id?: string | null
          entity_type?: string
          id?: never
          occurred_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          customer_id: string | null
          deactivated_at: string | null
          display_name: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          deactivated_at?: string | null
          display_name: string
          id: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          deactivated_at?: string | null
          display_name?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_customer_id_fkey"
            columns: ["tenant_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          ai_enabled: boolean
          audit_retention_days: number
          created_at: string
          id: string
          is_active: boolean
          name: string
          ticket_retention_days: number
          updated_at: string
        }
        Insert: {
          ai_enabled?: boolean
          audit_retention_days?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          ticket_retention_days?: number
          updated_at?: string
        }
        Update: {
          ai_enabled?: boolean
          audit_retention_days?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          ticket_retention_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      ticket_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          tenant_id: string
          ticket_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          tenant_id: string
          ticket_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          tenant_id?: string
          ticket_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_comments_tenant_id_author_id_fkey"
            columns: ["tenant_id", "author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "ticket_comments_tenant_id_ticket_id_fkey"
            columns: ["tenant_id", "ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      tickets: {
        Row: {
          ai_generated_at: string | null
          ai_marked_fields: string[]
          ai_model: string | null
          ai_summary: string | null
          assignee_id: string | null
          category: Database["public"]["Enums"]["ticket_category"]
          closed_at: string | null
          created_at: string
          created_by: string
          customer_id: string
          description: string
          id: string
          status: Database["public"]["Enums"]["ticket_status"]
          tenant_id: string
          ticket_number: number
          title: string
          updated_at: string
        }
        Insert: {
          ai_generated_at?: string | null
          ai_marked_fields?: string[]
          ai_model?: string | null
          ai_summary?: string | null
          assignee_id?: string | null
          category?: Database["public"]["Enums"]["ticket_category"]
          closed_at?: string | null
          created_at?: string
          created_by: string
          customer_id: string
          description?: string
          id?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          tenant_id: string
          ticket_number: number
          title: string
          updated_at?: string
        }
        Update: {
          ai_generated_at?: string | null
          ai_marked_fields?: string[]
          ai_model?: string | null
          ai_summary?: string | null
          assignee_id?: string | null
          category?: Database["public"]["Enums"]["ticket_category"]
          closed_at?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string
          description?: string
          id?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          tenant_id?: string
          ticket_number?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_tenant_id_assignee_id_fkey"
            columns: ["tenant_id", "assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "tickets_tenant_id_created_by_fkey"
            columns: ["tenant_id", "created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "tickets_tenant_id_customer_id_fkey"
            columns: ["tenant_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          created_at: string
          id: string
          minutes: number
          note: string
          tenant_id: string
          ticket_id: string
          updated_at: string
          user_id: string
          worked_on: string
        }
        Insert: {
          created_at?: string
          id?: string
          minutes: number
          note?: string
          tenant_id: string
          ticket_id: string
          updated_at?: string
          user_id: string
          worked_on: string
        }
        Update: {
          created_at?: string
          id?: string
          minutes?: number
          note?: string
          tenant_id?: string
          ticket_id?: string
          updated_at?: string
          user_id?: string
          worked_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_tenant_id_ticket_id_fkey"
            columns: ["tenant_id", "ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "time_entries_tenant_id_user_id_fkey"
            columns: ["tenant_id", "user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      anonymize_profile: { Args: { p_profile_id: string }; Returns: undefined }
      auth_email_vergeben: { Args: { p_email: string }; Returns: boolean }
      current_app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      current_customer_id: { Args: never; Returns: string }
      current_tenant_id: { Args: never; Returns: string }
      export_person_data: { Args: { p_profile_id: string }; Returns: Json }
      is_tenant_admin: { Args: never; Returns: boolean }
      log_audit: {
        Args: {
          p_action: string
          p_changed_fields?: string[]
          p_entity_id?: string
          p_entity_type: string
        }
        Returns: undefined
      }
      purge_expired_data: {
        Args: never
        Returns: {
          protokoll_geloescht: number
          tenant_id: string
          tickets_geloescht: number
        }[]
      }
    }
    Enums: {
      ai_provider: "openai" | "anthropic" | "openai_compatible"
      app_role: "admin" | "agent" | "requester"
      ticket_category:
        | "stoerung"
        | "anfrage"
        | "wartung"
        | "abrechnung"
        | "sonstiges"
      ticket_status: "open" | "in_progress" | "waiting" | "closed"
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
      ai_provider: ["openai", "anthropic", "openai_compatible"],
      app_role: ["admin", "agent", "requester"],
      ticket_category: [
        "stoerung",
        "anfrage",
        "wartung",
        "abrechnung",
        "sonstiges",
      ],
      ticket_status: ["open", "in_progress", "waiting", "closed"],
    },
  },
} as const

