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
      absences: {
        Row: {
          absence_date: string
          created_at: string
          id: string
          reason: string | null
          source_message_id: string | null
          staff_id: string | null
          staff_name: string
        }
        Insert: {
          absence_date?: string
          created_at?: string
          id?: string
          reason?: string | null
          source_message_id?: string | null
          staff_id?: string | null
          staff_name: string
        }
        Update: {
          absence_date?: string
          created_at?: string
          id?: string
          reason?: string | null
          source_message_id?: string | null
          staff_id?: string | null
          staff_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "absences_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_memory: {
        Row: {
          context: Json
          created_at: string
          decision: Json
          director_note: string | null
          id: string
          last_used_at: string
          outcome: string | null
          pattern_key: string
          pattern_type: string
          usage_count: number
        }
        Insert: {
          context?: Json
          created_at?: string
          decision?: Json
          director_note?: string | null
          id?: string
          last_used_at?: string
          outcome?: string | null
          pattern_key: string
          pattern_type: string
          usage_count?: number
        }
        Update: {
          context?: Json
          created_at?: string
          decision?: Json
          director_note?: string | null
          id?: string
          last_used_at?: string
          outcome?: string | null
          pattern_key?: string
          pattern_type?: string
          usage_count?: number
        }
        Relationships: []
      }
      attendance_reports: {
        Row: {
          absent: number
          absent_reason: string | null
          class_name: string
          created_at: string
          id: string
          present: number
          report_date: string
          reported_by_name: string | null
          reported_by_staff_id: string | null
          source_message_id: string | null
        }
        Insert: {
          absent?: number
          absent_reason?: string | null
          class_name: string
          created_at?: string
          id?: string
          present?: number
          report_date?: string
          reported_by_name?: string | null
          reported_by_staff_id?: string | null
          source_message_id?: string | null
        }
        Update: {
          absent?: number
          absent_reason?: string | null
          class_name?: string
          created_at?: string
          id?: string
          present?: number
          report_date?: string
          reported_by_name?: string | null
          reported_by_staff_id?: string | null
          source_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_reports_reported_by_staff_id_fkey"
            columns: ["reported_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_reports_reported_by_staff_id_fkey"
            columns: ["reported_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_reports_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_scans: {
        Row: {
          class_name: string
          device_info: string | null
          id: string
          nfc_tag: string | null
          scanned_at: string
          status: string
          student_name: string
        }
        Insert: {
          class_name: string
          device_info?: string | null
          id?: string
          nfc_tag?: string | null
          scanned_at?: string
          status?: string
          student_name: string
        }
        Update: {
          class_name?: string
          device_info?: string | null
          id?: string
          nfc_tag?: string | null
          scanned_at?: string
          status?: string
          student_name?: string
        }
        Relationships: []
      }
      cafeteria_reports: {
        Row: {
          by_class: Json
          created_at: string
          id: string
          meal_time: string
          notes: string | null
          report_date: string
          total_portions: number
        }
        Insert: {
          by_class?: Json
          created_at?: string
          id?: string
          meal_time?: string
          notes?: string | null
          report_date?: string
          total_portions?: number
        }
        Update: {
          by_class?: Json
          created_at?: string
          id?: string
          meal_time?: string
          notes?: string | null
          report_date?: string
          total_portions?: number
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          chat_room: string
          created_at: string
          external_id: string | null
          id: string
          language: string | null
          metadata: Json
          processed: boolean
          reply_to_message_id: string | null
          sender_name: string
          sender_staff_id: string | null
          sender_user_id: string | null
          source: string
          text: string
        }
        Insert: {
          chat_room?: string
          created_at?: string
          external_id?: string | null
          id?: string
          language?: string | null
          metadata?: Json
          processed?: boolean
          reply_to_message_id?: string | null
          sender_name: string
          sender_staff_id?: string | null
          sender_user_id?: string | null
          source?: string
          text: string
        }
        Update: {
          chat_room?: string
          created_at?: string
          external_id?: string | null
          id?: string
          language?: string | null
          metadata?: Json
          processed?: boolean
          reply_to_message_id?: string | null
          sender_name?: string
          sender_staff_id?: string | null
          sender_user_id?: string | null
          source?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_staff_id_fkey"
            columns: ["sender_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_staff_id_fkey"
            columns: ["sender_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_rooms: {
        Row: {
          created_at: string
          description: string | null
          external_chat_id: string | null
          id: string
          member_role: Database["public"]["Enums"]["app_role"] | null
          name: string
          slug: string
          source: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          external_chat_id?: string | null
          id?: string
          member_role?: Database["public"]["Enums"]["app_role"] | null
          name: string
          slug: string
          source?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          external_chat_id?: string | null
          id?: string
          member_role?: Database["public"]["Enums"]["app_role"] | null
          name?: string
          slug?: string
          source?: string
        }
        Relationships: []
      }
      classes: {
        Row: {
          created_at: string
          grade: number | null
          id: string
          name: string
          student_count: number
        }
        Insert: {
          created_at?: string
          grade?: number | null
          id?: string
          name: string
          student_count?: number
        }
        Update: {
          created_at?: string
          grade?: number | null
          id?: string
          name?: string
          student_count?: number
        }
        Relationships: []
      }
      daily_reports: {
        Row: {
          ai_summary: string | null
          by_class: Json
          cafeteria_portions: number
          created_at: string
          id: string
          late_arrivals: Json
          report_date: string
          teacher_status: Json
          total_absent: number
          total_present: number
        }
        Insert: {
          ai_summary?: string | null
          by_class?: Json
          cafeteria_portions?: number
          created_at?: string
          id?: string
          late_arrivals?: Json
          report_date?: string
          teacher_status?: Json
          total_absent?: number
          total_present?: number
        }
        Update: {
          ai_summary?: string | null
          by_class?: Json
          cafeteria_portions?: number
          created_at?: string
          id?: string
          late_arrivals?: Json
          report_date?: string
          teacher_status?: Json
          total_absent?: number
          total_present?: number
        }
        Relationships: []
      }
      generated_schedules: {
        Row: {
          ai_notes: string | null
          conflicts: Json
          created_at: string
          day_of_week: string
          for_date: string
          generated_by: string | null
          grid: Json
          id: string
        }
        Insert: {
          ai_notes?: string | null
          conflicts?: Json
          created_at?: string
          day_of_week: string
          for_date?: string
          generated_by?: string | null
          grid?: Json
          id?: string
        }
        Update: {
          ai_notes?: string | null
          conflicts?: Json
          created_at?: string
          day_of_week?: string
          for_date?: string
          generated_by?: string | null
          grid?: Json
          id?: string
        }
        Relationships: []
      }
      incidents: {
        Row: {
          assigned_staff_id: string | null
          created_at: string
          description: string | null
          id: string
          location: string | null
          reporter_name: string | null
          reporter_staff_id: string | null
          severity: string
          source_message_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_staff_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          reporter_name?: string | null
          reporter_staff_id?: string | null
          severity?: string
          source_message_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_staff_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          reporter_name?: string | null
          reporter_staff_id?: string | null
          severity?: string
          source_message_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_assigned_staff_id_fkey"
            columns: ["assigned_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_assigned_staff_id_fkey"
            columns: ["assigned_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_reporter_staff_id_fkey"
            columns: ["reporter_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_reporter_staff_id_fkey"
            columns: ["reporter_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          embedding: string | null
          id: string
          order_id: string
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          order_id: string
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_chunks_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "legal_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          category: string | null
          created_at: string
          id: string
          order_number: string
          required_fields: Json
          source_url: string | null
          template: string
          title: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          order_number: string
          required_fields?: Json
          source_url?: string | null
          template: string
          title: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          order_number?: string
          required_fields?: Json
          source_url?: string | null
          template?: string
          title?: string
        }
        Relationships: []
      }
      legal_orders: {
        Row: {
          bullets: Json
          created_at: string
          date_published: string | null
          full_text: string | null
          id: string
          number: string
          summary: string | null
          title: string
        }
        Insert: {
          bullets?: Json
          created_at?: string
          date_published?: string | null
          full_text?: string | null
          id?: string
          number: string
          summary?: string | null
          title: string
        }
        Update: {
          bullets?: Json
          created_at?: string
          date_published?: string | null
          full_text?: string | null
          id?: string
          number?: string
          summary?: string | null
          title?: string
        }
        Relationships: []
      }
      message_parses: {
        Row: {
          ai_reply: string | null
          confidence: number | null
          created_at: string
          entities: Json
          id: string
          intent: string
          message_id: string
        }
        Insert: {
          ai_reply?: string | null
          confidence?: number | null
          created_at?: string
          entities?: Json
          id?: string
          intent: string
          message_id: string
        }
        Update: {
          ai_reply?: string | null
          confidence?: number | null
          created_at?: string
          entities?: Json
          id?: string
          intent?: string
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_parses_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          read: boolean
          recipient_role: Database["public"]["Enums"]["app_role"] | null
          recipient_user_id: string | null
          related_entity: string | null
          related_id: string | null
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          recipient_role?: Database["public"]["Enums"]["app_role"] | null
          recipient_user_id?: string | null
          related_entity?: string | null
          related_id?: string | null
          title: string
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          recipient_role?: Database["public"]["Enums"]["app_role"] | null
          recipient_user_id?: string | null
          related_entity?: string | null
          related_id?: string | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      pending_actions: {
        Row: {
          action_type: string
          ai_reasoning: string | null
          ai_summary: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          payload: Json
          result: Json | null
          source_message_id: string | null
          status: string
        }
        Insert: {
          action_type: string
          ai_reasoning?: string | null
          ai_summary?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          payload?: Json
          result?: Json | null
          source_message_id?: string | null
          status?: string
        }
        Update: {
          action_type?: string
          ai_reasoning?: string | null
          ai_summary?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          payload?: Json
          result?: Json | null
          source_message_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_actions_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          language: string
          staff_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id?: string
          language?: string
          staff_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          language?: string
          staff_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rooms: {
        Row: {
          capacity: number | null
          created_at: string
          floor: number | null
          home_class: string | null
          id: string
          number: string
          owner_staff_id: string | null
          subject: string | null
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          floor?: number | null
          home_class?: string | null
          id?: string
          number: string
          owner_staff_id?: string | null
          subject?: string | null
        }
        Update: {
          capacity?: number | null
          created_at?: string
          floor?: number | null
          home_class?: string | null
          id?: string
          number?: string
          owner_staff_id?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rooms_owner_staff_id_fkey"
            columns: ["owner_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_owner_staff_id_fkey"
            columns: ["owner_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_overrides: {
        Row: {
          ai_generated: boolean
          created_at: string
          created_by: string | null
          id: string
          new_room: string | null
          new_teacher_id: string | null
          note: string | null
          override_date: string
          override_type: string
          related_substitution_id: string | null
          slot_id: string | null
        }
        Insert: {
          ai_generated?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          new_room?: string | null
          new_teacher_id?: string | null
          note?: string | null
          override_date?: string
          override_type: string
          related_substitution_id?: string | null
          slot_id?: string | null
        }
        Update: {
          ai_generated?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          new_room?: string | null
          new_teacher_id?: string | null
          note?: string | null
          override_date?: string
          override_type?: string
          related_substitution_id?: string | null
          slot_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_overrides_new_teacher_id_fkey"
            columns: ["new_teacher_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_overrides_new_teacher_id_fkey"
            columns: ["new_teacher_id"]
            isOneToOne: false
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_overrides_related_substitution_id_fkey"
            columns: ["related_substitution_id"]
            isOneToOne: false
            referencedRelation: "substitutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_overrides_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "schedule_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_slots: {
        Row: {
          class_name: string
          created_at: string
          day_of_week: string
          id: string
          period: number
          room: string | null
          subject_norm: string | null
          subject_raw: string
          teacher_id: string | null
          teacher_raw: string | null
          time_label: string | null
        }
        Insert: {
          class_name: string
          created_at?: string
          day_of_week: string
          id?: string
          period: number
          room?: string | null
          subject_norm?: string | null
          subject_raw: string
          teacher_id?: string | null
          teacher_raw?: string | null
          time_label?: string | null
        }
        Update: {
          class_name?: string
          created_at?: string
          day_of_week?: string
          id?: string
          period?: number
          room?: string | null
          subject_norm?: string | null
          subject_raw?: string
          teacher_id?: string | null
          teacher_raw?: string | null
          time_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_slots_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_slots_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      school_periods: {
        Row: {
          id: string
          period_number: number
          time_label: string
        }
        Insert: {
          id?: string
          period_number: number
          time_label: string
        }
        Update: {
          id?: string
          period_number?: number
          time_label?: string
        }
        Relationships: []
      }
      staff: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          short_name: string | null
          subjects: string[]
          telegram_chat_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          phone?: string | null
          short_name?: string | null
          subjects?: string[]
          telegram_chat_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          short_name?: string | null
          subjects?: string[]
          telegram_chat_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      substitutions: {
        Row: {
          absence_id: string | null
          ai_reasoning: string | null
          created_at: string
          for_date: string
          id: string
          slot_id: string | null
          status: string
          substitute_staff_id: string | null
          updated_at: string
        }
        Insert: {
          absence_id?: string | null
          ai_reasoning?: string | null
          created_at?: string
          for_date?: string
          id?: string
          slot_id?: string | null
          status?: string
          substitute_staff_id?: string | null
          updated_at?: string
        }
        Update: {
          absence_id?: string | null
          ai_reasoning?: string | null
          created_at?: string
          for_date?: string
          id?: string
          slot_id?: string | null
          status?: string
          substitute_staff_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "substitutions_absence_id_fkey"
            columns: ["absence_id"]
            isOneToOne: false
            referencedRelation: "absences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitutions_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "schedule_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitutions_substitute_staff_id_fkey"
            columns: ["substitute_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitutions_substitute_staff_id_fkey"
            columns: ["substitute_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_name: string | null
          assignee_staff_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string | null
          id: string
          source: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_name?: string | null
          assignee_staff_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          source?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_name?: string | null
          assignee_staff_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          source?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_staff_id_fkey"
            columns: ["assignee_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assignee_staff_id_fkey"
            columns: ["assignee_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      teaching_load: {
        Row: {
          class_name: string
          created_at: string
          hours_per_week: number
          id: string
          subject: string
          teacher_id: string | null
          teacher_name: string
        }
        Insert: {
          class_name: string
          created_at?: string
          hours_per_week?: number
          id?: string
          subject: string
          teacher_id?: string | null
          teacher_name: string
        }
        Update: {
          class_name?: string
          created_at?: string
          hours_per_week?: number
          id?: string
          subject?: string
          teacher_id?: string | null
          teacher_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "teaching_load_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_load_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      staff_directory: {
        Row: {
          full_name: string | null
          id: string | null
          is_active: boolean | null
          short_name: string | null
          subjects: string[] | null
        }
        Insert: {
          full_name?: string | null
          id?: string | null
          is_active?: boolean | null
          short_name?: string | null
          subjects?: string[] | null
        }
        Update: {
          full_name?: string | null
          id?: string | null
          is_active?: boolean | null
          short_name?: string | null
          subjects?: string[] | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "director" | "teacher" | "staff"
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
      app_role: ["director", "teacher", "staff"],
    },
  },
} as const
