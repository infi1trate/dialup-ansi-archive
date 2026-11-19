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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      archive_index: {
        Row: {
          artist: string
          file: string
          groups: string
          pack: string
          title: string
          year: number
        }
        Insert: {
          artist?: string
          file: string
          groups?: string
          pack: string
          title?: string
          year?: number
        }
        Update: {
          artist?: string
          file?: string
          groups?: string
          pack?: string
          title?: string
          year?: number
        }
        Relationships: []
      }
      art_ratings: {
        Row: {
          caller_id: string
          file: string
          pack: string
          rating: number
        }
        Insert: {
          caller_id: string
          file: string
          pack: string
          rating: number
        }
        Update: {
          caller_id?: string
          file?: string
          pack?: string
          rating?: number
        }
        Relationships: []
      }
      call_log: {
        Row: {
          board: string
          caller_id: string | null
          city: string
          created_at: string
          handle: string | null
          id: string
          session_id: string | null
          speed: number
          token_hash: string
        }
        Insert: {
          board?: string
          caller_id?: string | null
          city?: string
          created_at?: string
          handle?: string | null
          id?: string
          session_id?: string | null
          speed?: number
          token_hash: string
        }
        Update: {
          board?: string
          caller_id?: string | null
          city?: string
          created_at?: string
          handle?: string | null
          id?: string
          session_id?: string | null
          speed?: number
          token_hash?: string
        }
        Relationships: []
      }
      call_sessions: {
        Row: {
          board: string
          caller_id: string
          charged_at: string
          closed: boolean
          day: string
          exempt: boolean
          id: string
          started_at: string
          used_seconds: number
        }
        Insert: {
          board?: string
          caller_id: string
          charged_at?: string
          closed?: boolean
          day?: string
          exempt?: boolean
          id?: string
          started_at?: string
          used_seconds?: number
        }
        Update: {
          board?: string
          caller_id?: string
          charged_at?: string
          closed?: boolean
          day?: string
          exempt?: boolean
          id?: string
          started_at?: string
          used_seconds?: number
        }
        Relationships: []
      }
      caller_access: {
        Row: {
          announced_level: string
          caller_id: string
          level: string
          previous_call_at: string | null
        }
        Insert: {
          announced_level?: string
          caller_id: string
          level?: string
          previous_call_at?: string | null
        }
        Update: {
          announced_level?: string
          caller_id?: string
          level?: string
          previous_call_at?: string | null
        }
        Relationships: []
      }
      caller_shelf: {
        Row: {
          caller_id: string
          file: string
          pack: string
        }
        Insert: {
          caller_id: string
          file: string
          pack: string
        }
        Update: {
          caller_id?: string
          file?: string
          pack?: string
        }
        Relationships: []
      }
      callers: {
        Row: {
          banned: boolean
          calls: number
          city: string
          created_at: string
          files_viewed: number
          handle: string
          handle_lower: string
          id: string
          last_call_at: string | null
          phrase_hash: string | null
          speed_unlocked: number
          token_hashes: string[]
        }
        Insert: {
          banned?: boolean
          calls?: number
          city?: string
          created_at?: string
          files_viewed?: number
          handle: string
          handle_lower: string
          id?: string
          last_call_at?: string | null
          phrase_hash?: string | null
          speed_unlocked?: number
          token_hashes?: string[]
        }
        Update: {
          banned?: boolean
          calls?: number
          city?: string
          created_at?: string
          files_viewed?: number
          handle?: string
          handle_lower?: string
          id?: string
          last_call_at?: string | null
          phrase_hash?: string | null
          speed_unlocked?: number
          token_hashes?: string[]
        }
        Relationships: []
      }
      corner_runs: {
        Row: {
          actions: Json
          caller_id: string
          day: string
          finished_at: string | null
          handle: string
          score: number | null
          seed: number
        }
        Insert: {
          actions?: Json
          caller_id: string
          day?: string
          finished_at?: string | null
          handle: string
          score?: number | null
          seed: number
        }
        Update: {
          actions?: Json
          caller_id?: string
          day?: string
          finished_at?: string | null
          handle?: string
          score?: number | null
          seed?: number
        }
        Relationships: []
      }
      credit_ledger: {
        Row: {
          amount: number
          caller_id: string
          created_at: string
          event: string
        }
        Insert: {
          amount: number
          caller_id: string
          created_at?: string
          event: string
        }
        Update: {
          amount?: number
          caller_id?: string
          created_at?: string
          event?: string
        }
        Relationships: []
      }
      daily_counters: {
        Row: {
          count: number
          day: string
          step: string
        }
        Insert: {
          count?: number
          day: string
          step: string
        }
        Update: {
          count?: number
          day?: string
          step?: string
        }
        Relationships: []
      }
      device_calls: {
        Row: {
          calls: number
          token_hash: string
        }
        Insert: {
          calls?: number
          token_hash: string
        }
        Update: {
          calls?: number
          token_hash?: string
        }
        Relationships: []
      }
      door_scores: {
        Row: {
          caller_id: string
          created_at: string
          floor: number
          handle: string
          id: number
          score: number
        }
        Insert: {
          caller_id: string
          created_at?: string
          floor: number
          handle: string
          id?: never
          score: number
        }
        Update: {
          caller_id?: string
          created_at?: string
          floor?: number
          handle?: string
          id?: never
          score?: number
        }
        Relationships: []
      }
      door_turns: {
        Row: {
          day: string
          turns: number
          viewer: string
        }
        Insert: {
          day: string
          turns?: number
          viewer: string
        }
        Update: {
          day?: string
          turns?: number
          viewer?: string
        }
        Relationships: []
      }
      flags: {
        Row: {
          file: string
          hidden: boolean
          pack: string
          updated_at: string
        }
        Insert: {
          file: string
          hidden?: boolean
          pack: string
          updated_at?: string
        }
        Update: {
          file?: string
          hidden?: boolean
          pack?: string
          updated_at?: string
        }
        Relationships: []
      }
      message_reports: {
        Row: {
          caller_id: string | null
          created_at: string
          id: number
          kind: string
          message_id: number
        }
        Insert: {
          caller_id?: string | null
          created_at?: string
          id?: never
          kind: string
          message_id: number
        }
        Update: {
          caller_id?: string | null
          created_at?: string
          id?: never
          kind?: string
          message_id?: number
        }
        Relationships: []
      }
      oneliners: {
        Row: {
          body: string
          caller_id: string
          created_at: string
          handle: string
          hidden: boolean
          id: number
          ip_hash: string
          token_hash: string
        }
        Insert: {
          body: string
          caller_id: string
          created_at?: string
          handle: string
          hidden?: boolean
          id?: never
          ip_hash: string
          token_hash: string
        }
        Update: {
          body?: string
          caller_id?: string
          created_at?: string
          handle?: string
          hidden?: boolean
          id?: never
          ip_hash?: string
          token_hash?: string
        }
        Relationships: []
      }
      phone_bills: {
        Row: {
          caller_id: string
          delivered_at: string | null
          month: string
          payload: Json
          read_at: string | null
        }
        Insert: {
          caller_id: string
          delivered_at?: string | null
          month: string
          payload: Json
          read_at?: string | null
        }
        Update: {
          caller_id?: string
          delivered_at?: string | null
          month?: string
          payload?: Json
          read_at?: string | null
        }
        Relationships: []
      }
      presence: {
        Row: {
          city: string
          doing: string
          handle: string | null
          session_id: string
          speed: number
          started_at: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          city?: string
          doing?: string
          handle?: string | null
          session_id: string
          speed?: number
          started_at?: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          city?: string
          doing?: string
          handle?: string | null
          session_id?: string
          speed?: number
          started_at?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: []
      }
      rate_hits: {
        Row: {
          action: string
          at: string
          id: number
          key: string
        }
        Insert: {
          action: string
          at?: string
          id?: never
          key: string
        }
        Update: {
          action?: string
          at?: string
          id?: never
          key?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          file: string
          handle: string | null
          id: number
          ip_hash: string
          pack: string
          reason: number
          token_hash: string
        }
        Insert: {
          created_at?: string
          file: string
          handle?: string | null
          id?: never
          ip_hash: string
          pack: string
          reason: number
          token_hash: string
        }
        Update: {
          created_at?: string
          file?: string
          handle?: string | null
          id?: never
          ip_hash?: string
          pack?: string
          reason?: number
          token_hash?: string
        }
        Relationships: []
      }
      scene_bulletins: {
        Row: {
          day: string
          payload: Json
          ready: boolean
          started_at: string
        }
        Insert: {
          day: string
          payload?: Json
          ready?: boolean
          started_at?: string
        }
        Update: {
          day?: string
          payload?: Json
          ready?: boolean
          started_at?: string
        }
        Relationships: []
      }
      sysop_mail: {
        Row: {
          board: string
          body: string
          caller_id: string
          created_at: string
          delivered_at: string | null
          delivered_call: number | null
          id: number
          occurred_call: number
          read_at: string | null
          rule_key: string
          subject: string
        }
        Insert: {
          board: string
          body: string
          caller_id: string
          created_at?: string
          delivered_at?: string | null
          delivered_call?: number | null
          id?: never
          occurred_call: number
          read_at?: string | null
          rule_key: string
          subject: string
        }
        Update: {
          board?: string
          body?: string
          caller_id?: string
          created_at?: string
          delivered_at?: string | null
          delivered_call?: number | null
          id?: never
          occurred_call?: number
          read_at?: string | null
          rule_key?: string
          subject?: string
        }
        Relationships: []
      }
      time_accounts: {
        Row: {
          allowance_seconds: number
          bank_seconds: number
          caller_id: string
          day: string
          used_seconds: number
          withdrawn_seconds: number
        }
        Insert: {
          allowance_seconds?: number
          bank_seconds?: number
          caller_id: string
          day: string
          used_seconds?: number
          withdrawn_seconds?: number
        }
        Update: {
          allowance_seconds?: number
          bank_seconds?: number
          caller_id?: string
          day?: string
          used_seconds?: number
          withdrawn_seconds?: number
        }
        Relationships: []
      }
      views: {
        Row: {
          created_at: string
          file: string
          pack: string
          viewer: string
        }
        Insert: {
          created_at?: string
          file: string
          pack: string
          viewer: string
        }
        Update: {
          created_at?: string
          file?: string
          pack?: string
          viewer?: string
        }
        Relationships: []
      }
      wall_posts: {
        Row: {
          body: string
          caller_id: string
          created_at: string
          handle: string
          hidden: boolean
          id: number
        }
        Insert: {
          body: string
          caller_id: string
          created_at?: string
          handle: string
          hidden?: boolean
          id?: never
        }
        Update: {
          body?: string
          caller_id?: string
          created_at?: string
          handle?: string
          hidden?: boolean
          id?: never
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      board_credit: {
        Args: { _amount: number; _caller: string; _event: string }
        Returns: number
      }
      bump_counter: { Args: { _step: string }; Returns: undefined }
      caller_record: { Args: { _caller: string }; Returns: Json }
      charge_call: {
        Args: { _caller: string; _close?: boolean; _session: string }
        Returns: number
      }
      deliver_sysop_mail: {
        Args: { _call: number; _caller: string }
        Returns: number
      }
      first_device_call: { Args: { _hash: string }; Returns: boolean }
      time_bank: {
        Args: {
          _active?: boolean
          _allowance: number
          _caller: string
          _close?: boolean
          _now: string
          _session?: string
          _withdraw?: number
        }
        Returns: Json
      }
      top_files: {
        Args: { _limit: number }
        Returns: {
          file: string
          pack: string
          views: number
        }[]
      }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
