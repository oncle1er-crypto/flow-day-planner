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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          color: string
          created_at: string
          icon: string
          id: string
          is_default: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      focus_sessions: {
        Row: {
          actual_seconds: number
          completed: boolean
          created_at: string
          ended_at: string | null
          id: string
          kind: Database["public"]["Enums"]["focus_kind"]
          note: string | null
          planned_minutes: number
          started_at: string
          task_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_seconds?: number
          completed?: boolean
          created_at?: string
          ended_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["focus_kind"]
          note?: string | null
          planned_minutes?: number
          started_at?: string
          task_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_seconds?: number
          completed?: boolean
          created_at?: string
          ended_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["focus_kind"]
          note?: string | null
          planned_minutes?: number
          started_at?: string
          task_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "focus_sessions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          category_id: string | null
          color: string | null
          created_at: string
          description: string | null
          id: string
          is_archived: boolean
          position: number
          progress: number
          status: Database["public"]["Enums"]["goal_status"]
          target_date: string | null
          title: string
          type: Database["public"]["Enums"]["goal_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          position?: number
          progress?: number
          status?: Database["public"]["Enums"]["goal_status"]
          target_date?: string | null
          title: string
          type?: Database["public"]["Enums"]["goal_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          position?: number
          progress?: number
          status?: Database["public"]["Enums"]["goal_status"]
          target_date?: string | null
          title?: string
          type?: Database["public"]["Enums"]["goal_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_logs: {
        Row: {
          count: number
          created_at: string
          habit_id: string
          id: string
          log_date: string
          note: string | null
          user_id: string
        }
        Insert: {
          count?: number
          created_at?: string
          habit_id: string
          id?: string
          log_date: string
          note?: string | null
          user_id: string
        }
        Update: {
          count?: number
          created_at?: string
          habit_id?: string
          id?: string
          log_date?: string
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          color: string | null
          created_at: string
          days_of_week: number[]
          description: string | null
          frequency: string
          icon: string | null
          id: string
          is_archived: boolean
          name: string
          position: number
          reminder_time: string | null
          target_per_day: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          days_of_week?: number[]
          description?: string | null
          frequency?: string
          icon?: string | null
          id?: string
          is_archived?: boolean
          name: string
          position?: number
          reminder_time?: string | null
          target_per_day?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          days_of_week?: number[]
          description?: string | null
          frequency?: string
          icon?: string | null
          id?: string
          is_archived?: boolean
          name?: string
          position?: number
          reminder_time?: string | null
          target_per_day?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          delivered_at: string | null
          id: string
          is_read: boolean
          kind: string
          scheduled_for: string | null
          task_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          is_read?: boolean
          kind?: string
          scheduled_for?: string | null
          task_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          is_read?: boolean
          kind?: string
          scheduled_for?: string | null
          task_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          language: string
          phone: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          language?: string
          phone?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          language?: string
          phone?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      subtasks: {
        Row: {
          created_at: string
          id: string
          is_done: boolean
          position: number
          task_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_done?: boolean
          position?: number
          task_id: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_done?: boolean
          position?: number
          task_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          category_id: string | null
          color: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          due_time: string | null
          icon: string | null
          id: string
          is_archived: boolean
          notes: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          recurrence: Database["public"]["Enums"]["recurrence_type"]
          recurrence_config: Json | null
          recurrence_end_date: string | null
          reminder_at: string | null
          reminder_enabled: boolean
          status: Database["public"]["Enums"]["task_status"]
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id?: string | null
          color?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          icon?: string | null
          id?: string
          is_archived?: boolean
          notes?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          recurrence?: Database["public"]["Enums"]["recurrence_type"]
          recurrence_config?: Json | null
          recurrence_end_date?: string | null
          reminder_at?: string | null
          reminder_enabled?: boolean
          status?: Database["public"]["Enums"]["task_status"]
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string | null
          color?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          icon?: string | null
          id?: string
          is_archived?: boolean
          notes?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          recurrence?: Database["public"]["Enums"]["recurrence_type"]
          recurrence_config?: Json | null
          recurrence_end_date?: string | null
          reminder_at?: string | null
          reminder_enabled?: boolean
          status?: Database["public"]["Enums"]["task_status"]
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_key: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_key: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_key?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string
          default_reminder_minutes: number
          language: string
          notifications_enabled: boolean
          sound_enabled: boolean
          theme: string
          updated_at: string
          user_id: string
          week_start: number
        }
        Insert: {
          created_at?: string
          default_reminder_minutes?: number
          language?: string
          notifications_enabled?: boolean
          sound_enabled?: boolean
          theme?: string
          updated_at?: string
          user_id: string
          week_start?: number
        }
        Update: {
          created_at?: string
          default_reminder_minutes?: number
          language?: string
          notifications_enabled?: boolean
          sound_enabled?: boolean
          theme?: string
          updated_at?: string
          user_id?: string
          week_start?: number
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
      focus_kind: "focus" | "short_break" | "long_break"
      goal_status: "active" | "done" | "paused"
      goal_type: "short" | "long"
      recurrence_type:
        | "none"
        | "daily"
        | "weekdays"
        | "weekly"
        | "monthly"
        | "yearly"
        | "custom"
      task_priority: "low" | "normal" | "high" | "urgent"
      task_status: "todo" | "in_progress" | "done" | "cancelled" | "postponed"
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
      focus_kind: ["focus", "short_break", "long_break"],
      goal_status: ["active", "done", "paused"],
      goal_type: ["short", "long"],
      recurrence_type: [
        "none",
        "daily",
        "weekdays",
        "weekly",
        "monthly",
        "yearly",
        "custom",
      ],
      task_priority: ["low", "normal", "high", "urgent"],
      task_status: ["todo", "in_progress", "done", "cancelled", "postponed"],
    },
  },
} as const
