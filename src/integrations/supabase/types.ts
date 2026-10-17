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
      garmin_activities: {
        Row: {
          activity_id: number
          aerobic_te: number | null
          anaerobic_te: number | null
          avg_hr: number | null
          avg_pace_or_speed: number | null
          calories: number | null
          distance_meters: number | null
          duration_seconds: number | null
          elevation_gain: number | null
          max_hr: number | null
          name: string | null
          raw: Json | null
          start_time_local: string | null
          training_load: number | null
          type: string | null
        }
        Insert: {
          activity_id: number
          aerobic_te?: number | null
          anaerobic_te?: number | null
          avg_hr?: number | null
          avg_pace_or_speed?: number | null
          calories?: number | null
          distance_meters?: number | null
          duration_seconds?: number | null
          elevation_gain?: number | null
          max_hr?: number | null
          name?: string | null
          raw?: Json | null
          start_time_local?: string | null
          training_load?: number | null
          type?: string | null
        }
        Update: {
          activity_id?: number
          aerobic_te?: number | null
          anaerobic_te?: number | null
          avg_hr?: number | null
          avg_pace_or_speed?: number | null
          calories?: number | null
          distance_meters?: number | null
          duration_seconds?: number | null
          elevation_gain?: number | null
          max_hr?: number | null
          name?: string | null
          raw?: Json | null
          start_time_local?: string | null
          training_load?: number | null
          type?: string | null
        }
        Relationships: []
      }
      garmin_daily: {
        Row: {
          active_kcal: number | null
          awake_seconds: number | null
          body_battery_charged: number | null
          body_battery_drained: number | null
          body_battery_high: number | null
          body_battery_low: number | null
          body_battery_wake: number | null
          date: string
          deep_sleep_seconds: number | null
          hrv_last_night_avg: number | null
          hrv_status: string | null
          hrv_weekly_avg: number | null
          intensity_minutes: number | null
          light_sleep_seconds: number | null
          raw: Json | null
          rem_sleep_seconds: number | null
          resting_hr: number | null
          sleep_score: number | null
          sleep_seconds: number | null
          steps: number | null
          stress_avg: number | null
          stress_max: number | null
          training_readiness: number | null
          training_readiness_level: string | null
        }
        Insert: {
          active_kcal?: number | null
          awake_seconds?: number | null
          body_battery_charged?: number | null
          body_battery_drained?: number | null
          body_battery_high?: number | null
          body_battery_low?: number | null
          body_battery_wake?: number | null
          date: string
          deep_sleep_seconds?: number | null
          hrv_last_night_avg?: number | null
          hrv_status?: string | null
          hrv_weekly_avg?: number | null
          intensity_minutes?: number | null
          light_sleep_seconds?: number | null
          raw?: Json | null
          rem_sleep_seconds?: number | null
          resting_hr?: number | null
          sleep_score?: number | null
          sleep_seconds?: number | null
          steps?: number | null
          stress_avg?: number | null
          stress_max?: number | null
          training_readiness?: number | null
          training_readiness_level?: string | null
        }
        Update: {
          active_kcal?: number | null
          awake_seconds?: number | null
          body_battery_charged?: number | null
          body_battery_drained?: number | null
          body_battery_high?: number | null
          body_battery_low?: number | null
          body_battery_wake?: number | null
          date?: string
          deep_sleep_seconds?: number | null
          hrv_last_night_avg?: number | null
          hrv_status?: string | null
          hrv_weekly_avg?: number | null
          intensity_minutes?: number | null
          light_sleep_seconds?: number | null
          raw?: Json | null
          rem_sleep_seconds?: number | null
          resting_hr?: number | null
          sleep_score?: number | null
          sleep_seconds?: number | null
          steps?: number | null
          stress_avg?: number | null
          stress_max?: number | null
          training_readiness?: number | null
          training_readiness_level?: string | null
        }
        Relationships: []
      }
      garmin_wellness: {
        Row: {
          date: string
          id: string
          metric: string
          period: string
          user_id: string
          values: Json
        }
        Insert: {
          date: string
          id?: string
          metric: string
          period: string
          user_id: string
          values: Json
        }
        Update: {
          date?: string
          id?: string
          metric?: string
          period?: string
          user_id?: string
          values?: Json
        }
        Relationships: []
      }
      recovery_activities: {
        Row: {
          avg_hr: number | null
          calories: number | null
          date: string
          distance: number | null
          duration: string | null
          id: string
          intensity: number | null
          max_hr: number | null
          muscles: string[]
          sleep: number | null
          soreness: number | null
          source_data: Json | null
          source_key: string | null
          title: string | null
          type: string
          user_id: string
        }
        Insert: {
          avg_hr?: number | null
          calories?: number | null
          date: string
          distance?: number | null
          duration?: string | null
          id?: string
          intensity?: number | null
          max_hr?: number | null
          muscles?: string[]
          sleep?: number | null
          soreness?: number | null
          source_data?: Json | null
          source_key?: string | null
          title?: string | null
          type: string
          user_id: string
        }
        Update: {
          avg_hr?: number | null
          calories?: number | null
          date?: string
          distance?: number | null
          duration?: string | null
          id?: string
          intensity?: number | null
          max_hr?: number | null
          muscles?: string[]
          sleep?: number | null
          soreness?: number | null
          source_data?: Json | null
          source_key?: string | null
          title?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
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
