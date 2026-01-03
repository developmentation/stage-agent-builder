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
      free_agent_artifacts: {
        Row: {
          artifact_type: string
          content: string
          created_at: string
          description: string | null
          id: string
          iteration: number
          mime_type: string | null
          session_id: string
          size: number | null
          title: string
        }
        Insert: {
          artifact_type: string
          content: string
          created_at?: string
          description?: string | null
          id?: string
          iteration?: number
          mime_type?: string | null
          session_id: string
          size?: number | null
          title: string
        }
        Update: {
          artifact_type?: string
          content?: string
          created_at?: string
          description?: string | null
          id?: string
          iteration?: number
          mime_type?: string | null
          session_id?: string
          size?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "free_agent_artifacts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "free_agent_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      free_agent_blackboard: {
        Row: {
          category: string
          content: string
          created_at: string
          data: Json | null
          id: string
          iteration: number
          session_id: string
        }
        Insert: {
          category: string
          content: string
          created_at?: string
          data?: Json | null
          id?: string
          iteration?: number
          session_id: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          data?: Json | null
          id?: string
          iteration?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "free_agent_blackboard_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "free_agent_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      free_agent_messages: {
        Row: {
          artifacts: Json | null
          content: string
          created_at: string
          id: string
          iteration: number | null
          role: string
          session_id: string
          tool_calls: Json | null
        }
        Insert: {
          artifacts?: Json | null
          content: string
          created_at?: string
          id?: string
          iteration?: number | null
          role: string
          session_id: string
          tool_calls?: Json | null
        }
        Update: {
          artifacts?: Json | null
          content?: string
          created_at?: string
          id?: string
          iteration?: number | null
          role?: string
          session_id?: string
          tool_calls?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "free_agent_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "free_agent_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      free_agent_session_files: {
        Row: {
          content: string | null
          created_at: string
          filename: string
          id: string
          mime_type: string
          session_id: string
          size: number
        }
        Insert: {
          content?: string | null
          created_at?: string
          filename: string
          id?: string
          mime_type: string
          session_id: string
          size: number
        }
        Update: {
          content?: string | null
          created_at?: string
          filename?: string
          id?: string
          mime_type?: string
          session_id?: string
          size?: number
        }
        Relationships: [
          {
            foreignKeyName: "free_agent_session_files_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "free_agent_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      free_agent_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          current_iteration: number
          error: string | null
          final_report: Json | null
          id: string
          max_iterations: number
          model: string
          prompt: string
          session_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_iteration?: number
          error?: string | null
          final_report?: Json | null
          id?: string
          max_iterations?: number
          model?: string
          prompt: string
          session_name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_iteration?: number
          error?: string | null
          final_report?: Json | null
          id?: string
          max_iterations?: number
          model?: string
          prompt?: string
          session_name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      free_agent_tool_calls: {
        Row: {
          completed_at: string | null
          error: string | null
          id: string
          iteration: number
          params: Json
          result: Json | null
          session_id: string
          started_at: string
          status: string
          tool_name: string
        }
        Insert: {
          completed_at?: string | null
          error?: string | null
          id?: string
          iteration?: number
          params?: Json
          result?: Json | null
          session_id: string
          started_at?: string
          status?: string
          tool_name: string
        }
        Update: {
          completed_at?: string | null
          error?: string | null
          id?: string
          iteration?: number
          params?: Json
          result?: Json | null
          session_id?: string
          started_at?: string
          status?: string
          tool_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "free_agent_tool_calls_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "free_agent_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
