// AUTO-GENERATED — DO NOT EDIT BY HAND.
//
// Full Supabase schema (every table/view/enum/function shape) generated from
// landr-api/supabase (Postgres migrations are the source of truth — see
// CLAUDE.md "Migrations are the source of truth for schema"). This widget
// talks to FastAPI, never Supabase directly — this file is a compile-time
// anchor only: hand-written wire types in src/api/types.ts that mirror a
// native Postgres enum (e.g. `ProductKind`) derive from the `Enums<>` helper
// below instead of duplicating the literal union, so DB/API drift is caught
// by tsc instead of rotting silently. Mirrors the pattern already used in
// landr-mobile (src/types/database.gen.ts) and landr-dashboard.
//
// Regenerate: npm run gen:types (see scripts/gen-types.sh)
//
// landr-52ik.5 adopted this; full adoption across the app rides landr-y3oj.3.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activity_areas: {
        Row: {
          approved: boolean
          center_lat: number | null
          center_lng: number | null
          center_location: unknown
          country_code: string
          created_at: string
          description: string | null
          id: string
          name: string
          region_id: string | null
          slug: string
          sport_id: string
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          approved?: boolean
          center_lat?: number | null
          center_lng?: number | null
          center_location?: unknown
          country_code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          region_id?: string | null
          slug: string
          sport_id: string
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          approved?: boolean
          center_lat?: number | null
          center_lng?: number | null
          center_location?: unknown
          country_code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          region_id?: string | null
          slug?: string
          sport_id?: string
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_areas_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "activity_areas_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_areas_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_areas_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_areas_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_site_forecasts: {
        Row: {
          activity_site_id: string
          fetched_at: string
          flyability: number | null
          forecast_date: string
          id: string
          raw_json: Json
          source: string
        }
        Insert: {
          activity_site_id: string
          fetched_at?: string
          flyability?: number | null
          forecast_date: string
          id?: string
          raw_json: Json
          source?: string
        }
        Update: {
          activity_site_id?: string
          fetched_at?: string
          flyability?: number | null
          forecast_date?: string
          id?: string
          raw_json?: Json
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_site_forecasts_activity_site_id_fkey"
            columns: ["activity_site_id"]
            isOneToOne: false
            referencedRelation: "activity_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_sites: {
        Row: {
          accessibility_notes: string | null
          activity_area_id: string | null
          approved: boolean
          country_code: string
          created_at: string
          description: string | null
          difficulty: string | null
          hike_in_minutes: number | null
          id: string
          lat: number | null
          lng: number | null
          location: unknown
          name: string
          region_id: string | null
          regulations: string | null
          slug: string
          sport_id: string
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          accessibility_notes?: string | null
          activity_area_id?: string | null
          approved?: boolean
          country_code: string
          created_at?: string
          description?: string | null
          difficulty?: string | null
          hike_in_minutes?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          location?: unknown
          name: string
          region_id?: string | null
          regulations?: string | null
          slug: string
          sport_id: string
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          accessibility_notes?: string | null
          activity_area_id?: string | null
          approved?: boolean
          country_code?: string
          created_at?: string
          description?: string | null
          difficulty?: string | null
          hike_in_minutes?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          location?: unknown
          name?: string
          region_id?: string | null
          regulations?: string | null
          slug?: string
          sport_id?: string
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_sites_activity_area_id_fkey"
            columns: ["activity_area_id"]
            isOneToOne: false
            referencedRelation: "activity_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_sites_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "activity_sites_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_sites_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_sites_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_sites_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_earnings: {
        Row: {
          agent_user_id: string
          applied_rules: Json
          base_amount: number
          booking_id: string
          commission_amount: number
          created_at: string
          currency: string
          earned_at: string
          earned_for_date: string
          id: string
          notes: string | null
          operator_id: string
          payout_id: string | null
          status: Database["public"]["Enums"]["agent_earning_status"]
        }
        Insert: {
          agent_user_id: string
          applied_rules?: Json
          base_amount: number
          booking_id: string
          commission_amount: number
          created_at?: string
          currency: string
          earned_at?: string
          earned_for_date: string
          id?: string
          notes?: string | null
          operator_id: string
          payout_id?: string | null
          status?: Database["public"]["Enums"]["agent_earning_status"]
        }
        Update: {
          agent_user_id?: string
          applied_rules?: Json
          base_amount?: number
          booking_id?: string
          commission_amount?: number
          created_at?: string
          currency?: string
          earned_at?: string
          earned_for_date?: string
          id?: string
          notes?: string | null
          operator_id?: string
          payout_id?: string | null
          status?: Database["public"]["Enums"]["agent_earning_status"]
        }
        Relationships: [
          {
            foreignKeyName: "agent_earnings_agent_user_id_fkey"
            columns: ["agent_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_earnings_agent_user_id_fkey"
            columns: ["agent_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_earnings_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_earnings_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "agent_earnings_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_rules: {
        Row: {
          active: boolean
          applies_to_pool_id: string | null
          applies_to_product_id: string | null
          code: string
          created_at: string
          deleted_at: string | null
          deleted_by_user_id: string | null
          deletion_reason: string | null
          id: string
          label: string
          label_localized: Json | null
          operator_id: string
          outcome: Database["public"]["Enums"]["approval_outcome"]
          params: Json
          priority: number
          rule_kind: Database["public"]["Enums"]["approval_rule_kind"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          applies_to_pool_id?: string | null
          applies_to_product_id?: string | null
          code: string
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          id?: string
          label: string
          label_localized?: Json | null
          operator_id: string
          outcome: Database["public"]["Enums"]["approval_outcome"]
          params?: Json
          priority?: number
          rule_kind: Database["public"]["Enums"]["approval_rule_kind"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          applies_to_pool_id?: string | null
          applies_to_product_id?: string | null
          code?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          id?: string
          label?: string
          label_localized?: Json | null
          operator_id?: string
          outcome?: Database["public"]["Enums"]["approval_outcome"]
          params?: Json
          priority?: number
          rule_kind?: Database["public"]["Enums"]["approval_rule_kind"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_rules_applies_to_pool_id_fkey"
            columns: ["applies_to_pool_id"]
            isOneToOne: false
            referencedRelation: "resource_pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_rules_applies_to_product_id_fkey"
            columns: ["applies_to_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_rules_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_rules_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_rules_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "approval_rules_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_state_transitions: {
        Row: {
          booking_id: string
          branch: string
          decision: string | null
          from_stage_id: string | null
          id: string
          occurred_at: string
          operator_id: string
          reason: string | null
          to_stage_id: string
          triggered_by_user_id: string | null
        }
        Insert: {
          booking_id: string
          branch: string
          decision?: string | null
          from_stage_id?: string | null
          id?: string
          occurred_at?: string
          operator_id: string
          reason?: string | null
          to_stage_id: string
          triggered_by_user_id?: string | null
        }
        Update: {
          booking_id?: string
          branch?: string
          decision?: string | null
          from_stage_id?: string | null
          id?: string
          occurred_at?: string
          operator_id?: string
          reason?: string | null
          to_stage_id?: string
          triggered_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_state_transitions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_state_transitions_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "booking_lifecycle_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_state_transitions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "approval_state_transitions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_state_transitions_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "booking_lifecycle_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_state_transitions_triggered_by_user_id_fkey"
            columns: ["triggered_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_state_transitions_triggered_by_user_id_fkey"
            columns: ["triggered_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          actor_kind: Database["public"]["Enums"]["actor_kind"]
          actor_subkind: string | null
          external_correlation_id: string | null
          id: string
          new_row: Json | null
          occurred_at: string
          old_row: Json | null
          operation: string
          operator_id: string | null
          row_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          actor_kind: Database["public"]["Enums"]["actor_kind"]
          actor_subkind?: string | null
          external_correlation_id?: string | null
          id?: string
          new_row?: Json | null
          occurred_at?: string
          old_row?: Json | null
          operation: string
          operator_id?: string | null
          row_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          actor_kind?: Database["public"]["Enums"]["actor_kind"]
          actor_subkind?: string | null
          external_correlation_id?: string | null
          id?: string
          new_row?: Json | null
          occurred_at?: string
          old_row?: Json | null
          operation?: string
          operator_id?: string | null
          row_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      audit_log_2026_08: {
        Row: {
          actor_kind: Database["public"]["Enums"]["actor_kind"]
          actor_subkind: string | null
          external_correlation_id: string | null
          id: string
          new_row: Json | null
          occurred_at: string
          old_row: Json | null
          operation: string
          operator_id: string | null
          row_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          actor_kind: Database["public"]["Enums"]["actor_kind"]
          actor_subkind?: string | null
          external_correlation_id?: string | null
          id?: string
          new_row?: Json | null
          occurred_at?: string
          old_row?: Json | null
          operation: string
          operator_id?: string | null
          row_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          actor_kind?: Database["public"]["Enums"]["actor_kind"]
          actor_subkind?: string | null
          external_correlation_id?: string | null
          id?: string
          new_row?: Json | null
          occurred_at?: string
          old_row?: Json | null
          operation?: string
          operator_id?: string | null
          row_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      audit_log_2026_09: {
        Row: {
          actor_kind: Database["public"]["Enums"]["actor_kind"]
          actor_subkind: string | null
          external_correlation_id: string | null
          id: string
          new_row: Json | null
          occurred_at: string
          old_row: Json | null
          operation: string
          operator_id: string | null
          row_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          actor_kind: Database["public"]["Enums"]["actor_kind"]
          actor_subkind?: string | null
          external_correlation_id?: string | null
          id?: string
          new_row?: Json | null
          occurred_at?: string
          old_row?: Json | null
          operation: string
          operator_id?: string | null
          row_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          actor_kind?: Database["public"]["Enums"]["actor_kind"]
          actor_subkind?: string | null
          external_correlation_id?: string | null
          id?: string
          new_row?: Json | null
          occurred_at?: string
          old_row?: Json | null
          operation?: string
          operator_id?: string | null
          row_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      audit_log_2026_10: {
        Row: {
          actor_kind: Database["public"]["Enums"]["actor_kind"]
          actor_subkind: string | null
          external_correlation_id: string | null
          id: string
          new_row: Json | null
          occurred_at: string
          old_row: Json | null
          operation: string
          operator_id: string | null
          row_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          actor_kind: Database["public"]["Enums"]["actor_kind"]
          actor_subkind?: string | null
          external_correlation_id?: string | null
          id?: string
          new_row?: Json | null
          occurred_at?: string
          old_row?: Json | null
          operation: string
          operator_id?: string | null
          row_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          actor_kind?: Database["public"]["Enums"]["actor_kind"]
          actor_subkind?: string | null
          external_correlation_id?: string | null
          id?: string
          new_row?: Json | null
          occurred_at?: string
          old_row?: Json | null
          operation?: string
          operator_id?: string | null
          row_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      audit_log_2026_11: {
        Row: {
          actor_kind: Database["public"]["Enums"]["actor_kind"]
          actor_subkind: string | null
          external_correlation_id: string | null
          id: string
          new_row: Json | null
          occurred_at: string
          old_row: Json | null
          operation: string
          operator_id: string | null
          row_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          actor_kind: Database["public"]["Enums"]["actor_kind"]
          actor_subkind?: string | null
          external_correlation_id?: string | null
          id?: string
          new_row?: Json | null
          occurred_at?: string
          old_row?: Json | null
          operation: string
          operator_id?: string | null
          row_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          actor_kind?: Database["public"]["Enums"]["actor_kind"]
          actor_subkind?: string | null
          external_correlation_id?: string | null
          id?: string
          new_row?: Json | null
          occurred_at?: string
          old_row?: Json | null
          operation?: string
          operator_id?: string | null
          row_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      audit_log_2026_12: {
        Row: {
          actor_kind: Database["public"]["Enums"]["actor_kind"]
          actor_subkind: string | null
          external_correlation_id: string | null
          id: string
          new_row: Json | null
          occurred_at: string
          old_row: Json | null
          operation: string
          operator_id: string | null
          row_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          actor_kind: Database["public"]["Enums"]["actor_kind"]
          actor_subkind?: string | null
          external_correlation_id?: string | null
          id?: string
          new_row?: Json | null
          occurred_at?: string
          old_row?: Json | null
          operation: string
          operator_id?: string | null
          row_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          actor_kind?: Database["public"]["Enums"]["actor_kind"]
          actor_subkind?: string | null
          external_correlation_id?: string | null
          id?: string
          new_row?: Json | null
          occurred_at?: string
          old_row?: Json | null
          operation?: string
          operator_id?: string | null
          row_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      bd_intent: {
        Row: {
          bd_id: string | null
          bd_type: string
          body: string | null
          created_at: string
          error: string | null
          id: string
          priority: string
          requested_by: string
          retry_count: number
          status: string
          ticket_id: string
          title: string
          updated_at: string
        }
        Insert: {
          bd_id?: string | null
          bd_type: string
          body?: string | null
          created_at?: string
          error?: string | null
          id?: string
          priority: string
          requested_by: string
          retry_count?: number
          status?: string
          ticket_id: string
          title: string
          updated_at?: string
        }
        Update: {
          bd_id?: string | null
          bd_type?: string
          body?: string | null
          created_at?: string
          error?: string | null
          id?: string
          priority?: string
          requested_by?: string
          retry_count?: number
          status?: string
          ticket_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_intent_requested_by_fk"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_intent_requested_by_fk"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_intent_ticket_fk"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_intent_ticket_fk"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_approval_requests: {
        Row: {
          booking_id: string
          branch: string
          created_at: string
          id: string
          locale: string
          operator_id: string
          outbound_email_id: string | null
          public_token: string
          requested_at: string
          resolved_at: string | null
          resolved_response_id: string | null
          responder_email: string
          responder_location_id: string
          revoked_at: string | null
          token_expires_at: string
          updated_at: string
        }
        Insert: {
          booking_id: string
          branch?: string
          created_at?: string
          id?: string
          locale?: string
          operator_id: string
          outbound_email_id?: string | null
          public_token?: string
          requested_at?: string
          resolved_at?: string | null
          resolved_response_id?: string | null
          responder_email: string
          responder_location_id: string
          revoked_at?: string | null
          token_expires_at?: string
          updated_at?: string
        }
        Update: {
          booking_id?: string
          branch?: string
          created_at?: string
          id?: string
          locale?: string
          operator_id?: string
          outbound_email_id?: string | null
          public_token?: string
          requested_at?: string
          resolved_at?: string | null
          resolved_response_id?: string | null
          responder_email?: string
          responder_location_id?: string
          revoked_at?: string | null
          token_expires_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_approval_requests_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_approval_requests_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "booking_approval_requests_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_approval_requests_outbound_email_id_fkey"
            columns: ["outbound_email_id"]
            isOneToOne: false
            referencedRelation: "outbound_emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_approval_requests_resolved_response_id_fkey"
            columns: ["resolved_response_id"]
            isOneToOne: false
            referencedRelation: "booking_approval_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_approval_requests_responder_location_id_fkey"
            columns: ["responder_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_approval_responses: {
        Row: {
          booking_id: string
          branch: string
          comment: string | null
          created_at: string
          decision: string
          id: string
          operator_id: string
          request_id: string
          responded_at: string
          responder_email: string
          responder_name: string | null
          source: string
          superseded_at: string | null
          supersedes_response_id: string | null
          updated_at: string
        }
        Insert: {
          booking_id: string
          branch?: string
          comment?: string | null
          created_at?: string
          decision: string
          id?: string
          operator_id: string
          request_id: string
          responded_at?: string
          responder_email: string
          responder_name?: string | null
          source?: string
          superseded_at?: string | null
          supersedes_response_id?: string | null
          updated_at?: string
        }
        Update: {
          booking_id?: string
          branch?: string
          comment?: string | null
          created_at?: string
          decision?: string
          id?: string
          operator_id?: string
          request_id?: string
          responded_at?: string
          responder_email?: string
          responder_name?: string | null
          source?: string
          superseded_at?: string | null
          supersedes_response_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_approval_responses_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_approval_responses_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "booking_approval_responses_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_approval_responses_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "booking_approval_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_approval_responses_supersedes_response_id_fkey"
            columns: ["supersedes_response_id"]
            isOneToOne: false
            referencedRelation: "booking_approval_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_briefing: {
        Row: {
          anniversary_notified_at: string | null
          booking_id: string
          content: Json
          created_at: string
          deleted_at: string | null
          deleted_by_user_id: string | null
          deletion_reason: string | null
          id: string
          is_published: boolean
          operator_id: string
          public_token: string
          review_url: string | null
          show_reviews: boolean
          title: string | null
          token_expires_at: string
          tone: string
          updated_at: string
          welcome_note: string | null
        }
        Insert: {
          anniversary_notified_at?: string | null
          booking_id: string
          content?: Json
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          id?: string
          is_published?: boolean
          operator_id: string
          public_token?: string
          review_url?: string | null
          show_reviews?: boolean
          title?: string | null
          token_expires_at?: string
          tone?: string
          updated_at?: string
          welcome_note?: string | null
        }
        Update: {
          anniversary_notified_at?: string | null
          booking_id?: string
          content?: Json
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          id?: string
          is_published?: boolean
          operator_id?: string
          public_token?: string
          review_url?: string | null
          show_reviews?: boolean
          title?: string | null
          token_expires_at?: string
          tone?: string
          updated_at?: string
          welcome_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_briefing_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_briefing_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_briefing_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_briefing_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "booking_briefing_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_briefing_day: {
        Row: {
          booking_id: string
          briefing_id: string
          conditions_note: string | null
          conditions_status: Database["public"]["Enums"]["briefing_conditions_status"]
          content: Json
          created_at: string
          day_date: string
          deleted_at: string | null
          deleted_by_user_id: string | null
          deletion_reason: string | null
          id: string
          is_published: boolean
          meeting_point_text: string | null
          operator_id: string
          plan_detail: string | null
          plan_headline: string | null
          published_at: string | null
          updated_at: string
        }
        Insert: {
          booking_id: string
          briefing_id: string
          conditions_note?: string | null
          conditions_status?: Database["public"]["Enums"]["briefing_conditions_status"]
          content?: Json
          created_at?: string
          day_date: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          id?: string
          is_published?: boolean
          meeting_point_text?: string | null
          operator_id: string
          plan_detail?: string | null
          plan_headline?: string | null
          published_at?: string | null
          updated_at?: string
        }
        Update: {
          booking_id?: string
          briefing_id?: string
          conditions_note?: string | null
          conditions_status?: Database["public"]["Enums"]["briefing_conditions_status"]
          content?: Json
          created_at?: string
          day_date?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          id?: string
          is_published?: boolean
          meeting_point_text?: string | null
          operator_id?: string
          plan_detail?: string | null
          plan_headline?: string | null
          published_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_briefing_day_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_briefing_day_briefing_id_fkey"
            columns: ["briefing_id"]
            isOneToOne: false
            referencedRelation: "booking_briefing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_briefing_day_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_briefing_day_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_briefing_day_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "booking_briefing_day_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_checkin: {
        Row: {
          booking_id: string
          booking_participant_id: string
          created_at: string
          day_date: string
          deleted_at: string | null
          deleted_by_user_id: string | null
          deletion_reason: string | null
          id: string
          latitude: number | null
          longitude: number | null
          note: string | null
          operator_id: string
          retrieve_note: string | null
          retrieve_state: string | null
          status: Database["public"]["Enums"]["briefing_checkin_status"]
          updated_at: string
        }
        Insert: {
          booking_id: string
          booking_participant_id: string
          created_at?: string
          day_date: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          note?: string | null
          operator_id: string
          retrieve_note?: string | null
          retrieve_state?: string | null
          status?: Database["public"]["Enums"]["briefing_checkin_status"]
          updated_at?: string
        }
        Update: {
          booking_id?: string
          booking_participant_id?: string
          created_at?: string
          day_date?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          note?: string | null
          operator_id?: string
          retrieve_note?: string | null
          retrieve_state?: string | null
          status?: Database["public"]["Enums"]["briefing_checkin_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_checkin_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_checkin_booking_participant_id_fkey"
            columns: ["booking_participant_id"]
            isOneToOne: false
            referencedRelation: "booking_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_checkin_booking_participant_id_fkey"
            columns: ["booking_participant_id"]
            isOneToOne: false
            referencedRelation: "participant_days"
            referencedColumns: ["booking_participant_id"]
          },
          {
            foreignKeyName: "booking_checkin_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_checkin_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_checkin_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "booking_checkin_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_day_provider_assignments: {
        Row: {
          assignment_date: string
          booking_id: string
          created_at: string
          deleted_at: string | null
          deleted_by_user_id: string | null
          deletion_reason: string | null
          id: string
          notes: string | null
          operator_id: string
          provider_id: string
          provider_role_id: string
          updated_at: string
        }
        Insert: {
          assignment_date: string
          booking_id: string
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          id?: string
          notes?: string | null
          operator_id: string
          provider_id: string
          provider_role_id: string
          updated_at?: string
        }
        Update: {
          assignment_date?: string
          booking_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          id?: string
          notes?: string | null
          operator_id?: string
          provider_id?: string
          provider_role_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_day_provider_assignments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_day_provider_assignments_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_day_provider_assignments_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_day_provider_assignments_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "booking_day_provider_assignments_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_day_provider_assignments_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_day_provider_assignments_provider_role_id_fkey"
            columns: ["provider_role_id"]
            isOneToOne: false
            referencedRelation: "provider_role_types"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_form_responses: {
        Row: {
          answers: Json
          booking_id: string
          created_at: string
          fields_snapshot: Json
          form_id: string
          form_key: string
          form_version: number
          id: string
          operator_id: string
          updated_at: string
        }
        Insert: {
          answers: Json
          booking_id: string
          created_at?: string
          fields_snapshot: Json
          form_id: string
          form_key: string
          form_version: number
          id?: string
          operator_id: string
          updated_at?: string
        }
        Update: {
          answers?: Json
          booking_id?: string
          created_at?: string
          fields_snapshot?: Json
          form_id?: string
          form_key?: string
          form_version?: number
          id?: string
          operator_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_form_responses_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_form_responses_form_id_operator_id_fkey"
            columns: ["form_id", "operator_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id", "operator_id"]
          },
          {
            foreignKeyName: "booking_form_responses_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "booking_form_responses_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_lifecycle_stages: {
        Row: {
          active: boolean
          code: string
          created_at: string
          deleted_at: string | null
          deleted_by_user_id: string | null
          deletion_reason: string | null
          id: string
          label: string
          label_localized: Json | null
          operator_id: string
          requires_manual_action: boolean
          semantic_state: Database["public"]["Enums"]["booking_semantic_state"]
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          id?: string
          label: string
          label_localized?: Json | null
          operator_id: string
          requires_manual_action?: boolean
          semantic_state: Database["public"]["Enums"]["booking_semantic_state"]
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          id?: string
          label?: string
          label_localized?: Json | null
          operator_id?: string
          requires_manual_action?: boolean
          semantic_state?: Database["public"]["Enums"]["booking_semantic_state"]
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_lifecycle_stages_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_lifecycle_stages_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_lifecycle_stages_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "booking_lifecycle_stages_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_notes: {
        Row: {
          author_user_id: string | null
          booking_id: string
          content: string
          created_at: string
          id: string
          operator_id: string
        }
        Insert: {
          author_user_id?: string | null
          booking_id: string
          content: string
          created_at?: string
          id?: string
          operator_id: string
        }
        Update: {
          author_user_id?: string | null
          booking_id?: string
          content?: string
          created_at?: string
          id?: string
          operator_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_notes_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_notes_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_notes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_notes_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "booking_notes_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_participant_day_state: {
        Row: {
          assigned_unit_id: string | null
          booking_id: string
          booking_participant_id: string
          created_at: string
          day_date: string
          deleted_at: string | null
          deleted_by_user_id: string | null
          deletion_reason: string | null
          expected_back_at: string | null
          id: string
          note: string | null
          operator_id: string
          part_of_day: string | null
          pickup_address: string | null
          pickup_lat: number | null
          pickup_lng: number | null
          pickup_location_id: string | null
          pickup_location_text: string | null
          pickup_time: string | null
          semantic_state:
            | Database["public"]["Enums"]["participant_day_semantic_state"]
            | null
          set_by: string | null
          status_id: string | null
          unit_assignment_source: string | null
          updated_at: string
        }
        Insert: {
          assigned_unit_id?: string | null
          booking_id: string
          booking_participant_id: string
          created_at?: string
          day_date: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          expected_back_at?: string | null
          id?: string
          note?: string | null
          operator_id: string
          part_of_day?: string | null
          pickup_address?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_location_id?: string | null
          pickup_location_text?: string | null
          pickup_time?: string | null
          semantic_state?:
            | Database["public"]["Enums"]["participant_day_semantic_state"]
            | null
          set_by?: string | null
          status_id?: string | null
          unit_assignment_source?: string | null
          updated_at?: string
        }
        Update: {
          assigned_unit_id?: string | null
          booking_id?: string
          booking_participant_id?: string
          created_at?: string
          day_date?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          expected_back_at?: string | null
          id?: string
          note?: string | null
          operator_id?: string
          part_of_day?: string | null
          pickup_address?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_location_id?: string | null
          pickup_location_text?: string | null
          pickup_time?: string | null
          semantic_state?:
            | Database["public"]["Enums"]["participant_day_semantic_state"]
            | null
          set_by?: string | null
          status_id?: string | null
          unit_assignment_source?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_participant_day_state_assigned_unit_id_fkey"
            columns: ["assigned_unit_id"]
            isOneToOne: false
            referencedRelation: "resource_pool_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_participant_day_state_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_participant_day_state_booking_participant_id_fkey"
            columns: ["booking_participant_id"]
            isOneToOne: false
            referencedRelation: "booking_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_participant_day_state_booking_participant_id_fkey"
            columns: ["booking_participant_id"]
            isOneToOne: false
            referencedRelation: "participant_days"
            referencedColumns: ["booking_participant_id"]
          },
          {
            foreignKeyName: "booking_participant_day_state_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_participant_day_state_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_participant_day_state_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "booking_participant_day_state_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_participant_day_state_pickup_location_id_fkey"
            columns: ["pickup_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_participant_day_state_set_by_fkey"
            columns: ["set_by"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_participant_day_state_set_by_fkey"
            columns: ["set_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_participant_day_state_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "participant_day_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_participants: {
        Row: {
          assigned_room_product_id: string | null
          assigned_room_unit_index: number | null
          booking_id: string
          companion_kind: string | null
          contact_id: string
          created_at: string
          has_breakfast: boolean
          id: string
          is_guiding: boolean
          notes: string | null
          occupant_age: number | null
          occupant_age_band: string
          operator_id: string
          pickup_location_id: string | null
          service_role_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_room_product_id?: string | null
          assigned_room_unit_index?: number | null
          booking_id: string
          companion_kind?: string | null
          contact_id: string
          created_at?: string
          has_breakfast?: boolean
          id?: string
          is_guiding?: boolean
          notes?: string | null
          occupant_age?: number | null
          occupant_age_band?: string
          operator_id: string
          pickup_location_id?: string | null
          service_role_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_room_product_id?: string | null
          assigned_room_unit_index?: number | null
          booking_id?: string
          companion_kind?: string | null
          contact_id?: string
          created_at?: string
          has_breakfast?: boolean
          id?: string
          is_guiding?: boolean
          notes?: string | null
          occupant_age?: number | null
          occupant_age_band?: string
          operator_id?: string
          pickup_location_id?: string | null
          service_role_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_participants_assigned_room_product_id_fkey"
            columns: ["assigned_room_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_participants_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_participants_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_participants_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_participants_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "booking_participants_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_participants_pickup_location_id_fkey"
            columns: ["pickup_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_participants_service_role_id_fkey"
            columns: ["service_role_id"]
            isOneToOne: false
            referencedRelation: "service_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_products: {
        Row: {
          booking_id: string
          computed_price_breakdown: Json
          created_at: string
          date_range_end: string | null
          date_range_start: string | null
          id: string
          operator_id: string
          product_availability_id: string | null
          product_id: string
          quantity: number
          selected_days: string[] | null
          updated_at: string
        }
        Insert: {
          booking_id: string
          computed_price_breakdown?: Json
          created_at?: string
          date_range_end?: string | null
          date_range_start?: string | null
          id?: string
          operator_id: string
          product_availability_id?: string | null
          product_id: string
          quantity?: number
          selected_days?: string[] | null
          updated_at?: string
        }
        Update: {
          booking_id?: string
          computed_price_breakdown?: Json
          created_at?: string
          date_range_end?: string | null
          date_range_start?: string | null
          id?: string
          operator_id?: string
          product_availability_id?: string | null
          product_id?: string
          quantity?: number
          selected_days?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_products_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_products_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "booking_products_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_products_product_availability_id_fkey"
            columns: ["product_availability_id"]
            isOneToOne: false
            referencedRelation: "product_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_tags: {
        Row: {
          booking_id: string
          created_at: string
          tag_id: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          tag_id: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_tags_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "operator_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          approval_trace: Json | null
          balance_due: number
          booking_channel: Database["public"]["Enums"]["booking_channel_kind"]
          campaign_id: string | null
          cancellation_deadline: string
          created_at: string
          currency: string
          current_semantic_state: Database["public"]["Enums"]["booking_semantic_state"]
          current_stage_code: string
          current_stage_id: string
          custom_offer_applied: boolean | null
          custom_offer_applied_at: string | null
          custom_offer_applied_by_user_id: string | null
          custom_offer_free_spot_count: number | null
          custom_offer_group_discount_pct: number | null
          custom_offer_group_threshold: number | null
          custom_offer_notes: string | null
          customer_contact_id: string
          customer_declarations: Json | null
          customer_language: string | null
          customer_languages: string[] | null
          customer_other_languages: string | null
          deleted_at: string | null
          deleted_by_user_id: string | null
          deletion_reason: string | null
          gross_total: number
          group_id: string | null
          id: string
          import_source_id: string | null
          imported_from: string | null
          is_shared_double: boolean
          last_confirmation_context: Json | null
          last_confirmation_sent_at: string | null
          net_total: number
          offer_sent_at: string | null
          offer_sent_by_user_id: string | null
          operator_gross_total: number | null
          operator_id: string
          operator_net_total: number | null
          originating_agent_user_id: string | null
          override_applied_at: string | null
          override_applied_by_user_id: string | null
          override_gross_total: number | null
          override_reason: string | null
          search_text: string
          tax_total: number
          updated_at: string
          voucher_id_applied: string | null
        }
        Insert: {
          approval_trace?: Json | null
          balance_due?: number
          booking_channel: Database["public"]["Enums"]["booking_channel_kind"]
          campaign_id?: string | null
          cancellation_deadline: string
          created_at?: string
          currency?: string
          current_semantic_state: Database["public"]["Enums"]["booking_semantic_state"]
          current_stage_code: string
          current_stage_id: string
          custom_offer_applied?: boolean | null
          custom_offer_applied_at?: string | null
          custom_offer_applied_by_user_id?: string | null
          custom_offer_free_spot_count?: number | null
          custom_offer_group_discount_pct?: number | null
          custom_offer_group_threshold?: number | null
          custom_offer_notes?: string | null
          customer_contact_id: string
          customer_declarations?: Json | null
          customer_language?: string | null
          customer_languages?: string[] | null
          customer_other_languages?: string | null
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          gross_total?: number
          group_id?: string | null
          id?: string
          import_source_id?: string | null
          imported_from?: string | null
          is_shared_double?: boolean
          last_confirmation_context?: Json | null
          last_confirmation_sent_at?: string | null
          net_total?: number
          offer_sent_at?: string | null
          offer_sent_by_user_id?: string | null
          operator_gross_total?: number | null
          operator_id: string
          operator_net_total?: number | null
          originating_agent_user_id?: string | null
          override_applied_at?: string | null
          override_applied_by_user_id?: string | null
          override_gross_total?: number | null
          override_reason?: string | null
          search_text?: string
          tax_total?: number
          updated_at?: string
          voucher_id_applied?: string | null
        }
        Update: {
          approval_trace?: Json | null
          balance_due?: number
          booking_channel?: Database["public"]["Enums"]["booking_channel_kind"]
          campaign_id?: string | null
          cancellation_deadline?: string
          created_at?: string
          currency?: string
          current_semantic_state?: Database["public"]["Enums"]["booking_semantic_state"]
          current_stage_code?: string
          current_stage_id?: string
          custom_offer_applied?: boolean | null
          custom_offer_applied_at?: string | null
          custom_offer_applied_by_user_id?: string | null
          custom_offer_free_spot_count?: number | null
          custom_offer_group_discount_pct?: number | null
          custom_offer_group_threshold?: number | null
          custom_offer_notes?: string | null
          customer_contact_id?: string
          customer_declarations?: Json | null
          customer_language?: string | null
          customer_languages?: string[] | null
          customer_other_languages?: string | null
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          gross_total?: number
          group_id?: string | null
          id?: string
          import_source_id?: string | null
          imported_from?: string | null
          is_shared_double?: boolean
          last_confirmation_context?: Json | null
          last_confirmation_sent_at?: string | null
          net_total?: number
          offer_sent_at?: string | null
          offer_sent_by_user_id?: string | null
          operator_gross_total?: number | null
          operator_id?: string
          operator_net_total?: number | null
          originating_agent_user_id?: string | null
          override_applied_at?: string | null
          override_applied_by_user_id?: string | null
          override_gross_total?: number | null
          override_reason?: string | null
          search_text?: string
          tax_total?: number
          updated_at?: string
          voucher_id_applied?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_current_stage_id_fkey"
            columns: ["current_stage_id"]
            isOneToOne: false
            referencedRelation: "booking_lifecycle_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_custom_offer_applied_by_user_id_fkey"
            columns: ["custom_offer_applied_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_custom_offer_applied_by_user_id_fkey"
            columns: ["custom_offer_applied_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_customer_contact_id_fkey"
            columns: ["customer_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_customer_contact_id_fkey"
            columns: ["customer_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_offer_sent_by_user_id_fkey"
            columns: ["offer_sent_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_offer_sent_by_user_id_fkey"
            columns: ["offer_sent_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "bookings_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_originating_agent_user_id_fkey"
            columns: ["originating_agent_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_originating_agent_user_id_fkey"
            columns: ["originating_agent_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_override_applied_by_user_id_fkey"
            columns: ["override_applied_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_override_applied_by_user_id_fkey"
            columns: ["override_applied_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_voucher_id_applied_fkey"
            columns: ["voucher_id_applied"]
            isOneToOne: false
            referencedRelation: "vouchers"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          active: boolean
          code: string
          created_at: string
          deleted_at: string | null
          deleted_by_user_id: string | null
          deletion_reason: string | null
          description: string | null
          description_localized: Json | null
          end_date: string | null
          id: string
          kind: Database["public"]["Enums"]["campaign_kind"]
          label: string
          label_localized: Json | null
          operator_id: string
          scope: Database["public"]["Enums"]["campaign_scope"]
          sort_order: number
          start_date: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          description?: string | null
          description_localized?: Json | null
          end_date?: string | null
          id?: string
          kind: Database["public"]["Enums"]["campaign_kind"]
          label: string
          label_localized?: Json | null
          operator_id: string
          scope?: Database["public"]["Enums"]["campaign_scope"]
          sort_order?: number
          start_date: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          description?: string | null
          description_localized?: Json | null
          end_date?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["campaign_kind"]
          label?: string
          label_localized?: Json | null
          operator_id?: string
          scope?: Database["public"]["Enums"]["campaign_scope"]
          sort_order?: number
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "campaigns_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_adjustments: {
        Row: {
          adjustment_kind: Database["public"]["Enums"]["commission_adjustment_kind"]
          amount: number
          applied_to_batch_id: string | null
          created_at: string
          currency: string
          id: string
          notes: string | null
          operator_id: string
          original_commission_id: string
          triggered_by_refund_id: string | null
          triggered_by_user_id: string | null
        }
        Insert: {
          adjustment_kind: Database["public"]["Enums"]["commission_adjustment_kind"]
          amount: number
          applied_to_batch_id?: string | null
          created_at?: string
          currency: string
          id?: string
          notes?: string | null
          operator_id: string
          original_commission_id: string
          triggered_by_refund_id?: string | null
          triggered_by_user_id?: string | null
        }
        Update: {
          adjustment_kind?: Database["public"]["Enums"]["commission_adjustment_kind"]
          amount?: number
          applied_to_batch_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          operator_id?: string
          original_commission_id?: string
          triggered_by_refund_id?: string | null
          triggered_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_adjustments_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "commission_adjustments_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_adjustments_original_commission_id_fkey"
            columns: ["original_commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_adjustments_triggered_by_refund_id_fkey"
            columns: ["triggered_by_refund_id"]
            isOneToOne: false
            referencedRelation: "payment_refunds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_adjustments_triggered_by_user_id_fkey"
            columns: ["triggered_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_adjustments_triggered_by_user_id_fkey"
            columns: ["triggered_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_batches: {
        Row: {
          commissions_total: number
          created_at: string
          currency: string
          fixed_fee_amount: number
          grand_total: number | null
          id: string
          notes: string | null
          operator_id: string
          paid_at: string | null
          period_end: string
          period_start: string
          sealed_at: string | null
          sealed_by_user_id: string | null
          status: Database["public"]["Enums"]["commission_batch_status"]
        }
        Insert: {
          commissions_total?: number
          created_at?: string
          currency: string
          fixed_fee_amount?: number
          grand_total?: number | null
          id?: string
          notes?: string | null
          operator_id: string
          paid_at?: string | null
          period_end: string
          period_start: string
          sealed_at?: string | null
          sealed_by_user_id?: string | null
          status?: Database["public"]["Enums"]["commission_batch_status"]
        }
        Update: {
          commissions_total?: number
          created_at?: string
          currency?: string
          fixed_fee_amount?: number
          grand_total?: number | null
          id?: string
          notes?: string | null
          operator_id?: string
          paid_at?: string | null
          period_end?: string
          period_start?: string
          sealed_at?: string | null
          sealed_by_user_id?: string | null
          status?: Database["public"]["Enums"]["commission_batch_status"]
        }
        Relationships: [
          {
            foreignKeyName: "commission_batches_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "commission_batches_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_batches_sealed_by_user_id_fkey"
            columns: ["sealed_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_batches_sealed_by_user_id_fkey"
            columns: ["sealed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_rule_tiers: {
        Row: {
          commission_rule_id: string
          created_at: string
          fixed_amount: number | null
          id: string
          operator_id: string
          rate: number | null
          threshold_max: number | null
          threshold_min: number
          updated_at: string
        }
        Insert: {
          commission_rule_id: string
          created_at?: string
          fixed_amount?: number | null
          id?: string
          operator_id: string
          rate?: number | null
          threshold_max?: number | null
          threshold_min: number
          updated_at?: string
        }
        Update: {
          commission_rule_id?: string
          created_at?: string
          fixed_amount?: number | null
          id?: string
          operator_id?: string
          rate?: number | null
          threshold_max?: number | null
          threshold_min?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_rule_tiers_commission_rule_id_fkey"
            columns: ["commission_rule_id"]
            isOneToOne: false
            referencedRelation: "commission_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_rule_tiers_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "commission_rule_tiers_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_rules: {
        Row: {
          active: boolean
          applies_to_contract_id: string | null
          conditions: Json | null
          created_at: string
          deleted_at: string | null
          deleted_by_user_id: string | null
          deletion_reason: string | null
          id: string
          operator_id: string
          params: Json
          rule_kind: Database["public"]["Enums"]["commission_rule_kind"]
          scheme_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          applies_to_contract_id?: string | null
          conditions?: Json | null
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          id?: string
          operator_id: string
          params?: Json
          rule_kind: Database["public"]["Enums"]["commission_rule_kind"]
          scheme_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          applies_to_contract_id?: string | null
          conditions?: Json | null
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          id?: string
          operator_id?: string
          params?: Json
          rule_kind?: Database["public"]["Enums"]["commission_rule_kind"]
          scheme_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_rules_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_rules_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_rules_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "commission_rules_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_rules_scheme_id_fkey"
            columns: ["scheme_id"]
            isOneToOne: false
            referencedRelation: "commission_schemes"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_schemes: {
        Row: {
          active: boolean
          created_at: string
          currency: string
          deleted_at: string | null
          deleted_by_user_id: string | null
          deletion_reason: string | null
          id: string
          name: string
          notes: string | null
          operator_id: string
          recipient_kind: Database["public"]["Enums"]["commission_recipient_kind"]
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          currency: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          id?: string
          name: string
          notes?: string | null
          operator_id: string
          recipient_kind: Database["public"]["Enums"]["commission_recipient_kind"]
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          currency?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          id?: string
          name?: string
          notes?: string | null
          operator_id?: string
          recipient_kind?: Database["public"]["Enums"]["commission_recipient_kind"]
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_schemes_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_schemes_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_schemes_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "commission_schemes_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          applied_rules: Json
          base_amount: number
          booking_id: string
          commission_amount: number
          commission_rule_id: string
          created_at: string
          currency: string
          id: string
          notes: string | null
          operator_id: string
          payout_batch_id: string | null
          status: Database["public"]["Enums"]["commission_status"]
        }
        Insert: {
          applied_rules?: Json
          base_amount: number
          booking_id: string
          commission_amount: number
          commission_rule_id: string
          created_at?: string
          currency: string
          id?: string
          notes?: string | null
          operator_id: string
          payout_batch_id?: string | null
          status?: Database["public"]["Enums"]["commission_status"]
        }
        Update: {
          applied_rules?: Json
          base_amount?: number
          booking_id?: string
          commission_amount?: number
          commission_rule_id?: string
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          operator_id?: string
          payout_batch_id?: string | null
          status?: Database["public"]["Enums"]["commission_status"]
        }
        Relationships: [
          {
            foreignKeyName: "commissions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_commission_rule_id_fkey"
            columns: ["commission_rule_id"]
            isOneToOne: false
            referencedRelation: "commission_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "commissions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_payout_batch_id_fkey"
            columns: ["payout_batch_id"]
            isOneToOne: false
            referencedRelation: "commission_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_tags: {
        Row: {
          contact_id: string
          created_at: string
          tag_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          tag_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_tags_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_tags_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "operator_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          deleted_at: string | null
          deleted_by_user_id: string | null
          deletion_reason: string | null
          do_not_contact: boolean
          email: string | null
          external_contact_id: string | null
          external_target: string | null
          first_name: string | null
          gdpr_erased_at: string | null
          gdpr_erased_by_user_id: string | null
          gdpr_erasure_note: string | null
          id: string
          last_name: string | null
          operator_id: string
          phone: string | null
          preferred_locale: string | null
          preferred_timezone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          do_not_contact?: boolean
          email?: string | null
          external_contact_id?: string | null
          external_target?: string | null
          first_name?: string | null
          gdpr_erased_at?: string | null
          gdpr_erased_by_user_id?: string | null
          gdpr_erasure_note?: string | null
          id?: string
          last_name?: string | null
          operator_id: string
          phone?: string | null
          preferred_locale?: string | null
          preferred_timezone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          do_not_contact?: boolean
          email?: string | null
          external_contact_id?: string | null
          external_target?: string | null
          first_name?: string | null
          gdpr_erased_at?: string | null
          gdpr_erased_by_user_id?: string | null
          gdpr_erasure_note?: string | null
          id?: string
          last_name?: string | null
          operator_id?: string
          phone?: string | null
          preferred_locale?: string | null
          preferred_timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_gdpr_erased_by_user_id_fkey"
            columns: ["gdpr_erased_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_gdpr_erased_by_user_id_fkey"
            columns: ["gdpr_erased_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "contacts_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      countries: {
        Row: {
          code: string
          created_at: string
          name_de: string
          name_en: string
        }
        Insert: {
          code: string
          created_at?: string
          name_de: string
          name_en: string
        }
        Update: {
          code?: string
          created_at?: string
          name_de?: string
          name_en?: string
        }
        Relationships: []
      }
      custom_offer_lines: {
        Row: {
          booking_id: string
          booking_participant_id: string | null
          created_at: string
          deleted_at: string | null
          deleted_by_user_id: string | null
          deletion_reason: string | null
          id: string
          is_free: boolean
          label: string | null
          notes: string | null
          operator_id: string
          sort_order: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          booking_id: string
          booking_participant_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          id?: string
          is_free?: boolean
          label?: string | null
          notes?: string | null
          operator_id: string
          sort_order?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          booking_id?: string
          booking_participant_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          id?: string
          is_free?: boolean
          label?: string | null
          notes?: string | null
          operator_id?: string
          sort_order?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_offer_lines_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_offer_lines_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_offer_lines_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_offer_lines_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "custom_offer_lines_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_offer_lines_participant_id_fkey"
            columns: ["booking_participant_id"]
            isOneToOne: false
            referencedRelation: "booking_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_offer_lines_participant_id_fkey"
            columns: ["booking_participant_id"]
            isOneToOne: false
            referencedRelation: "participant_days"
            referencedColumns: ["booking_participant_id"]
          },
        ]
      }
      devices: {
        Row: {
          created_at: string | null
          fcm_token: string
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          fcm_token: string
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          fcm_token?: string
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      disciplines: {
        Row: {
          approved: boolean
          created_at: string
          id: string
          label_de: string
          label_en: string
          slug: string
          sport_id: string
          submitted_by: string | null
        }
        Insert: {
          approved?: boolean
          created_at?: string
          id?: string
          label_de: string
          label_en: string
          slug: string
          sport_id: string
          submitted_by?: string | null
        }
        Update: {
          approved?: boolean
          created_at?: string
          id?: string
          label_de?: string
          label_en?: string
          slug?: string
          sport_id?: string
          submitted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "disciplines_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disciplines_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disciplines_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      dns_provisioning_jobs: {
        Row: {
          applied_at: string | null
          created_at: string
          domain: string
          id: string
          last_error: string | null
          operator_id: string | null
          provider: string
          records: Json
          status: string
          updated_at: string
        }
        Insert: {
          applied_at?: string | null
          created_at?: string
          domain: string
          id?: string
          last_error?: string | null
          operator_id?: string | null
          provider?: string
          records: Json
          status?: string
          updated_at?: string
        }
        Update: {
          applied_at?: string | null
          created_at?: string
          domain?: string
          id?: string
          last_error?: string | null
          operator_id?: string | null
          provider?: string
          records?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dns_provisioning_jobs_op_fk"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "dns_provisioning_jobs_op_fk"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          active: boolean
          body_html: string
          body_text: string
          created_at: string
          deleted_at: string | null
          deleted_by_user_id: string | null
          deletion_reason: string | null
          id: string
          locale: string
          operator_id: string
          subject: string
          template_kind: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          body_html: string
          body_text: string
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          id?: string
          locale: string
          operator_id: string
          subject: string
          template_kind: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          body_html?: string
          body_text?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          id?: string
          locale?: string
          operator_id?: string
          subject?: string
          template_kind?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_templates_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_templates_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "email_templates_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      external_sync_log: {
        Row: {
          action: string
          attempt_count: number
          booking_id: string | null
          contact_id: string | null
          created_at: string
          external_reference: string | null
          external_target: string
          failure_reason: string | null
          id: string
          last_attempt_at: string | null
          next_retry_at: string | null
          notes: string | null
          operator_id: string
          payload: Json
          status: Database["public"]["Enums"]["external_sync_status"]
          succeeded_at: string | null
        }
        Insert: {
          action: string
          attempt_count?: number
          booking_id?: string | null
          contact_id?: string | null
          created_at?: string
          external_reference?: string | null
          external_target: string
          failure_reason?: string | null
          id?: string
          last_attempt_at?: string | null
          next_retry_at?: string | null
          notes?: string | null
          operator_id: string
          payload?: Json
          status?: Database["public"]["Enums"]["external_sync_status"]
          succeeded_at?: string | null
        }
        Update: {
          action?: string
          attempt_count?: number
          booking_id?: string | null
          contact_id?: string | null
          created_at?: string
          external_reference?: string | null
          external_target?: string
          failure_reason?: string | null
          id?: string
          last_attempt_at?: string | null
          next_retry_at?: string | null
          notes?: string | null
          operator_id?: string
          payload?: Json
          status?: Database["public"]["Enums"]["external_sync_status"]
          succeeded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_sync_log_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_sync_log_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_sync_log_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_sync_log_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "external_sync_log_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      features: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          default_enabled: boolean
          description: string | null
          id: string
          key: string
          name: string
          sort_order: number
          status: string
          surface: string
          updated_at: string
          value_schema: Json | null
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          default_enabled?: boolean
          description?: string | null
          id?: string
          key: string
          name: string
          sort_order?: number
          status?: string
          surface: string
          updated_at?: string
          value_schema?: Json | null
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          default_enabled?: boolean
          description?: string | null
          id?: string
          key?: string
          name?: string
          sort_order?: number
          status?: string
          surface?: string
          updated_at?: string
          value_schema?: Json | null
        }
        Relationships: []
      }
      form_fields: {
        Row: {
          created_at: string
          field_type: string
          form_id: string
          help_text: string | null
          help_text_localized: Json | null
          id: string
          key: string
          label: string
          label_localized: Json | null
          operator_id: string
          options: Json | null
          position: number
          required: boolean
          updated_at: string
          validation: Json | null
          visibility_rule: Json | null
        }
        Insert: {
          created_at?: string
          field_type: string
          form_id: string
          help_text?: string | null
          help_text_localized?: Json | null
          id?: string
          key: string
          label: string
          label_localized?: Json | null
          operator_id: string
          options?: Json | null
          position?: number
          required?: boolean
          updated_at?: string
          validation?: Json | null
          visibility_rule?: Json | null
        }
        Update: {
          created_at?: string
          field_type?: string
          form_id?: string
          help_text?: string | null
          help_text_localized?: Json | null
          id?: string
          key?: string
          label?: string
          label_localized?: Json | null
          operator_id?: string
          options?: Json | null
          position?: number
          required?: boolean
          updated_at?: string
          validation?: Json | null
          visibility_rule?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "form_fields_form_id_operator_id_fkey"
            columns: ["form_id", "operator_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id", "operator_id"]
          },
          {
            foreignKeyName: "form_fields_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "form_fields_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          description_localized: Json | null
          id: string
          key: string
          name: string
          name_localized: Json | null
          operator_id: string
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          description_localized?: Json | null
          id?: string
          key: string
          name: string
          name_localized?: Json | null
          operator_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          description_localized?: Json | null
          id?: string
          key?: string
          name?: string
          name_localized?: Json | null
          operator_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "forms_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "forms_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      gear_photos: {
        Row: {
          created_at: string
          gear_subject_id: string
          id: string
          media_id: string
        }
        Insert: {
          created_at?: string
          gear_subject_id: string
          id?: string
          media_id: string
        }
        Update: {
          created_at?: string
          gear_subject_id?: string
          id?: string
          media_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gear_photos_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: true
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      gear_types: {
        Row: {
          created_at: string
          default_service_interval_months: number | null
          id: string
          label_de: string
          label_en: string
          slug: string
          sport_id: string | null
        }
        Insert: {
          created_at?: string
          default_service_interval_months?: number | null
          id?: string
          label_de: string
          label_en: string
          slug: string
          sport_id?: string | null
        }
        Update: {
          created_at?: string
          default_service_interval_months?: number | null
          id?: string
          label_de?: string
          label_en?: string
          slug?: string
          sport_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gear_types_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          billing_arrangement: Database["public"]["Enums"]["group_billing_arrangement"]
          contact_person_id: string | null
          created_at: string
          deleted_at: string | null
          deleted_by_user_id: string | null
          deletion_reason: string | null
          id: string
          name: string
          name_localized: Json | null
          notes: string | null
          operator_id: string
          updated_at: string
        }
        Insert: {
          billing_arrangement?: Database["public"]["Enums"]["group_billing_arrangement"]
          contact_person_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          id?: string
          name: string
          name_localized?: Json | null
          notes?: string | null
          operator_id: string
          updated_at?: string
        }
        Update: {
          billing_arrangement?: Database["public"]["Enums"]["group_billing_arrangement"]
          contact_person_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          id?: string
          name?: string
          name_localized?: Json | null
          notes?: string | null
          operator_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_contact_person_id_fkey"
            columns: ["contact_person_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_contact_person_id_fkey"
            columns: ["contact_person_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "groups_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_details: {
        Row: {
          address: string | null
          checkin_time: string | null
          checkout_time: string | null
          contact_email: string | null
          created_at: string
          location_id: string
          maps_link: string | null
          phone: string | null
          timezone: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          checkin_time?: string | null
          checkout_time?: string | null
          contact_email?: string | null
          created_at?: string
          location_id: string
          maps_link?: string | null
          phone?: string | null
          timezone?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          checkin_time?: string | null
          checkout_time?: string | null
          contact_email?: string | null
          created_at?: string
          location_id?: string
          maps_link?: string | null
          phone?: string | null
          timezone?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hotel_details_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: true
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_webhook_events: {
        Row: {
          event_id: string
          event_type: string
          id: string
          operator_id: string | null
          payload: Json
          processed_at: string | null
          provider: string
          received_at: string
        }
        Insert: {
          event_id: string
          event_type: string
          id?: string
          operator_id?: string | null
          payload: Json
          processed_at?: string | null
          provider: string
          received_at?: string
        }
        Update: {
          event_id?: string
          event_type?: string
          id?: string
          operator_id?: string | null
          payload?: Json
          processed_at?: string | null
          provider?: string
          received_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbound_webhook_events_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "inbound_webhook_events_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiry_rate_limits: {
        Row: {
          count: number
          created_at: string
          id: number
          ip_addr: string
          token: string
          updated_at: string
          window_start: string
        }
        Insert: {
          count?: number
          created_at?: string
          id?: never
          ip_addr: string
          token: string
          updated_at?: string
          window_start: string
        }
        Update: {
          count?: number
          created_at?: string
          id?: never
          ip_addr?: string
          token?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      labels: {
        Row: {
          area: string
          color: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          area: string
          color?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          area?: string
          color?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      license_types: {
        Row: {
          created_at: string
          id: string
          label_de: string
          label_en: string
          slug: string
          sport_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label_de: string
          label_en: string
          slug: string
          sport_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label_de?: string
          label_en?: string
          slug?: string
          sport_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "license_types_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      location_role_types: {
        Row: {
          active: boolean
          code: string
          created_at: string
          deleted_at: string | null
          deleted_by_user_id: string | null
          deletion_reason: string | null
          id: string
          label: string
          label_localized: Json | null
          operator_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          id?: string
          label: string
          label_localized?: Json | null
          operator_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          id?: string
          label?: string
          label_localized?: Json | null
          operator_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_role_types_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_role_types_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_role_types_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "location_role_types_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          created_at: string
          deleted_at: string | null
          deleted_by_user_id: string | null
          deletion_reason: string | null
          email: string | null
          geo: Json | null
          id: string
          name: string
          name_localized: Json | null
          operator_id: string
          parent_id: string | null
          role_type_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          email?: string | null
          geo?: Json | null
          id?: string
          name: string
          name_localized?: Json | null
          operator_id: string
          parent_id?: string | null
          role_type_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          email?: string | null
          geo?: Json | null
          id?: string
          name?: string
          name_localized?: Json | null
          operator_id?: string
          parent_id?: string | null
          role_type_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "locations_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_role_type_id_fkey"
            columns: ["role_type_id"]
            isOneToOne: false
            referencedRelation: "location_role_types"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          bucket_id: string
          created_at: string
          height: number | null
          id: string
          mime_type: string
          moderation_status: string
          object_path: string
          subject_type: string | null
          updated_at: string
          uploader_id: string | null
          width: number | null
        }
        Insert: {
          bucket_id: string
          created_at?: string
          height?: number | null
          id?: string
          mime_type: string
          moderation_status?: string
          object_path: string
          subject_type?: string | null
          updated_at?: string
          uploader_id?: string | null
          width?: number | null
        }
        Update: {
          bucket_id?: string
          created_at?: string
          height?: number | null
          id?: string
          mime_type?: string
          moderation_status?: string
          object_path?: string
          subject_type?: string | null
          updated_at?: string
          uploader_id?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      member_disciplines: {
        Row: {
          created_at: string
          discipline_id: string
          hours_per_year: number | null
          skill_level: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          discipline_id: string
          hours_per_year?: number | null
          skill_level?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          discipline_id?: string
          hours_per_year?: number | null
          skill_level?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_disciplines_discipline_id_fkey"
            columns: ["discipline_id"]
            isOneToOne: false
            referencedRelation: "disciplines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_disciplines_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "member_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "member_disciplines_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "member_profiles_public"
            referencedColumns: ["user_id"]
          },
        ]
      }
      member_profiles: {
        Row: {
          accept_messages_from: string[]
          avatar_source: string
          avatar_url: string | null
          bio: string | null
          birthday: string | null
          birthday_visibility: string
          created_at: string
          gender: string | null
          name: string
          open_to_meeting_people: boolean
          relationship_status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accept_messages_from?: string[]
          avatar_source?: string
          avatar_url?: string | null
          bio?: string | null
          birthday?: string | null
          birthday_visibility?: string
          created_at?: string
          gender?: string | null
          name: string
          open_to_meeting_people?: boolean
          relationship_status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accept_messages_from?: string[]
          avatar_source?: string
          avatar_url?: string | null
          bio?: string | null
          birthday?: string | null
          birthday_visibility?: string
          created_at?: string
          gender?: string | null
          name?: string
          open_to_meeting_people?: boolean
          relationship_status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          deleted_for_recipient: boolean
          deleted_for_sender: boolean
          id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
          sent_at: string
        }
        Insert: {
          body: string
          created_at?: string
          deleted_for_recipient?: boolean
          deleted_for_sender?: boolean
          id?: string
          read_at?: string | null
          recipient_id: string
          sender_id: string
          sent_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          deleted_for_recipient?: boolean
          deleted_for_sender?: boolean
          id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "member_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "member_profiles_public"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "member_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "member_profiles_public"
            referencedColumns: ["user_id"]
          },
        ]
      }
      notification_digest_queue: {
        Row: {
          body: string | null
          created_at: string
          delivery_mode: Database["public"]["Enums"]["notification_delivery_mode"]
          drained_at: string | null
          error: string | null
          event_at: string
          event_type: string
          id: string
          notification_id: string | null
          operator_id: string | null
          send_email: boolean
          send_push: boolean
          status: Database["public"]["Enums"]["digest_queue_status"]
          ticket_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          delivery_mode?: Database["public"]["Enums"]["notification_delivery_mode"]
          drained_at?: string | null
          error?: string | null
          event_at?: string
          event_type: string
          id?: string
          notification_id?: string | null
          operator_id?: string | null
          send_email?: boolean
          send_push?: boolean
          status?: Database["public"]["Enums"]["digest_queue_status"]
          ticket_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          delivery_mode?: Database["public"]["Enums"]["notification_delivery_mode"]
          drained_at?: string | null
          error?: string | null
          event_at?: string
          event_type?: string
          id?: string
          notification_id?: string | null
          operator_id?: string | null
          send_email?: boolean
          send_push?: boolean
          status?: Database["public"]["Enums"]["digest_queue_status"]
          ticket_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_digest_queue_notification_fk"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_digest_queue_ticket_fk"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_digest_queue_ticket_fk"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_digest_queue_user_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_digest_queue_user_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          bell: boolean
          created_at: string
          delivery_mode: Database["public"]["Enums"]["notification_delivery_mode"]
          email: boolean
          push: boolean
          updated_at: string
          user_id: string
          web_push: boolean
        }
        Insert: {
          bell?: boolean
          created_at?: string
          delivery_mode?: Database["public"]["Enums"]["notification_delivery_mode"]
          email?: boolean
          push?: boolean
          updated_at?: string
          user_id: string
          web_push?: boolean
        }
        Update: {
          bell?: boolean
          created_at?: string
          delivery_mode?: Database["public"]["Enums"]["notification_delivery_mode"]
          email?: boolean
          push?: boolean
          updated_at?: string
          user_id?: string
          web_push?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_fk"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_preferences_user_fk"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          echo_dispatched_at: string | null
          event_type: string
          id: string
          link: string | null
          read_at: string | null
          ticket_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          echo_dispatched_at?: string | null
          event_type: string
          id?: string
          link?: string | null
          read_at?: string | null
          ticket_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          echo_dispatched_at?: string | null
          event_type?: string
          id?: string
          link?: string | null
          read_at?: string | null
          ticket_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_ticket_fk"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_ticket_fk"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_checklist_templates: {
        Row: {
          created_at: string
          items: Json
          operator_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          items?: Json
          operator_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          items?: Json
          operator_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_checklist_templates_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: true
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "operator_checklist_templates_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: true
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_email_sender: {
        Row: {
          created_at: string
          dns_provider: string | null
          dns_records: Json | null
          from_local_part: string
          from_name: string | null
          id: string
          last_error: string | null
          operator_id: string
          resend_domain_id: string | null
          sending_domain: string
          updated_at: string
          verification_status: string
        }
        Insert: {
          created_at?: string
          dns_provider?: string | null
          dns_records?: Json | null
          from_local_part?: string
          from_name?: string | null
          id?: string
          last_error?: string | null
          operator_id: string
          resend_domain_id?: string | null
          sending_domain: string
          updated_at?: string
          verification_status?: string
        }
        Update: {
          created_at?: string
          dns_provider?: string | null
          dns_records?: Json | null
          from_local_part?: string
          from_name?: string | null
          id?: string
          last_error?: string | null
          operator_id?: string
          resend_domain_id?: string | null
          sending_domain?: string
          updated_at?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_email_sender_op_fk"
            columns: ["operator_id"]
            isOneToOne: true
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "operator_email_sender_op_fk"
            columns: ["operator_id"]
            isOneToOne: true
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_features: {
        Row: {
          config: Json | null
          created_at: string
          enabled: boolean | null
          enabled_at: string
          enabled_by_user_id: string | null
          feature_id: string
          note: string | null
          operator_id: string
          updated_at: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          enabled?: boolean | null
          enabled_at?: string
          enabled_by_user_id?: string | null
          feature_id: string
          note?: string | null
          operator_id: string
          updated_at?: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          enabled?: boolean | null
          enabled_at?: string
          enabled_by_user_id?: string | null
          feature_id?: string
          note?: string | null
          operator_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_features_enabled_by_user_id_fkey"
            columns: ["enabled_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_features_enabled_by_user_id_fkey"
            columns: ["enabled_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_features_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_features_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "operator_features_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_ical_tokens: {
        Row: {
          created_at: string
          operator_id: string
          token: string
        }
        Insert: {
          created_at?: string
          operator_id: string
          token: string
        }
        Update: {
          created_at?: string
          operator_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_ical_tokens_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: true
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "operator_ical_tokens_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: true
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_integration_credentials: {
        Row: {
          created_at: string
          holded_api_key_encrypted: string | null
          holded_numbering_series_id: string | null
          holded_sales_tax_key: string | null
          holded_webhook_secret_encrypted: string | null
          id: string
          mode: string
          operator_id: string
          provider: string
          stripe_publishable_key: string | null
          stripe_secret_key_encrypted: string | null
          stripe_webhook_secret_encrypted: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          holded_api_key_encrypted?: string | null
          holded_numbering_series_id?: string | null
          holded_sales_tax_key?: string | null
          holded_webhook_secret_encrypted?: string | null
          id?: string
          mode: string
          operator_id: string
          provider: string
          stripe_publishable_key?: string | null
          stripe_secret_key_encrypted?: string | null
          stripe_webhook_secret_encrypted?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          holded_api_key_encrypted?: string | null
          holded_numbering_series_id?: string | null
          holded_sales_tax_key?: string | null
          holded_webhook_secret_encrypted?: string | null
          id?: string
          mode?: string
          operator_id?: string
          provider?: string
          stripe_publishable_key?: string | null
          stripe_secret_key_encrypted?: string | null
          stripe_webhook_secret_encrypted?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operator_integration_credentials_op_fk"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "operator_integration_credentials_op_fk"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_integration_credentials_updated_by_fk"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_integration_credentials_updated_by_fk"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_integration_usage: {
        Row: {
          checked_at: string
          id: string
          mode: string
          next_limit: number | null
          next_plan: string | null
          operator_id: string
          period: string
          provider: string
          quota_limit: number
          usage: number
        }
        Insert: {
          checked_at?: string
          id?: string
          mode: string
          next_limit?: number | null
          next_plan?: string | null
          operator_id: string
          period: string
          provider: string
          quota_limit: number
          usage: number
        }
        Update: {
          checked_at?: string
          id?: string
          mode?: string
          next_limit?: number | null
          next_plan?: string | null
          operator_id?: string
          period?: string
          provider?: string
          quota_limit?: number
          usage?: number
        }
        Relationships: [
          {
            foreignKeyName: "operator_integration_usage_op_fk"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "operator_integration_usage_op_fk"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_memberships: {
        Row: {
          can_publish_site_warnings: boolean
          contact_id: string | null
          created_at: string
          id: string
          is_release_signer: boolean
          landing_surface: string
          landing_view_id: string | null
          operator_id: string
          permissions: Json | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_publish_site_warnings?: boolean
          contact_id?: string | null
          created_at?: string
          id?: string
          is_release_signer?: boolean
          landing_surface?: string
          landing_view_id?: string | null
          operator_id: string
          permissions?: Json | null
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_publish_site_warnings?: boolean
          contact_id?: string | null
          created_at?: string
          id?: string
          is_release_signer?: boolean
          landing_surface?: string
          landing_view_id?: string | null
          operator_id?: string
          permissions?: Json | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_memberships_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_memberships_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_memberships_landing_view_id_fkey"
            columns: ["landing_view_id"]
            isOneToOne: false
            referencedRelation: "saved_views"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_memberships_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "operator_memberships_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_offers: {
        Row: {
          created_at: string
          cta_label: string | null
          cta_url: string | null
          deleted_at: string | null
          deleted_by_user_id: string | null
          deletion_reason: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          operator_id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          operator_id: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          operator_id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_offers_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_offers_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_offers_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "operator_offers_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_site_services: {
        Row: {
          active: boolean
          activity_site_id: string
          created_at: string
          id: string
          note: string | null
          operator_id: string
          product_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          activity_site_id: string
          created_at?: string
          id?: string
          note?: string | null
          operator_id: string
          product_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          activity_site_id?: string
          created_at?: string
          id?: string
          note?: string | null
          operator_id?: string
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_site_services_activity_site_fkey"
            columns: ["activity_site_id"]
            isOneToOne: false
            referencedRelation: "activity_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_site_services_operator_product_fkey"
            columns: ["operator_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["operator_id", "id"]
          },
        ]
      }
      operator_tags: {
        Row: {
          color: string
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          operator_id: string
          updated_at: string
        }
        Insert: {
          color: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          operator_id: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          operator_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_tags_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "operator_tags_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      operators: {
        Row: {
          audit_log_retention_days: number | null
          city: string | null
          country: string
          created_at: string
          date_format: string
          date_format_short: string | null
          default_locale: string
          default_tax_rate: number
          expose_seats_to_customer: boolean
          first_day_of_week: number
          group_discount_threshold: number
          holded_api_key_encrypted: string | null
          holded_approve_mode: Database["public"]["Enums"]["holded_approve_mode"]
          holded_transfer_mode: Database["public"]["Enums"]["holded_transfer_mode"]
          hotel_email_locale: string | null
          id: string
          invoice_bic_encrypted: string | null
          invoice_iban_encrypted: string | null
          invoice_notes: string | null
          legal_name: string | null
          logo_dark_url: string | null
          logo_url: string | null
          name: string | null
          offer_account_link: boolean
          onboarded_at: string | null
          phone: string | null
          postal_code: string | null
          primary_color: string | null
          public_contact_email: string | null
          region: string | null
          require_declarations: boolean
          show_premium_teasers: boolean
          skip_general_for_hotel: boolean
          slug: string
          street: string | null
          subscription_package_id: string
          tax_id: string | null
          tax_id_kind: Database["public"]["Enums"]["tax_id_kind"] | null
          theme: Json | null
          time_format_24h: boolean
          timezone: string
          updated_at: string
          weather_enabled: boolean
          weather_lat: number | null
          weather_lon: number | null
          weather_provider: string | null
          widget_catalog_layout: string | null
          widget_category_columns: number | null
          widget_description: string | null
          widget_description_first_page_only: boolean
          widget_footer: string | null
          widget_footer_first_page_only: boolean
          widget_headline: string | null
          widget_headline_first_page_only: boolean
          widget_preview_token: string
          widget_tile_aspect: string | null
          widget_tile_font: string | null
          widget_tile_hover: string | null
          widget_tile_radius: string | null
          widget_tile_scrim: string | null
          widget_title_case: string | null
          widget_token: string
          widget_variant: string | null
          work_hours_end: string
          work_hours_start: string
        }
        Insert: {
          audit_log_retention_days?: number | null
          city?: string | null
          country: string
          created_at?: string
          date_format?: string
          date_format_short?: string | null
          default_locale?: string
          default_tax_rate?: number
          expose_seats_to_customer?: boolean
          first_day_of_week?: number
          group_discount_threshold?: number
          holded_api_key_encrypted?: string | null
          holded_approve_mode?: Database["public"]["Enums"]["holded_approve_mode"]
          holded_transfer_mode?: Database["public"]["Enums"]["holded_transfer_mode"]
          hotel_email_locale?: string | null
          id?: string
          invoice_bic_encrypted?: string | null
          invoice_iban_encrypted?: string | null
          invoice_notes?: string | null
          legal_name?: string | null
          logo_dark_url?: string | null
          logo_url?: string | null
          name?: string | null
          offer_account_link?: boolean
          onboarded_at?: string | null
          phone?: string | null
          postal_code?: string | null
          primary_color?: string | null
          public_contact_email?: string | null
          region?: string | null
          require_declarations?: boolean
          show_premium_teasers?: boolean
          skip_general_for_hotel?: boolean
          slug: string
          street?: string | null
          subscription_package_id: string
          tax_id?: string | null
          tax_id_kind?: Database["public"]["Enums"]["tax_id_kind"] | null
          theme?: Json | null
          time_format_24h?: boolean
          timezone: string
          updated_at?: string
          weather_enabled?: boolean
          weather_lat?: number | null
          weather_lon?: number | null
          weather_provider?: string | null
          widget_catalog_layout?: string | null
          widget_category_columns?: number | null
          widget_description?: string | null
          widget_description_first_page_only?: boolean
          widget_footer?: string | null
          widget_footer_first_page_only?: boolean
          widget_headline?: string | null
          widget_headline_first_page_only?: boolean
          widget_preview_token?: string
          widget_tile_aspect?: string | null
          widget_tile_font?: string | null
          widget_tile_hover?: string | null
          widget_tile_radius?: string | null
          widget_tile_scrim?: string | null
          widget_title_case?: string | null
          widget_token?: string
          widget_variant?: string | null
          work_hours_end?: string
          work_hours_start?: string
        }
        Update: {
          audit_log_retention_days?: number | null
          city?: string | null
          country?: string
          created_at?: string
          date_format?: string
          date_format_short?: string | null
          default_locale?: string
          default_tax_rate?: number
          expose_seats_to_customer?: boolean
          first_day_of_week?: number
          group_discount_threshold?: number
          holded_api_key_encrypted?: string | null
          holded_approve_mode?: Database["public"]["Enums"]["holded_approve_mode"]
          holded_transfer_mode?: Database["public"]["Enums"]["holded_transfer_mode"]
          hotel_email_locale?: string | null
          id?: string
          invoice_bic_encrypted?: string | null
          invoice_iban_encrypted?: string | null
          invoice_notes?: string | null
          legal_name?: string | null
          logo_dark_url?: string | null
          logo_url?: string | null
          name?: string | null
          offer_account_link?: boolean
          onboarded_at?: string | null
          phone?: string | null
          postal_code?: string | null
          primary_color?: string | null
          public_contact_email?: string | null
          region?: string | null
          require_declarations?: boolean
          show_premium_teasers?: boolean
          skip_general_for_hotel?: boolean
          slug?: string
          street?: string | null
          subscription_package_id?: string
          tax_id?: string | null
          tax_id_kind?: Database["public"]["Enums"]["tax_id_kind"] | null
          theme?: Json | null
          time_format_24h?: boolean
          timezone?: string
          updated_at?: string
          weather_enabled?: boolean
          weather_lat?: number | null
          weather_lon?: number | null
          weather_provider?: string | null
          widget_catalog_layout?: string | null
          widget_category_columns?: number | null
          widget_description?: string | null
          widget_description_first_page_only?: boolean
          widget_footer?: string | null
          widget_footer_first_page_only?: boolean
          widget_headline?: string | null
          widget_headline_first_page_only?: boolean
          widget_preview_token?: string
          widget_tile_aspect?: string | null
          widget_tile_font?: string | null
          widget_tile_hover?: string | null
          widget_tile_radius?: string | null
          widget_tile_scrim?: string | null
          widget_title_case?: string | null
          widget_token?: string
          widget_variant?: string | null
          work_hours_end?: string
          work_hours_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "operators_subscription_package_id_fkey"
            columns: ["subscription_package_id"]
            isOneToOne: false
            referencedRelation: "subscription_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      outbound_emails: {
        Row: {
          body_html: string
          body_text: string
          claimed_at: string | null
          created_at: string
          id: string
          last_error: string | null
          locale: string
          next_attempt_at: string | null
          operator_id: string
          related_booking_id: string | null
          related_payment_id: string | null
          reply_to: string | null
          resent_from_id: string | null
          retries: number
          sent_at: string | null
          sent_via: string | null
          status: Database["public"]["Enums"]["outbound_email_status"]
          subject: string
          template_kind: string
          to_address: string
        }
        Insert: {
          body_html: string
          body_text: string
          claimed_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          locale: string
          next_attempt_at?: string | null
          operator_id: string
          related_booking_id?: string | null
          related_payment_id?: string | null
          reply_to?: string | null
          resent_from_id?: string | null
          retries?: number
          sent_at?: string | null
          sent_via?: string | null
          status?: Database["public"]["Enums"]["outbound_email_status"]
          subject: string
          template_kind: string
          to_address: string
        }
        Update: {
          body_html?: string
          body_text?: string
          claimed_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          locale?: string
          next_attempt_at?: string | null
          operator_id?: string
          related_booking_id?: string | null
          related_payment_id?: string | null
          reply_to?: string | null
          resent_from_id?: string | null
          retries?: number
          sent_at?: string | null
          sent_via?: string | null
          status?: Database["public"]["Enums"]["outbound_email_status"]
          subject?: string
          template_kind?: string
          to_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbound_emails_booking_fk"
            columns: ["related_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_emails_op_fk"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "outbound_emails_op_fk"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_emails_payment_fk"
            columns: ["related_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_emails_resent_from_id_fkey"
            columns: ["resent_from_id"]
            isOneToOne: false
            referencedRelation: "outbound_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      package_features: {
        Row: {
          config: Json | null
          created_at: string
          enabled: boolean
          feature_id: string
          package_id: string
          updated_at: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          enabled?: boolean
          feature_id: string
          package_id: string
          updated_at?: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          enabled?: boolean
          feature_id?: string
          package_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_features_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_features_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "subscription_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_day_statuses: {
        Row: {
          active: boolean
          code: string
          colour: string | null
          created_at: string
          deleted_at: string | null
          deleted_by_user_id: string | null
          deletion_reason: string | null
          id: string
          label: string
          label_localized: Json | null
          operator_id: string
          semantic_state: Database["public"]["Enums"]["participant_day_semantic_state"]
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          colour?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          id?: string
          label: string
          label_localized?: Json | null
          operator_id: string
          semantic_state: Database["public"]["Enums"]["participant_day_semantic_state"]
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          colour?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          id?: string
          label?: string
          label_localized?: Json | null
          operator_id?: string
          semantic_state?: Database["public"]["Enums"]["participant_day_semantic_state"]
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_day_statuses_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_day_statuses_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_day_statuses_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "participant_day_statuses_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_refunds: {
        Row: {
          booking_id: string
          completed_at: string | null
          created_at: string
          currency: string
          failure_reason: string | null
          id: string
          initiated_at: string
          initiated_by_user_id: string
          operator_id: string
          payment_id: string
          reason: string | null
          refund_amount: number
          refunded_for: Json | null
          status: Database["public"]["Enums"]["refund_status"]
          stripe_refund_id: string | null
          updated_at: string
        }
        Insert: {
          booking_id: string
          completed_at?: string | null
          created_at?: string
          currency: string
          failure_reason?: string | null
          id?: string
          initiated_at?: string
          initiated_by_user_id: string
          operator_id: string
          payment_id: string
          reason?: string | null
          refund_amount: number
          refunded_for?: Json | null
          status?: Database["public"]["Enums"]["refund_status"]
          stripe_refund_id?: string | null
          updated_at?: string
        }
        Update: {
          booking_id?: string
          completed_at?: string | null
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          initiated_at?: string
          initiated_by_user_id?: string
          operator_id?: string
          payment_id?: string
          reason?: string | null
          refund_amount?: number
          refunded_for?: Json | null
          status?: Database["public"]["Enums"]["refund_status"]
          stripe_refund_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_refunds_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_refunds_initiated_by_user_id_fkey"
            columns: ["initiated_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_refunds_initiated_by_user_id_fkey"
            columns: ["initiated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_refunds_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "payment_refunds_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_state_transitions: {
        Row: {
          from_status: Database["public"]["Enums"]["payment_status"] | null
          id: string
          occurred_at: string
          operator_id: string
          payment_id: string
          reason: string | null
          to_status: Database["public"]["Enums"]["payment_status"]
          triggered_by_user_id: string | null
        }
        Insert: {
          from_status?: Database["public"]["Enums"]["payment_status"] | null
          id?: string
          occurred_at?: string
          operator_id: string
          payment_id: string
          reason?: string | null
          to_status: Database["public"]["Enums"]["payment_status"]
          triggered_by_user_id?: string | null
        }
        Update: {
          from_status?: Database["public"]["Enums"]["payment_status"] | null
          id?: string
          occurred_at?: string
          operator_id?: string
          payment_id?: string
          reason?: string | null
          to_status?: Database["public"]["Enums"]["payment_status"]
          triggered_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_state_transitions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "payment_state_transitions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_state_transitions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_state_transitions_triggered_by_user_id_fkey"
            columns: ["triggered_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_state_transitions_triggered_by_user_id_fkey"
            columns: ["triggered_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          currency: string
          failure_reason: string | null
          id: string
          operator_id: string
          paid_at: string | null
          provider: Database["public"]["Enums"]["payment_provider"]
          refunded_amount: number
          status: Database["public"]["Enums"]["payment_status"]
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          stripe_payment_method: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string
          currency: string
          failure_reason?: string | null
          id?: string
          operator_id: string
          paid_at?: string | null
          provider: Database["public"]["Enums"]["payment_provider"]
          refunded_amount?: number
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_payment_method?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          operator_id?: string
          paid_at?: string | null
          provider?: Database["public"]["Enums"]["payment_provider"]
          refunded_amount?: number
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_payment_method?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "payments_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_external_contact_decisions: {
        Row: {
          auto_resolved: boolean
          candidates: Json
          contact_id: string
          created_at: string
          external_target: string
          id: string
          landr_snapshot: Json
          operator_id: string
          reason: string
          resolution: Json | null
          resolved_at: string | null
          resolved_by: string | null
          sync_log_id: string
        }
        Insert: {
          auto_resolved?: boolean
          candidates: Json
          contact_id: string
          created_at?: string
          external_target: string
          id?: string
          landr_snapshot: Json
          operator_id: string
          reason: string
          resolution?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          sync_log_id: string
        }
        Update: {
          auto_resolved?: boolean
          candidates?: Json
          contact_id?: string
          created_at?: string
          external_target?: string
          id?: string
          landr_snapshot?: Json
          operator_id?: string
          reason?: string
          resolution?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          sync_log_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_external_contact_decisions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_external_contact_decisions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_external_contact_decisions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "pending_external_contact_decisions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_external_contact_decisions_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_external_contact_decisions_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_external_contact_decisions_sync_log_id_fkey"
            columns: ["sync_log_id"]
            isOneToOne: true
            referencedRelation: "external_sync_log"
            referencedColumns: ["id"]
          },
        ]
      }
      pilot_presence: {
        Row: {
          activity_area_id: string | null
          activity_site_id: string | null
          created_at: string
          expires_at: string | null
          intent_state: string
          lat: number | null
          lng: number | null
          location: unknown
          set_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_area_id?: string | null
          activity_site_id?: string | null
          created_at?: string
          expires_at?: string | null
          intent_state?: string
          lat?: number | null
          lng?: number | null
          location?: unknown
          set_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_area_id?: string | null
          activity_site_id?: string | null
          created_at?: string
          expires_at?: string | null
          intent_state?: string
          lat?: number | null
          lng?: number | null
          location?: unknown
          set_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pilot_presence_activity_area_id_fkey"
            columns: ["activity_area_id"]
            isOneToOne: false
            referencedRelation: "activity_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilot_presence_activity_site_id_fkey"
            columns: ["activity_site_id"]
            isOneToOne: false
            referencedRelation: "activity_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilot_presence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "member_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "pilot_presence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "member_profiles_public"
            referencedColumns: ["user_id"]
          },
        ]
      }
      platform_outbound_emails: {
        Row: {
          body_html: string
          body_text: string
          claimed_at: string | null
          created_at: string
          id: string
          last_error: string | null
          locale: string
          next_attempt_at: string | null
          retries: number
          sent_at: string | null
          sent_via: string | null
          status: Database["public"]["Enums"]["outbound_email_status"]
          subject: string
          template_kind: string
          to_address: string
        }
        Insert: {
          body_html: string
          body_text: string
          claimed_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          locale: string
          next_attempt_at?: string | null
          retries?: number
          sent_at?: string | null
          sent_via?: string | null
          status?: Database["public"]["Enums"]["outbound_email_status"]
          subject: string
          template_kind: string
          to_address: string
        }
        Update: {
          body_html?: string
          body_text?: string
          claimed_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          locale?: string
          next_attempt_at?: string | null
          retries?: number
          sent_at?: string | null
          sent_via?: string | null
          status?: Database["public"]["Enums"]["outbound_email_status"]
          subject?: string
          template_kind?: string
          to_address?: string
        }
        Relationships: []
      }
      pricing_rules: {
        Row: {
          active: boolean
          conditions: Json | null
          created_at: string
          deleted_at: string | null
          deleted_by_user_id: string | null
          deletion_reason: string | null
          id: string
          operator_id: string
          params: Json
          pricing_scheme_id: string
          rule_kind: Database["public"]["Enums"]["pricing_rule_kind"]
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          conditions?: Json | null
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          id?: string
          operator_id: string
          params?: Json
          pricing_scheme_id: string
          rule_kind: Database["public"]["Enums"]["pricing_rule_kind"]
          sort_order: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          conditions?: Json | null
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          id?: string
          operator_id?: string
          params?: Json
          pricing_scheme_id?: string
          rule_kind?: Database["public"]["Enums"]["pricing_rule_kind"]
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rules_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_rules_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_rules_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "pricing_rules_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_rules_pricing_scheme_id_fkey"
            columns: ["pricing_scheme_id"]
            isOneToOne: false
            referencedRelation: "pricing_schemes"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_schemes: {
        Row: {
          active: boolean
          allow_day_deselection: boolean
          created_at: string
          currency: string
          deleted_at: string | null
          deleted_by_user_id: string | null
          deletion_reason: string | null
          id: string
          name: string
          name_localized: Json | null
          notes: string | null
          operator_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          allow_day_deselection?: boolean
          created_at?: string
          currency?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          id?: string
          name: string
          name_localized?: Json | null
          notes?: string | null
          operator_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          allow_day_deselection?: boolean
          created_at?: string
          currency?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          id?: string
          name?: string
          name_localized?: Json | null
          notes?: string | null
          operator_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_schemes_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_schemes_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_schemes_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "pricing_schemes_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_tiers: {
        Row: {
          amount_per_unit: number | null
          amount_total: number | null
          created_at: string
          currency: string | null
          id: string
          operator_id: string
          pricing_rule_id: string
          threshold_max: number | null
          threshold_min: number
          updated_at: string
        }
        Insert: {
          amount_per_unit?: number | null
          amount_total?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          operator_id: string
          pricing_rule_id: string
          threshold_max?: number | null
          threshold_min: number
          updated_at?: string
        }
        Update: {
          amount_per_unit?: number | null
          amount_total?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          operator_id?: string
          pricing_rule_id?: string
          threshold_max?: number | null
          threshold_min?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_tiers_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "pricing_tiers_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_tiers_pricing_rule_id_fkey"
            columns: ["pricing_rule_id"]
            isOneToOne: false
            referencedRelation: "pricing_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      product_addons: {
        Row: {
          addon_product_id: string
          created_at: string
          id: string
          is_required: boolean
          max_qty: number | null
          min_qty: number
          operator_id: string
          parent_product_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          addon_product_id: string
          created_at?: string
          id?: string
          is_required?: boolean
          max_qty?: number | null
          min_qty?: number
          operator_id: string
          parent_product_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          addon_product_id?: string
          created_at?: string
          id?: string
          is_required?: boolean
          max_qty?: number | null
          min_qty?: number
          operator_id?: string
          parent_product_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_addons_addon_product_id_fkey"
            columns: ["addon_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_addons_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "product_addons_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_addons_parent_product_id_fkey"
            columns: ["parent_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_availability: {
        Row: {
          capacity: number
          capacity_reserved: number
          created_at: string
          date: string
          end_time: string | null
          id: string
          notes: string | null
          operator_id: string
          product_id: string
          source: Database["public"]["Enums"]["product_availability_source"]
          source_template_id: string | null
          start_time: string | null
          status: Database["public"]["Enums"]["product_availability_status"]
          updated_at: string
        }
        Insert: {
          capacity: number
          capacity_reserved?: number
          created_at?: string
          date: string
          end_time?: string | null
          id?: string
          notes?: string | null
          operator_id: string
          product_id: string
          source: Database["public"]["Enums"]["product_availability_source"]
          source_template_id?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["product_availability_status"]
          updated_at?: string
        }
        Update: {
          capacity?: number
          capacity_reserved?: number
          created_at?: string
          date?: string
          end_time?: string | null
          id?: string
          notes?: string | null
          operator_id?: string
          product_id?: string
          source?: Database["public"]["Enums"]["product_availability_source"]
          source_template_id?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["product_availability_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_availability_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "product_availability_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_availability_product_id_operator_id_fkey"
            columns: ["product_id", "operator_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "operator_id"]
          },
          {
            foreignKeyName: "product_availability_source_template_id_fkey"
            columns: ["source_template_id"]
            isOneToOne: false
            referencedRelation: "product_schedule_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      product_fixed_date_windows: {
        Row: {
          active: boolean
          capacity: number
          capacity_reserved: number
          created_at: string
          deleted_at: string | null
          end_date: string
          id: string
          operator_id: string
          product_id: string
          start_date: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          capacity: number
          capacity_reserved?: number
          created_at?: string
          deleted_at?: string | null
          end_date: string
          id?: string
          operator_id: string
          product_id: string
          start_date: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          capacity?: number
          capacity_reserved?: number
          created_at?: string
          deleted_at?: string | null
          end_date?: string
          id?: string
          operator_id?: string
          product_id?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_fixed_date_windows_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "product_fixed_date_windows_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_fixed_date_windows_product_id_operator_id_fkey"
            columns: ["product_id", "operator_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "operator_id"]
          },
        ]
      }
      product_flow_modules: {
        Row: {
          created_at: string
          form_id: string | null
          id: string
          module_kind: string
          operator_id: string
          position: number
          product_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          form_id?: string | null
          id?: string
          module_kind: string
          operator_id: string
          position: number
          product_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          form_id?: string | null
          id?: string
          module_kind?: string
          operator_id?: string
          position?: number
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_flow_modules_form_id_operator_id_fkey"
            columns: ["form_id", "operator_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id", "operator_id"]
          },
          {
            foreignKeyName: "product_flow_modules_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "product_flow_modules_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_flow_modules_product_id_operator_id_fkey"
            columns: ["product_id", "operator_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "operator_id"]
          },
        ]
      }
      product_groups: {
        Row: {
          active: boolean
          created_at: string
          deleted_at: string | null
          deleted_by_user_id: string | null
          deletion_reason: string | null
          description: string | null
          description_localized: Json | null
          id: string
          image_path: string | null
          name: string
          name_localized: Json | null
          operator_id: string
          parent_id: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          description?: string | null
          description_localized?: Json | null
          id?: string
          image_path?: string | null
          name: string
          name_localized?: Json | null
          operator_id: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          description?: string | null
          description_localized?: Json | null
          id?: string
          image_path?: string | null
          name?: string
          name_localized?: Json | null
          operator_id?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_groups_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_groups_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_groups_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "product_groups_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_groups_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt: string | null
          created_at: string
          hero_path: string
          id: string
          operator_id: string
          product_id: string
          sort_order: number
          thumb_path: string
        }
        Insert: {
          alt?: string | null
          created_at?: string
          hero_path: string
          id?: string
          operator_id: string
          product_id: string
          sort_order?: number
          thumb_path: string
        }
        Update: {
          alt?: string | null
          created_at?: string
          hero_path?: string
          id?: string
          operator_id?: string
          product_id?: string
          sort_order?: number
          thumb_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "product_images_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_locations: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          location_id: string
          operator_id: string
          product_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          location_id: string
          operator_id: string
          product_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          location_id?: string
          operator_id?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_locations_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "product_locations_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_locations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_resource_requirements: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          operator_id: string
          product_id: string
          ratio_per_participant: number | null
          resource_pool_id: string
          units_required_per_booking: number
          units_required_per_participant: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          operator_id: string
          product_id: string
          ratio_per_participant?: number | null
          resource_pool_id: string
          units_required_per_booking?: number
          units_required_per_participant?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          operator_id?: string
          product_id?: string
          ratio_per_participant?: number | null
          resource_pool_id?: string
          units_required_per_booking?: number
          units_required_per_participant?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_resource_requirements_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "product_resource_requirements_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_resource_requirements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_resource_requirements_resource_pool_id_fkey"
            columns: ["resource_pool_id"]
            isOneToOne: false
            referencedRelation: "resource_pools"
            referencedColumns: ["id"]
          },
        ]
      }
      product_schedule_exceptions: {
        Row: {
          created_at: string
          date: string
          deleted_at: string | null
          deleted_by_user_id: string | null
          deletion_reason: string | null
          exception_kind: Database["public"]["Enums"]["product_schedule_exception_kind"]
          id: string
          operator_id: string
          override_capacity: number | null
          override_times: Json | null
          product_id: string
          reason: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          exception_kind: Database["public"]["Enums"]["product_schedule_exception_kind"]
          id?: string
          operator_id: string
          override_capacity?: number | null
          override_times?: Json | null
          product_id: string
          reason?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          exception_kind?: Database["public"]["Enums"]["product_schedule_exception_kind"]
          id?: string
          operator_id?: string
          override_capacity?: number | null
          override_times?: Json | null
          product_id?: string
          reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_schedule_exceptions_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_schedule_exceptions_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_schedule_exceptions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "product_schedule_exceptions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_schedule_exceptions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_schedule_templates: {
        Row: {
          active: boolean
          capacity: number
          created_at: string
          deleted_at: string | null
          deleted_by_user_id: string | null
          deletion_reason: string | null
          duration_minutes: number | null
          id: string
          notes: string | null
          operator_id: string
          product_id: string
          rrule: string
          season_end_date: string | null
          season_start_date: string | null
          start_times: string[] | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          capacity: number
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          operator_id: string
          product_id: string
          rrule: string
          season_end_date?: string | null
          season_start_date?: string | null
          start_times?: string[] | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          capacity?: number
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          operator_id?: string
          product_id?: string
          rrule?: string
          season_end_date?: string | null
          season_start_date?: string | null
          start_times?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_schedule_templates_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_schedule_templates_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_schedule_templates_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "product_schedule_templates_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_schedule_templates_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_service_roles: {
        Row: {
          created_at: string
          deleted_at: string | null
          deleted_by_user_id: string | null
          deletion_reason: string | null
          id: string
          is_default: boolean
          operator_id: string
          product_id: string
          service_role_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          id?: string
          is_default?: boolean
          operator_id: string
          product_id: string
          service_role_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          id?: string
          is_default?: boolean
          operator_id?: string
          product_id?: string
          service_role_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_service_roles_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_service_roles_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_service_roles_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "product_service_roles_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_service_roles_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_service_roles_service_role_id_fkey"
            columns: ["service_role_id"]
            isOneToOne: false
            referencedRelation: "service_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_sports: {
        Row: {
          created_at: string
          id: string
          operator_id: string
          product_id: string
          sport_subcategory_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          operator_id: string
          product_id: string
          sport_subcategory_id: string
        }
        Update: {
          created_at?: string
          id?: string
          operator_id?: string
          product_id?: string
          sport_subcategory_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_sports_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "product_sports_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_sports_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_sports_sport_subcategory_id_fkey"
            columns: ["sport_subcategory_id"]
            isOneToOne: false
            referencedRelation: "sport_subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          capacity_per_unit: number | null
          created_at: string
          default_pricing_scheme_id: string | null
          deleted_at: string | null
          deleted_by_user_id: string | null
          deletion_reason: string | null
          description: string | null
          description_localized: Json | null
          duration_minutes: number | null
          fixed_end_date: string | null
          fixed_start_date: string | null
          hotel_location_id: string | null
          hotel_offering: string
          id: string
          includes_breakfast: boolean
          is_addon_only: boolean
          is_contiguous: boolean
          is_publicly_listed: boolean
          name: string
          name_localized: Json | null
          needs_pickup: boolean
          needs_provider: boolean
          operator_id: string
          product_group_id: string | null
          product_kind: Database["public"]["Enums"]["product_kind"]
          revenue_flows_through_operator: boolean
          service_time_shape:
            | Database["public"]["Enums"]["service_time_shape"]
            | null
          short_description: string | null
          short_description_localized: Json | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          capacity_per_unit?: number | null
          created_at?: string
          default_pricing_scheme_id?: string | null
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          description?: string | null
          description_localized?: Json | null
          duration_minutes?: number | null
          fixed_end_date?: string | null
          fixed_start_date?: string | null
          hotel_location_id?: string | null
          hotel_offering?: string
          id?: string
          includes_breakfast?: boolean
          is_addon_only?: boolean
          is_contiguous?: boolean
          is_publicly_listed?: boolean
          name: string
          name_localized?: Json | null
          needs_pickup?: boolean
          needs_provider?: boolean
          operator_id: string
          product_group_id?: string | null
          product_kind: Database["public"]["Enums"]["product_kind"]
          revenue_flows_through_operator?: boolean
          service_time_shape?:
            | Database["public"]["Enums"]["service_time_shape"]
            | null
          short_description?: string | null
          short_description_localized?: Json | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          capacity_per_unit?: number | null
          created_at?: string
          default_pricing_scheme_id?: string | null
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          description?: string | null
          description_localized?: Json | null
          duration_minutes?: number | null
          fixed_end_date?: string | null
          fixed_start_date?: string | null
          hotel_location_id?: string | null
          hotel_offering?: string
          id?: string
          includes_breakfast?: boolean
          is_addon_only?: boolean
          is_contiguous?: boolean
          is_publicly_listed?: boolean
          name?: string
          name_localized?: Json | null
          needs_pickup?: boolean
          needs_provider?: boolean
          operator_id?: string
          product_group_id?: string | null
          product_kind?: Database["public"]["Enums"]["product_kind"]
          revenue_flows_through_operator?: boolean
          service_time_shape?:
            | Database["public"]["Enums"]["service_time_shape"]
            | null
          short_description?: string | null
          short_description_localized?: Json | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_default_pricing_scheme_id_fkey"
            columns: ["default_pricing_scheme_id"]
            isOneToOne: false
            referencedRelation: "pricing_schemes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_hotel_location_id_fkey"
            columns: ["hotel_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "products_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_product_group_id_fkey"
            columns: ["product_group_id"]
            isOneToOne: false
            referencedRelation: "product_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      promotion_run_repos: {
        Row: {
          ahead_by: number | null
          base_branch: string
          base_sha_before: string | null
          created_at: string
          error: string | null
          head_branch: string
          head_sha: string
          id: string
          merge_sha: string | null
          merge_status: string
          repo: string
          run_id: string
          updated_at: string
        }
        Insert: {
          ahead_by?: number | null
          base_branch: string
          base_sha_before?: string | null
          created_at?: string
          error?: string | null
          head_branch: string
          head_sha: string
          id?: string
          merge_sha?: string | null
          merge_status?: string
          repo: string
          run_id: string
          updated_at?: string
        }
        Update: {
          ahead_by?: number | null
          base_branch?: string
          base_sha_before?: string | null
          created_at?: string
          error?: string | null
          head_branch?: string
          head_sha?: string
          id?: string
          merge_sha?: string | null
          merge_status?: string
          repo?: string
          run_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_run_repos_run_fk"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "promotion_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      promotion_run_signoffs: {
        Row: {
          created_at: string
          decided_at: string | null
          id: string
          notes: string | null
          operator_id: string
          run_id: string
          signer_user_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          id?: string
          notes?: string | null
          operator_id: string
          run_id: string
          signer_user_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          id?: string
          notes?: string | null
          operator_id?: string
          run_id?: string
          signer_user_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_run_signoffs_operator_fk"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "promotion_run_signoffs_operator_fk"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_run_signoffs_run_fk"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "promotion_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_run_signoffs_signer_fk"
            columns: ["signer_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_run_signoffs_signer_fk"
            columns: ["signer_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      promotion_runs: {
        Row: {
          changelog: Json
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_notes: string | null
          id: string
          kind: string
          migration_log: string | null
          migration_status: string
          migrations_applied: Json
          notes: string | null
          requested_at: string
          requested_by: string | null
          signoff_by_label: string | null
          signoff_override_at: string | null
          signoff_override_by: string | null
          signoff_override_reason: string | null
          signoff_paused_at: string | null
          signoff_source: string
          signoff_window_closes_at: string | null
          signoff_window_hours: number
          signoff_window_opens_at: string | null
          status: string
          updated_at: string
          version: string | null
          version_bump: string | null
        }
        Insert: {
          changelog?: Json
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          id?: string
          kind: string
          migration_log?: string | null
          migration_status?: string
          migrations_applied?: Json
          notes?: string | null
          requested_at?: string
          requested_by?: string | null
          signoff_by_label?: string | null
          signoff_override_at?: string | null
          signoff_override_by?: string | null
          signoff_override_reason?: string | null
          signoff_paused_at?: string | null
          signoff_source?: string
          signoff_window_closes_at?: string | null
          signoff_window_hours?: number
          signoff_window_opens_at?: string | null
          status?: string
          updated_at?: string
          version?: string | null
          version_bump?: string | null
        }
        Update: {
          changelog?: Json
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          id?: string
          kind?: string
          migration_log?: string | null
          migration_status?: string
          migrations_applied?: Json
          notes?: string | null
          requested_at?: string
          requested_by?: string | null
          signoff_by_label?: string | null
          signoff_override_at?: string | null
          signoff_override_by?: string | null
          signoff_override_reason?: string | null
          signoff_paused_at?: string | null
          signoff_source?: string
          signoff_window_closes_at?: string | null
          signoff_window_hours?: number
          signoff_window_opens_at?: string | null
          status?: string
          updated_at?: string
          version?: string | null
          version_bump?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promotion_runs_decided_by_fk"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_runs_decided_by_fk"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_runs_requested_by_fk"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_runs_requested_by_fk"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_runs_signoff_override_by_fkey"
            columns: ["signoff_override_by"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_runs_signoff_override_by_fkey"
            columns: ["signoff_override_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_availability: {
        Row: {
          blackout_end: string
          blackout_start: string
          created_at: string
          deleted_at: string | null
          deleted_by_user_id: string | null
          deletion_reason: string | null
          id: string
          operator_id: string
          provider_id: string
          reason: string | null
          updated_at: string
        }
        Insert: {
          blackout_end: string
          blackout_start: string
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          id?: string
          operator_id: string
          provider_id: string
          reason?: string | null
          updated_at?: string
        }
        Update: {
          blackout_end?: string
          blackout_start?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          id?: string
          operator_id?: string
          provider_id?: string
          reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_availability_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_availability_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_availability_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "provider_availability_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_availability_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_role_types: {
        Row: {
          active: boolean
          code: string
          created_at: string
          deleted_at: string | null
          deleted_by_user_id: string | null
          deletion_reason: string | null
          id: string
          label: string
          label_localized: Json | null
          operator_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          id?: string
          label: string
          label_localized?: Json | null
          operator_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          id?: string
          label?: string
          label_localized?: Json | null
          operator_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_role_types_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_role_types_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_role_types_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "provider_role_types_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      providers: {
        Row: {
          active: boolean
          contact_id: string | null
          created_at: string
          default_role_id: string | null
          deleted_at: string | null
          deleted_by_user_id: string | null
          deletion_reason: string | null
          display_name: string
          id: string
          operator_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          contact_id?: string | null
          created_at?: string
          default_role_id?: string | null
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          display_name: string
          id?: string
          operator_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          contact_id?: string | null
          created_at?: string
          default_role_id?: string | null
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          display_name?: string
          id?: string
          operator_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "providers_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "providers_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "providers_default_role_id_fkey"
            columns: ["default_role_id"]
            isOneToOne: false
            referencedRelation: "provider_role_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "providers_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "providers_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "providers_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "providers_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      regions: {
        Row: {
          code: string
          country_code: string
          created_at: string
          id: string
          name_de: string
          name_en: string
        }
        Insert: {
          code: string
          country_code: string
          created_at?: string
          id?: string
          name_de: string
          name_en: string
        }
        Update: {
          code?: string
          country_code?: string
          created_at?: string
          id?: string
          name_de?: string
          name_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "regions_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
        ]
      }
      resource_pool_approval_period_units: {
        Row: {
          created_at: string
          id: string
          operator_id: string
          period_id: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          operator_id: string
          period_id: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          operator_id?: string
          period_id?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_pool_approval_period_units_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "resource_pool_approval_period_units_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_pool_approval_period_units_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "resource_pool_approval_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_pool_approval_period_units_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "resource_pool_units"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_pool_approval_periods: {
        Row: {
          active: boolean
          created_at: string
          deleted_at: string | null
          deleted_by_user_id: string | null
          deletion_reason: string | null
          end_date: string
          id: string
          mode: Database["public"]["Enums"]["resource_pool_approval_mode"]
          note: string | null
          operator_id: string
          releases_all_units: boolean
          resource_pool_id: string
          start_date: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          end_date: string
          id?: string
          mode: Database["public"]["Enums"]["resource_pool_approval_mode"]
          note?: string | null
          operator_id: string
          releases_all_units?: boolean
          resource_pool_id: string
          start_date: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          end_date?: string
          id?: string
          mode?: Database["public"]["Enums"]["resource_pool_approval_mode"]
          note?: string | null
          operator_id?: string
          releases_all_units?: boolean
          resource_pool_id?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_pool_approval_periods_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_pool_approval_periods_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_pool_approval_periods_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "resource_pool_approval_periods_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_pool_approval_periods_resource_pool_id_fkey"
            columns: ["resource_pool_id"]
            isOneToOne: false
            referencedRelation: "resource_pools"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_pool_unit_day_releases: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          date: string
          hold_detail: Json | null
          hold_source: string | null
          id: string
          operator_id: string
          reason: string | null
          released: boolean
          resource_pool_id: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          date: string
          hold_detail?: Json | null
          hold_source?: string | null
          id?: string
          operator_id: string
          reason?: string | null
          released: boolean
          resource_pool_id: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          date?: string
          hold_detail?: Json | null
          hold_source?: string | null
          id?: string
          operator_id?: string
          reason?: string | null
          released?: boolean
          resource_pool_id?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_pool_unit_day_releases_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_pool_unit_day_releases_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_pool_unit_day_releases_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "resource_pool_unit_day_releases_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_pool_unit_day_releases_resource_pool_id_fkey"
            columns: ["resource_pool_id"]
            isOneToOne: false
            referencedRelation: "resource_pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_pool_unit_day_releases_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "resource_pool_units"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_pool_unit_locations: {
        Row: {
          created_at: string
          id: string
          location_id: string
          operator_id: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_id: string
          operator_id: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string
          operator_id?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_pool_unit_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_pool_unit_locations_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "resource_pool_unit_locations_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_pool_unit_locations_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "resource_pool_units"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_pool_unit_service_periods: {
        Row: {
          active: boolean
          created_at: string
          deleted_at: string | null
          deleted_by_user_id: string | null
          deletion_reason: string | null
          end_date: string
          id: string
          kind: Database["public"]["Enums"]["resource_pool_unit_service_kind"]
          operator_id: string
          reason: string | null
          resource_pool_id: string
          start_date: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          end_date: string
          id?: string
          kind?: Database["public"]["Enums"]["resource_pool_unit_service_kind"]
          operator_id: string
          reason?: string | null
          resource_pool_id: string
          start_date: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          end_date?: string
          id?: string
          kind?: Database["public"]["Enums"]["resource_pool_unit_service_kind"]
          operator_id?: string
          reason?: string | null
          resource_pool_id?: string
          start_date?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_pool_unit_service_periods_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_pool_unit_service_periods_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_pool_unit_service_periods_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "resource_pool_unit_service_periods_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_pool_unit_service_periods_resource_pool_id_fkey"
            columns: ["resource_pool_id"]
            isOneToOne: false
            referencedRelation: "resource_pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_pool_unit_service_periods_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "resource_pool_units"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_pool_units: {
        Row: {
          active: boolean
          capacity: number
          created_at: string
          deleted_at: string | null
          deleted_by_user_id: string | null
          deletion_reason: string | null
          id: string
          name: string
          name_localized: Json | null
          operator_id: string
          resource_pool_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          capacity: number
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          id?: string
          name: string
          name_localized?: Json | null
          operator_id: string
          resource_pool_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          capacity?: number
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          id?: string
          name?: string
          name_localized?: Json | null
          operator_id?: string
          resource_pool_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_pool_units_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_pool_units_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_pool_units_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "resource_pool_units_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_pool_units_resource_pool_id_fkey"
            columns: ["resource_pool_id"]
            isOneToOne: false
            referencedRelation: "resource_pools"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_pools: {
        Row: {
          active: boolean
          code: string
          created_at: string
          default_released_units: number
          deleted_at: string | null
          deleted_by_user_id: string | null
          deletion_reason: string | null
          id: string
          is_consumed_per_day: boolean
          label: string
          label_localized: Json | null
          operator_id: string
          resource_kind: Database["public"]["Enums"]["resource_kind"]
          slot_label: string
          slot_label_plural: string
          sort_order: number
          unit_label: string
          unit_label_plural: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          default_released_units?: number
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          id?: string
          is_consumed_per_day?: boolean
          label: string
          label_localized?: Json | null
          operator_id: string
          resource_kind: Database["public"]["Enums"]["resource_kind"]
          slot_label?: string
          slot_label_plural?: string
          sort_order?: number
          unit_label?: string
          unit_label_plural?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          default_released_units?: number
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          id?: string
          is_consumed_per_day?: boolean
          label?: string
          label_localized?: Json | null
          operator_id?: string
          resource_kind?: Database["public"]["Enums"]["resource_kind"]
          slot_label?: string
          slot_label_plural?: string
          sort_order?: number
          unit_label?: string
          unit_label_plural?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_pools_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_pools_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_pools_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "resource_pools_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_views: {
        Row: {
          config: Json
          created_at: string
          creator_user_id: string | null
          deleted_at: string | null
          entity_type: string
          id: string
          is_system: boolean
          name: string
          operator_id: string
          sort_order: number
          updated_at: string
          visibility: string
        }
        Insert: {
          config?: Json
          created_at?: string
          creator_user_id?: string | null
          deleted_at?: string | null
          entity_type: string
          id?: string
          is_system?: boolean
          name: string
          operator_id: string
          sort_order?: number
          updated_at?: string
          visibility?: string
        }
        Update: {
          config?: Json
          created_at?: string
          creator_user_id?: string | null
          deleted_at?: string | null
          entity_type?: string
          id?: string
          is_system?: boolean
          name?: string
          operator_id?: string
          sort_order?: number
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_views_creator_user_id_fkey"
            columns: ["creator_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_views_creator_user_id_fkey"
            columns: ["creator_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_views_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "saved_views_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      service_roles: {
        Row: {
          active: boolean
          code: string
          created_at: string
          deleted_at: string | null
          deleted_by_user_id: string | null
          deletion_reason: string | null
          description: string | null
          description_localized: Json | null
          id: string
          label: string
          label_localized: Json | null
          label_plural: string | null
          operator_id: string
          receives_main_service: boolean
          requires_pickup_location: boolean
          requires_provider_role_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          description?: string | null
          description_localized?: Json | null
          id?: string
          label: string
          label_localized?: Json | null
          label_plural?: string | null
          operator_id: string
          receives_main_service?: boolean
          requires_pickup_location?: boolean
          requires_provider_role_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          description?: string | null
          description_localized?: Json | null
          id?: string
          label?: string
          label_localized?: Json | null
          label_plural?: string | null
          operator_id?: string
          receives_main_service?: boolean
          requires_pickup_location?: boolean
          requires_provider_role_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_roles_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_roles_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_roles_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "service_roles_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_roles_requires_provider_role_id_fkey"
            columns: ["requires_provider_role_id"]
            isOneToOne: false
            referencedRelation: "provider_role_types"
            referencedColumns: ["id"]
          },
        ]
      }
      site_photos: {
        Row: {
          activity_site_id: string
          created_at: string
          id: string
          media_id: string
        }
        Insert: {
          activity_site_id: string
          created_at?: string
          id?: string
          media_id: string
        }
        Update: {
          activity_site_id?: string
          created_at?: string
          id?: string
          media_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_photos_activity_site_id_fkey"
            columns: ["activity_site_id"]
            isOneToOne: false
            referencedRelation: "activity_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_photos_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: true
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      site_warning_subscriptions: {
        Row: {
          activity_site_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          activity_site_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          activity_site_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_warning_subscriptions_activity_site_id_fkey"
            columns: ["activity_site_id"]
            isOneToOne: false
            referencedRelation: "activity_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_warning_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "member_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "site_warning_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "member_profiles_public"
            referencedColumns: ["user_id"]
          },
        ]
      }
      site_warnings: {
        Row: {
          activity_site_id: string
          body: string | null
          created_at: string
          expires_at: string | null
          id: string
          published_by: string
          published_by_operator_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["public"]["Enums"]["site_warning_severity"]
          title: string
        }
        Insert: {
          activity_site_id: string
          body?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          published_by: string
          published_by_operator_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["site_warning_severity"]
          title: string
        }
        Update: {
          activity_site_id?: string
          body?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          published_by?: string
          published_by_operator_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["site_warning_severity"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_warnings_activity_site_id_fkey"
            columns: ["activity_site_id"]
            isOneToOne: false
            referencedRelation: "activity_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_warnings_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_warnings_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_warnings_published_by_operator_id_fkey"
            columns: ["published_by_operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "site_warnings_published_by_operator_id_fkey"
            columns: ["published_by_operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_warnings_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_warnings_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sos_events: {
        Row: {
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          location: unknown
          resolved_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          location?: unknown
          resolved_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          location?: unknown
          resolved_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sos_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "member_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "sos_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "member_profiles_public"
            referencedColumns: ["user_id"]
          },
        ]
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      sport_categories: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          label: string
          label_localized: Json | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          label: string
          label_localized?: Json | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          label?: string
          label_localized?: Json | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      sport_subcategories: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          label: string
          label_localized: Json | null
          sort_order: number
          sport_category_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          label: string
          label_localized?: Json | null
          sort_order?: number
          sport_category_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          label?: string
          label_localized?: Json | null
          sort_order?: number
          sport_category_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sport_subcategories_sport_category_id_fkey"
            columns: ["sport_category_id"]
            isOneToOne: false
            referencedRelation: "sport_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      sports: {
        Row: {
          created_at: string
          id: string
          label_de: string
          label_en: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          label_de: string
          label_en: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          label_de?: string
          label_en?: string
          slug?: string
        }
        Relationships: []
      }
      stripe_webhook_events: {
        Row: {
          event_created: string | null
          event_id: string
          event_type: string
          operator_id: string
          received_at: string
          result: Json | null
        }
        Insert: {
          event_created?: string | null
          event_id: string
          event_type: string
          operator_id: string
          received_at?: string
          result?: Json | null
        }
        Update: {
          event_created?: string | null
          event_id?: string
          event_type?: string
          operator_id?: string
          received_at?: string
          result?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "stripe_webhook_events_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "stripe_webhook_events_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_holders: {
        Row: {
          cancel_at_period_end: boolean
          contact_id: string
          created_at: string
          current_period_end: string | null
          id: string
          last_payment_failed_at: string | null
          last_stripe_event_at: string | null
          operator_id: string
          reminder_t0_sent_at: string | null
          reminder_t3_sent_at: string | null
          reminder_t7_sent_at: string | null
          started_at: string | null
          status: string
          stripe_checkout_session_id: string | null
          stripe_customer_id: string | null
          stripe_status: string | null
          stripe_subscription_id: string | null
          subscription_id: string
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          contact_id: string
          created_at?: string
          current_period_end?: string | null
          id?: string
          last_payment_failed_at?: string | null
          last_stripe_event_at?: string | null
          operator_id: string
          reminder_t0_sent_at?: string | null
          reminder_t3_sent_at?: string | null
          reminder_t7_sent_at?: string | null
          started_at?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_status?: string | null
          stripe_subscription_id?: string | null
          subscription_id: string
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          contact_id?: string
          created_at?: string
          current_period_end?: string | null
          id?: string
          last_payment_failed_at?: string | null
          last_stripe_event_at?: string | null
          operator_id?: string
          reminder_t0_sent_at?: string | null
          reminder_t3_sent_at?: string | null
          reminder_t7_sent_at?: string | null
          started_at?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_status?: string | null
          stripe_subscription_id?: string | null
          subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_holders_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_holders_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_holders_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "subscription_holders_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_holders_subscription_op_fkey"
            columns: ["subscription_id", "operator_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id", "operator_id"]
          },
        ]
      }
      subscription_packages: {
        Row: {
          active: boolean
          allowed_product_kinds: string[]
          created_at: string
          display_order: number
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          allowed_product_kinds: string[]
          created_at?: string
          display_order: number
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          allowed_product_kinds?: string[]
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscription_perk_verifications: {
        Row: {
          attempts: number
          client_ip: string | null
          code_hash: string
          consumed_at: string | null
          created_at: string
          email_normalized: string
          expires_at: string
          id: string
          max_attempts: number
          operator_id: string
        }
        Insert: {
          attempts?: number
          client_ip?: string | null
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          email_normalized: string
          expires_at: string
          id?: string
          max_attempts?: number
          operator_id: string
        }
        Update: {
          attempts?: number
          client_ip?: string | null
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          email_normalized?: string
          expires_at?: string
          id?: string
          max_attempts?: number
          operator_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_perk_verifications_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "subscription_perk_verifications_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_perks: {
        Row: {
          active: boolean
          amount: number
          applies_to_product_id: string | null
          created_at: string
          id: string
          kind: string
          label: string | null
          operator_id: string
          subscription_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount: number
          applies_to_product_id?: string | null
          created_at?: string
          id?: string
          kind: string
          label?: string | null
          operator_id: string
          subscription_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount?: number
          applies_to_product_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          label?: string | null
          operator_id?: string
          subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_perks_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "subscription_perks_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_perks_product_op_fkey"
            columns: ["applies_to_product_id", "operator_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "operator_id"]
          },
          {
            foreignKeyName: "subscription_perks_subscription_op_fkey"
            columns: ["subscription_id", "operator_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id", "operator_id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          active: boolean
          billing_interval: string
          created_at: string
          currency: string
          id: string
          operator_id: string
          price: number | null
          product_id: string
          stripe_price_id: string | null
          trial_period_days: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          billing_interval: string
          created_at?: string
          currency?: string
          id?: string
          operator_id: string
          price?: number | null
          product_id: string
          stripe_price_id?: string | null
          trial_period_days?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          billing_interval?: string
          created_at?: string
          currency?: string
          id?: string
          operator_id?: string
          price?: number | null
          product_id?: string
          stripe_price_id?: string | null
          trial_period_days?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "subscriptions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      system_templates: {
        Row: {
          body_html: string
          body_text: string | null
          created_at: string
          id: string
          locale: string
          subject: string
          template_kind: string
          updated_at: string
          version: number
        }
        Insert: {
          body_html: string
          body_text?: string | null
          created_at?: string
          id?: string
          locale: string
          subject: string
          template_kind: string
          updated_at?: string
          version?: number
        }
        Update: {
          body_html?: string
          body_text?: string | null
          created_at?: string
          id?: string
          locale?: string
          subject?: string
          template_kind?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      ticket_attachments: {
        Row: {
          content_type: string
          created_at: string
          filename: string
          id: string
          size_bytes: number
          storage_path: string
          ticket_id: string
          uploader_id: string | null
        }
        Insert: {
          content_type?: string
          created_at?: string
          filename: string
          id?: string
          size_bytes?: number
          storage_path: string
          ticket_id: string
          uploader_id?: string | null
        }
        Update: {
          content_type?: string
          created_at?: string
          filename?: string
          id?: string
          size_bytes?: number
          storage_path?: string
          ticket_id?: string
          uploader_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_attachments_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_attachments_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_comments: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          is_internal: boolean
          operator_id: string | null
          relayed_to_landr_at: string | null
          ticket_id: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          is_internal?: boolean
          operator_id?: string | null
          relayed_to_landr_at?: string | null
          ticket_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          operator_id?: string | null
          relayed_to_landr_at?: string | null
          ticket_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_comments_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "ticket_comments_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          id: string
          is_internal: boolean
          payload: Json
          ticket_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          is_internal?: boolean
          payload?: Json
          ticket_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          is_internal?: boolean
          payload?: Json
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_labels: {
        Row: {
          created_at: string
          label_id: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          label_id: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          label_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_labels_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_labels_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_labels_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_notify_settings: {
        Row: {
          bell: boolean | null
          created_at: string
          delivery_mode:
            | Database["public"]["Enums"]["notification_delivery_mode"]
            | null
          email: boolean | null
          push: boolean | null
          ticket_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bell?: boolean | null
          created_at?: string
          delivery_mode?:
            | Database["public"]["Enums"]["notification_delivery_mode"]
            | null
          email?: boolean | null
          push?: boolean | null
          ticket_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bell?: boolean | null
          created_at?: string
          delivery_mode?:
            | Database["public"]["Enums"]["notification_delivery_mode"]
            | null
          email?: boolean | null
          push?: boolean | null
          ticket_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_notify_settings_ticket_fk"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_notify_settings_ticket_fk"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_notify_settings_user_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_notify_settings_user_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_watchers: {
        Row: {
          created_at: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ticket_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_watchers_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_watchers_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_watchers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_watchers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          assignee_id: string | null
          blocked: boolean
          body: string | null
          context: Database["public"]["Enums"]["ticket_context"]
          created_at: string
          id: string
          last_synced_at: string | null
          linked_bd_id: string | null
          moscow: Database["public"]["Enums"]["ticket_moscow"] | null
          operator_id: string | null
          origin_operator_label: string | null
          origin_tier: string
          perceived_impact: Database["public"]["Enums"]["ticket_perceived_impact"]
          priority: Database["public"]["Enums"]["ticket_priority"]
          promotion_prompt: string | null
          promotion_requested_at: string | null
          relay_error: string | null
          relay_retry_count: number
          relayed_to_landr_at: string | null
          reporter_id: string | null
          severity: Database["public"]["Enums"]["ticket_severity"] | null
          source_ref: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          sync_status: string | null
          title: string
          type: Database["public"]["Enums"]["ticket_type"]
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          blocked?: boolean
          body?: string | null
          context?: Database["public"]["Enums"]["ticket_context"]
          created_at?: string
          id?: string
          last_synced_at?: string | null
          linked_bd_id?: string | null
          moscow?: Database["public"]["Enums"]["ticket_moscow"] | null
          operator_id?: string | null
          origin_operator_label?: string | null
          origin_tier?: string
          perceived_impact?: Database["public"]["Enums"]["ticket_perceived_impact"]
          priority?: Database["public"]["Enums"]["ticket_priority"]
          promotion_prompt?: string | null
          promotion_requested_at?: string | null
          relay_error?: string | null
          relay_retry_count?: number
          relayed_to_landr_at?: string | null
          reporter_id?: string | null
          severity?: Database["public"]["Enums"]["ticket_severity"] | null
          source_ref?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          sync_status?: string | null
          title: string
          type: Database["public"]["Enums"]["ticket_type"]
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          blocked?: boolean
          body?: string | null
          context?: Database["public"]["Enums"]["ticket_context"]
          created_at?: string
          id?: string
          last_synced_at?: string | null
          linked_bd_id?: string | null
          moscow?: Database["public"]["Enums"]["ticket_moscow"] | null
          operator_id?: string | null
          origin_operator_label?: string | null
          origin_tier?: string
          perceived_impact?: Database["public"]["Enums"]["ticket_perceived_impact"]
          priority?: Database["public"]["Enums"]["ticket_priority"]
          promotion_prompt?: string | null
          promotion_requested_at?: string | null
          relay_error?: string | null
          relay_retry_count?: number
          relayed_to_landr_at?: string | null
          reporter_id?: string | null
          severity?: Database["public"]["Enums"]["ticket_severity"] | null
          source_ref?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          sync_status?: string | null
          title?: string
          type?: Database["public"]["Enums"]["ticket_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "tickets_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_acknowledgments: {
        Row: {
          ack_type: string
          ack_version: string
          acknowledged_at: string
          user_id: string
        }
        Insert: {
          ack_type: string
          ack_version?: string
          acknowledged_at?: string
          user_id: string
        }
        Update: {
          ack_type?: string
          ack_version?: string
          acknowledged_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_acknowledgments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_acknowledgments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_gear: {
        Row: {
          brand: string | null
          condition: string
          created_at: string
          gear_type_id: string
          id: string
          last_service_date: string | null
          model: string | null
          next_service_due: string | null
          notes: string | null
          purchase_date: string | null
          serial_number: string | null
          service_interval_override_months: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          brand?: string | null
          condition?: string
          created_at?: string
          gear_type_id: string
          id?: string
          last_service_date?: string | null
          model?: string | null
          next_service_due?: string | null
          notes?: string | null
          purchase_date?: string | null
          serial_number?: string | null
          service_interval_override_months?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          brand?: string | null
          condition?: string
          created_at?: string
          gear_type_id?: string
          id?: string
          last_service_date?: string | null
          model?: string | null
          next_service_due?: string | null
          notes?: string | null
          purchase_date?: string | null
          serial_number?: string | null
          service_interval_override_months?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_gear_gear_type_id_fkey"
            columns: ["gear_type_id"]
            isOneToOne: false
            referencedRelation: "gear_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_gear_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_gear_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_insurance: {
        Row: {
          created_at: string
          expiry_date: string | null
          id: string
          notes: string | null
          policy_number_encrypted: string | null
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expiry_date?: string | null
          id?: string
          notes?: string | null
          policy_number_encrypted?: string | null
          provider: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expiry_date?: string | null
          id?: string
          notes?: string | null
          policy_number_encrypted?: string | null
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_insurance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_insurance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_licenses: {
        Row: {
          created_at: string
          document_url: string | null
          expiry_date: string | null
          id: string
          issue_date: string | null
          issuing_authority: string | null
          license_number: string | null
          license_type_id: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_url?: string | null
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          issuing_authority?: string | null
          license_number?: string | null
          license_type_id: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_url?: string | null
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          issuing_authority?: string | null
          license_number?: string | null
          license_type_id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_licenses_license_type_id_fkey"
            columns: ["license_type_id"]
            isOneToOne: false
            referencedRelation: "license_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_licenses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_licenses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          is_accountant: boolean
          is_claude_agent: boolean
          is_developer: boolean
          is_helpdesk: boolean
          is_landr_owner: boolean
          is_landr_staff: boolean
          is_release_approver: boolean
          is_release_promoter: boolean
          is_release_signer: boolean
          notify_staging_in_prod: boolean
          supabase_auth_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          is_accountant?: boolean
          is_claude_agent?: boolean
          is_developer?: boolean
          is_helpdesk?: boolean
          is_landr_owner?: boolean
          is_landr_staff?: boolean
          is_release_approver?: boolean
          is_release_promoter?: boolean
          is_release_signer?: boolean
          notify_staging_in_prod?: boolean
          supabase_auth_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          is_accountant?: boolean
          is_claude_agent?: boolean
          is_developer?: boolean
          is_helpdesk?: boolean
          is_landr_owner?: boolean
          is_landr_staff?: boolean
          is_release_approver?: boolean
          is_release_promoter?: boolean
          is_release_signer?: boolean
          notify_staging_in_prod?: boolean
          supabase_auth_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      view_user_state: {
        Row: {
          hidden: boolean
          pinned: boolean
          sort_order: number
          updated_at: string
          user_id: string
          view_id: string
        }
        Insert: {
          hidden?: boolean
          pinned?: boolean
          sort_order?: number
          updated_at?: string
          user_id: string
          view_id: string
        }
        Update: {
          hidden?: boolean
          pinned?: boolean
          sort_order?: number
          updated_at?: string
          user_id?: string
          view_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "view_user_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "view_user_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "view_user_state_view_id_fkey"
            columns: ["view_id"]
            isOneToOne: false
            referencedRelation: "saved_views"
            referencedColumns: ["id"]
          },
        ]
      }
      voucher_redemptions: {
        Row: {
          booking_id: string
          discount_amount_at_redemption: number
          id: string
          operator_id: string
          redeemed_at: string
          voucher_id: string
        }
        Insert: {
          booking_id: string
          discount_amount_at_redemption: number
          id?: string
          operator_id: string
          redeemed_at?: string
          voucher_id: string
        }
        Update: {
          booking_id?: string
          discount_amount_at_redemption?: number
          id?: string
          operator_id?: string
          redeemed_at?: string
          voucher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voucher_redemptions_booking_id_operator_id_fkey"
            columns: ["booking_id", "operator_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id", "operator_id"]
          },
          {
            foreignKeyName: "voucher_redemptions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "voucher_redemptions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voucher_redemptions_voucher_id_operator_id_fkey"
            columns: ["voucher_id", "operator_id"]
            isOneToOne: false
            referencedRelation: "vouchers"
            referencedColumns: ["id", "operator_id"]
          },
        ]
      }
      vouchers: {
        Row: {
          active: boolean
          amount: number
          applies_to_product_id: string | null
          campaign_id: string | null
          code: string
          created_at: string
          currency: string
          deleted_at: string | null
          deleted_by_user_id: string | null
          deletion_reason: string | null
          description: string | null
          description_localized: Json | null
          id: string
          kind: Database["public"]["Enums"]["voucher_kind"]
          max_uses: number | null
          operator_id: string
          scope: Database["public"]["Enums"]["voucher_scope"]
          updated_at: string
          used_count: number
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          active?: boolean
          amount: number
          applies_to_product_id?: string | null
          campaign_id?: string | null
          code: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          description?: string | null
          description_localized?: Json | null
          id?: string
          kind: Database["public"]["Enums"]["voucher_kind"]
          max_uses?: number | null
          operator_id: string
          scope?: Database["public"]["Enums"]["voucher_scope"]
          updated_at?: string
          used_count?: number
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          active?: boolean
          amount?: number
          applies_to_product_id?: string | null
          campaign_id?: string | null
          code?: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          description?: string | null
          description_localized?: Json | null
          id?: string
          kind?: Database["public"]["Enums"]["voucher_kind"]
          max_uses?: number | null
          operator_id?: string
          scope?: Database["public"]["Enums"]["voucher_scope"]
          updated_at?: string
          used_count?: number
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vouchers_applies_to_product_id_fkey"
            columns: ["applies_to_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vouchers_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vouchers_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vouchers_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vouchers_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "vouchers_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      assignable_users: {
        Row: {
          email: string | null
          id: string | null
          is_claude_agent: boolean | null
          is_landr_staff: boolean | null
        }
        Insert: {
          email?: string | null
          id?: string | null
          is_claude_agent?: boolean | null
          is_landr_staff?: boolean | null
        }
        Update: {
          email?: string | null
          id?: string | null
          is_claude_agent?: boolean | null
          is_landr_staff?: boolean | null
        }
        Relationships: []
      }
      contacts_with_types: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          deleted_by_user_id: string | null
          deletion_reason: string | null
          do_not_contact: boolean | null
          email: string | null
          external_contact_id: string | null
          external_target: string | null
          first_name: string | null
          gdpr_erased_at: string | null
          gdpr_erased_by_user_id: string | null
          gdpr_erasure_note: string | null
          id: string | null
          last_name: string | null
          operator_id: string | null
          phone: string | null
          preferred_locale: string | null
          preferred_timezone: string | null
          types: string[] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          do_not_contact?: boolean | null
          email?: string | null
          external_contact_id?: string | null
          external_target?: string | null
          first_name?: string | null
          gdpr_erased_at?: string | null
          gdpr_erased_by_user_id?: string | null
          gdpr_erasure_note?: string | null
          id?: string | null
          last_name?: string | null
          operator_id?: string | null
          phone?: string | null
          preferred_locale?: string | null
          preferred_timezone?: string | null
          types?: never
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          do_not_contact?: boolean | null
          email?: string | null
          external_contact_id?: string | null
          external_target?: string | null
          first_name?: string | null
          gdpr_erased_at?: string | null
          gdpr_erased_by_user_id?: string | null
          gdpr_erasure_note?: string | null
          id?: string | null
          last_name?: string | null
          operator_id?: string | null
          phone?: string | null
          preferred_locale?: string | null
          preferred_timezone?: string | null
          types?: never
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_gdpr_erased_by_user_id_fkey"
            columns: ["gdpr_erased_by_user_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_gdpr_erased_by_user_id_fkey"
            columns: ["gdpr_erased_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "contacts_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_inbox_operator_summary: {
        Row: {
          awaiting_reply_count: number | null
          last_activity_at: string | null
          operator_id: string | null
          operator_name: string | null
          operator_slug: string | null
          ticket_count: number | null
          unread_count: number | null
        }
        Relationships: []
      }
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      member_expiry_alerts: {
        Row: {
          alert_type: string | null
          category: string | null
          due_date: string | null
          record_id: string | null
          severity: string | null
          user_id: string | null
        }
        Relationships: []
      }
      member_profiles_public: {
        Row: {
          avatar_url: string | null
          name: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          name?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          name?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_days: {
        Row: {
          assigned_unit_id: string | null
          assigned_unit_name: string | null
          assigned_unit_pool_id: string | null
          booking_id: string | null
          booking_participant_id: string | null
          contact_id: string | null
          current_stage_code: string | null
          day_date: string | null
          email: string | null
          expected_back_at: string | null
          first_name: string | null
          last_name: string | null
          note: string | null
          operator_id: string | null
          part_of_day: string | null
          phone: string | null
          pickup_address: string | null
          pickup_lat: number | null
          pickup_lng: number | null
          pickup_location_id: string | null
          pickup_location_name: string | null
          pickup_location_override_id: string | null
          pickup_location_override_name: string | null
          pickup_time: string | null
          semantic_state:
            | Database["public"]["Enums"]["participant_day_semantic_state"]
            | null
          service_role_id: string | null
          service_role_label: string | null
          state_id: string | null
          status_code: string | null
          status_colour: string | null
          status_id: string | null
          status_label: string | null
          unit_assignment_source: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_participant_day_state_assigned_unit_id_fkey"
            columns: ["assigned_unit_id"]
            isOneToOne: false
            referencedRelation: "resource_pool_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_participant_day_state_pickup_location_id_fkey"
            columns: ["pickup_location_override_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_participant_day_state_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "participant_day_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_participants_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_participants_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_participants_pickup_location_id_fkey"
            columns: ["pickup_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_participants_service_role_id_fkey"
            columns: ["service_role_id"]
            isOneToOne: false
            referencedRelation: "service_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_products_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_products_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "booking_products_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_pool_units_resource_pool_id_fkey"
            columns: ["assigned_unit_pool_id"]
            isOneToOne: false
            referencedRelation: "resource_pools"
            referencedColumns: ["id"]
          },
        ]
      }
      pilot_presence_public: {
        Row: {
          activity_area_id: string | null
          activity_site_id: string | null
          expires_at: string | null
          intent_state: string | null
          lat: number | null
          lng: number | null
          set_at: string | null
          user_id: string | null
        }
        Insert: {
          activity_area_id?: string | null
          activity_site_id?: string | null
          expires_at?: string | null
          intent_state?: string | null
          lat?: never
          lng?: never
          set_at?: string | null
          user_id?: string | null
        }
        Update: {
          activity_area_id?: string | null
          activity_site_id?: string | null
          expires_at?: string | null
          intent_state?: string | null
          lat?: never
          lng?: never
          set_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pilot_presence_activity_area_id_fkey"
            columns: ["activity_area_id"]
            isOneToOne: false
            referencedRelation: "activity_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilot_presence_activity_site_id_fkey"
            columns: ["activity_site_id"]
            isOneToOne: false
            referencedRelation: "activity_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilot_presence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "member_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "pilot_presence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "member_profiles_public"
            referencedColumns: ["user_id"]
          },
        ]
      }
      sos_events_pending_resolve: {
        Row: {
          age: string | null
          created_at: string | null
          id: string | null
          lat: number | null
          lng: number | null
          member_name: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sos_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "member_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "sos_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "member_profiles_public"
            referencedColumns: ["user_id"]
          },
        ]
      }
      ticket_comments_staff: {
        Row: {
          author_id: string | null
          body: string | null
          created_at: string | null
          id: string | null
          is_internal: boolean | null
          operator_id: string | null
          relayed_to_landr_at: string | null
          ticket_id: string | null
          updated_at: string | null
        }
        Insert: {
          author_id?: string | null
          body?: string | null
          created_at?: string | null
          id?: string | null
          is_internal?: boolean | null
          operator_id?: string | null
          relayed_to_landr_at?: string | null
          ticket_id?: string | null
          updated_at?: string | null
        }
        Update: {
          author_id?: string | null
          body?: string | null
          created_at?: string | null
          id?: string | null
          is_internal?: boolean | null
          operator_id?: string | null
          relayed_to_landr_at?: string | null
          ticket_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_comments_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "ticket_comments_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets_staff: {
        Row: {
          assignee_id: string | null
          blocked: boolean | null
          body: string | null
          context: Database["public"]["Enums"]["ticket_context"] | null
          created_at: string | null
          id: string | null
          last_synced_at: string | null
          linked_bd_id: string | null
          moscow: Database["public"]["Enums"]["ticket_moscow"] | null
          operator_id: string | null
          origin_operator_label: string | null
          origin_tier: string | null
          perceived_impact:
            | Database["public"]["Enums"]["ticket_perceived_impact"]
            | null
          priority: Database["public"]["Enums"]["ticket_priority"] | null
          promotion_prompt: string | null
          promotion_requested_at: string | null
          relay_error: string | null
          relay_retry_count: number | null
          relayed_to_landr_at: string | null
          reporter_id: string | null
          severity: Database["public"]["Enums"]["ticket_severity"] | null
          source_ref: string | null
          status: Database["public"]["Enums"]["ticket_status"] | null
          sync_status: string | null
          title: string | null
          type: Database["public"]["Enums"]["ticket_type"] | null
          updated_at: string | null
        }
        Insert: {
          assignee_id?: string | null
          blocked?: boolean | null
          body?: string | null
          context?: Database["public"]["Enums"]["ticket_context"] | null
          created_at?: string | null
          id?: string | null
          last_synced_at?: string | null
          linked_bd_id?: string | null
          moscow?: Database["public"]["Enums"]["ticket_moscow"] | null
          operator_id?: string | null
          origin_operator_label?: string | null
          origin_tier?: string | null
          perceived_impact?:
            | Database["public"]["Enums"]["ticket_perceived_impact"]
            | null
          priority?: Database["public"]["Enums"]["ticket_priority"] | null
          promotion_prompt?: string | null
          promotion_requested_at?: string | null
          relay_error?: string | null
          relay_retry_count?: number | null
          relayed_to_landr_at?: string | null
          reporter_id?: string | null
          severity?: Database["public"]["Enums"]["ticket_severity"] | null
          source_ref?: string | null
          status?: Database["public"]["Enums"]["ticket_status"] | null
          sync_status?: string | null
          title?: string | null
          type?: Database["public"]["Enums"]["ticket_type"] | null
          updated_at?: string | null
        }
        Update: {
          assignee_id?: string | null
          blocked?: boolean | null
          body?: string | null
          context?: Database["public"]["Enums"]["ticket_context"] | null
          created_at?: string | null
          id?: string | null
          last_synced_at?: string | null
          linked_bd_id?: string | null
          moscow?: Database["public"]["Enums"]["ticket_moscow"] | null
          operator_id?: string | null
          origin_operator_label?: string | null
          origin_tier?: string | null
          perceived_impact?:
            | Database["public"]["Enums"]["ticket_perceived_impact"]
            | null
          priority?: Database["public"]["Enums"]["ticket_priority"] | null
          promotion_prompt?: string | null
          promotion_requested_at?: string | null
          relay_error?: string | null
          relay_retry_count?: number | null
          relayed_to_landr_at?: string | null
          reporter_id?: string | null
          severity?: Database["public"]["Enums"]["ticket_severity"] | null
          source_ref?: string | null
          status?: Database["public"]["Enums"]["ticket_status"] | null
          sync_status?: string | null
          title?: string | null
          type?: Database["public"]["Enums"]["ticket_type"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "feedback_inbox_operator_summary"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "tickets_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "assignable_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _backfill_attendance_pickup_onto_day_state: {
        Args: {
          p_booking_id: string
          p_booking_participant_id: string
          p_day_date: string
          p_operator_id: string
          p_pickup_location_id: string
          p_pickup_location_text: string
          p_pickup_time: string
        }
        Returns: string
      }
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _product_images_json: { Args: { p_product_id: string }; Returns: Json }
      _product_is_bookable: {
        Args: { p_product_id: string; p_product_kind: string }
        Returns: boolean
      }
      _product_price_from: {
        Args: { p_pricing_scheme_id: string }
        Returns: number
      }
      _product_thumb_path: { Args: { p_product_id: string }; Returns: string }
      _recompute_one_commission_batch: {
        Args: { p_batch_id: string }
        Returns: undefined
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      anniversary_due_briefings: {
        Args: { p_window_end_days?: number; p_window_start_days?: number }
        Returns: {
          booking_id: string
          briefing_id: string
          contact_email: string
          contact_first_name: string
          contact_id: string
          contact_preferred_locale: string
          do_not_contact: boolean
          operator_default_locale: string
          operator_id: string
          operator_name: string
          operator_slug: string
          public_token: string
          trip_end_date: string
        }[]
      }
      anonymize_user_pii: { Args: { p_user_id: string }; Returns: boolean }
      append_overflow_incident: {
        Args: { p_line: string; p_max_lines?: number; p_source_ref: string }
        Returns: string
      }
      applicable_subscription_perks: {
        Args: {
          p_contact_id?: string
          p_email?: string
          p_operator_id: string
          p_product_id: string
        }
        Returns: {
          amount: number
          applies_to_product_id: string
          id: string
          kind: string
          label: string
          subscription_id: string
        }[]
      }
      apply_custom_offer: {
        Args: {
          p_applied_by: string
          p_booking_id: string
          p_group_discount_pct: number
          p_group_threshold: number
          p_tax_rate: number
        }
        Returns: {
          free_count: number
          gross_total: number
          group_discount_applied: boolean
          net_total: number
          paying_count: number
          tax_total: number
        }[]
      }
      apply_holded_webhook_contact_change: {
        Args: {
          p_contact_id: string
          p_event_id: string
          p_operator_id: string
        }
        Returns: Json
      }
      apply_holded_webhook_invoice_approve: {
        Args: { p_event_id: string; p_invoice_id: string }
        Returns: Json
      }
      apply_resource_pool_approval_periods: {
        Args: {
          p_actor_user_id?: string
          p_dry_run?: boolean
          p_mode: Database["public"]["Enums"]["resource_pool_approval_mode"]
          p_note: string
          p_operator_id: string
          p_ranges: Json
          p_released_unit_ids: string[]
          p_releases_all_units: boolean
          p_resource_pool_id: string
        }
        Returns: {
          active: boolean
          end_date: string
          id: string
          mode: Database["public"]["Enums"]["resource_pool_approval_mode"]
          note: string
          operator_id: string
          released_unit_ids: string[]
          releases_all_units: boolean
          resource_pool_id: string
          start_date: string
        }[]
      }
      apply_resource_pool_unit_service_periods: {
        Args: {
          p_actor_user_id?: string
          p_dry_run?: boolean
          p_operator_id: string
          p_periods: Json
          p_resource_pool_id: string
          p_unit_id: string
        }
        Returns: {
          active: boolean
          end_date: string
          id: string
          kind: Database["public"]["Enums"]["resource_pool_unit_service_kind"]
          operator_id: string
          reason: string
          resource_pool_id: string
          start_date: string
          unit_id: string
        }[]
      }
      apply_stripe_webhook_event: {
        Args: { event_id: string; event_object: Json; event_type: string }
        Returns: Json
      }
      apply_subscription_billing_event: {
        Args: {
          p_actor_subkind?: string
          p_event_at?: string
          p_event_id?: string
          p_intent: string
          p_operator_id: string
          p_payload: Json
        }
        Returns: Json
      }
      apply_tenant_rls: { Args: { p_table_name: string }; Returns: undefined }
      bookings_rebuild_search_text: {
        Args: { p_booking_id: string }
        Returns: undefined
      }
      cleanup_audit_log_partitions: { Args: never; Returns: number }
      community_soft_delete_message: {
        Args: { p_message_id: string }
        Returns: undefined
      }
      consume_subscription_perk_otp: {
        Args: { p_code_hash: string; p_email: string; p_operator_id: string }
        Returns: boolean
      }
      create_audit_log_partition: {
        Args: { p_month_start: string }
        Returns: undefined
      }
      current_user_is_landr_staff: { Args: never; Returns: boolean }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      ensure_resource_pool_capacity_policy_rule: {
        Args: { p_operator_id: string; p_resource_pool_id: string }
        Returns: string
      }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      erase_deferred_user_pii: { Args: { p_user_id: string }; Returns: number }
      finalise_due_bookings_t2: { Args: { p_as_of?: string }; Returns: Json }
      gdpr_erase_contact: {
        Args: { p_contact_id: string; p_jurisdiction_note: string }
        Returns: undefined
      }
      gen_widget_token: { Args: never; Returns: string }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      gettransactionid: { Args: never; Returns: unknown }
      holded_eom_auto_resolve: {
        Args: { p_force?: boolean }
        Returns: {
          decisions_resolved: number
          sync_logs_reenqueued: number
        }[]
      }
      inquiry_rate_limit_increment: {
        Args: { p_ip_addr: string; p_token: string; p_window_start: string }
        Returns: number
      }
      is_tenant_visible: { Args: { p_operator_id: string }; Returns: boolean }
      longtransactionsenabled: { Args: never; Returns: boolean }
      normalise_email: { Args: { p_email: string }; Returns: string }
      notify_ticket_bell: {
        Args: {
          p_body: string
          p_event_type: string
          p_ticket_id: string
          p_title: string
          p_user_id: string
        }
        Returns: boolean
      }
      operator_effective_entitlements: {
        Args: { p_operator_id: string }
        Returns: {
          config: Json
          enabled: boolean
          feature_key: string
        }[]
      }
      operator_effective_features: {
        Args: { p_operator_id: string }
        Returns: {
          enabled: boolean
          feature_key: string
        }[]
      }
      patch_ticket_status_as_actor: {
        Args: {
          p_actor_id: string
          p_status: Database["public"]["Enums"]["ticket_status"]
          p_ticket_id: string
        }
        Returns: undefined
      }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      product_day_seat_load: {
        Args: { p_from: string; p_product_id: string; p_to: string }
        Returns: {
          day: string
          seat_load: number
        }[]
      }
      public_get_booking_by_token: {
        Args: { p_booking_id: string }
        Returns: Json
      }
      public_get_briefing_by_token: { Args: { p_token: string }; Returns: Json }
      public_get_operator_locations: {
        Args: { operator_slug: string }
        Returns: {
          email: string
          location_id: string
          name: string
          name_localized: Json
          parent_id: string
          role_type: Json
          role_type_id: string
        }[]
      }
      public_get_operator_product_groups: {
        Args: { operator_slug: string }
        Returns: {
          bookable_count: number
          description: string
          description_localized: Json
          id: string
          image_path: string
          name: string
          name_localized: Json
          parent_id: string
          product_count: number
          slug: string
          sort_order: number
        }[]
      }
      public_get_operator_products: {
        Args: { group_slug?: string; operator_slug: string }
        Returns: {
          bookable: boolean
          capacity_per_unit: number
          currency: string
          description: string
          duration_minutes: number
          fixed_end_date: string
          fixed_start_date: string
          group_name: string
          group_slug: string
          hotel_location_id: string
          hotel_offering: string
          images: Json
          includes_breakfast: boolean
          is_contiguous: boolean
          location_ids: string[]
          name: string
          name_localized: Json
          needs_pickup: boolean
          next_window_end: string
          next_window_start: string
          price_from: number
          price_per_unit: number
          product_group_id: string
          product_id: string
          product_kind: string
          service_time_shape: string
          short_description: string
          short_description_localized: Json
          slug: string
          sort_order: number
          sport_subcategory_codes: string[]
          thumb_path: string
        }[]
      }
      public_get_operator_service_roles: {
        Args: { operator_slug: string }
        Returns: {
          code: string
          id: string
          label: string
          label_localized: Json
          sort_order: number
        }[]
      }
      public_get_operator_settings: {
        Args: { operator_slug: string }
        Returns: {
          contact_email: string
          expose_seats_to_customer: boolean
          has_member_perks: boolean
          logo_url: string
          name: string
          offer_account_link: boolean
          primary_color: string
          slug: string
          theme: Json
          widget_catalog_layout: string
          widget_category_columns: number
          widget_description: string
          widget_description_first_page_only: boolean
          widget_footer: string
          widget_footer_first_page_only: boolean
          widget_headline: string
          widget_headline_first_page_only: boolean
          widget_tile_aspect: string
          widget_tile_font: string
          widget_tile_hover: string
          widget_tile_radius: string
          widget_tile_scrim: string
          widget_title_case: string
          widget_variant: string
        }[]
      }
      public_get_product_addons: {
        Args: { p_parent_product_id: string }
        Returns: {
          addon_product_id: string
          currency: string
          is_required: boolean
          max_qty: number
          min_qty: number
          name: string
          name_localized: Json
          price_per_unit: number
          product_addon_id: string
          product_kind: string
          sort_order: number
        }[]
      }
      public_get_product_availability: {
        Args: { p_from: string; p_product_id: string; p_to: string }
        Returns: {
          availability_id: string
          available_seats: number
          capacity: number
          capacity_reserved: number
          date: string
          end_time: string
          start_time: string
          status: string
        }[]
      }
      public_get_product_fixed_date_windows: {
        Args: { p_product_id: string }
        Returns: {
          available_seats: number
          capacity: number
          capacity_reserved: number
          end_date: string
          id: string
          start_date: string
        }[]
      }
      public_get_product_flow: {
        Args: { p_operator_slug: string; p_product_id: string }
        Returns: Json
      }
      public_get_site_services: {
        Args: { p_site_id: string }
        Returns: {
          link_id: string
          note: string
          operator_id: string
          operator_name: string
          operator_slug: string
          product_id: string
          product_kind: string
          product_name: string
          product_name_localized: Json
          product_slug: string
          service_time_shape: string
          short_description: string
          short_description_localized: Json
        }[]
      }
      public_initiate_payment: { Args: { payload: Json }; Returns: Json }
      public_preview_operator_products: {
        Args: { group_slug?: string; operator_slug: string }
        Returns: {
          bookable: boolean
          capacity_per_unit: number
          currency: string
          description: string
          duration_minutes: number
          fixed_end_date: string
          fixed_start_date: string
          group_name: string
          group_slug: string
          hotel_location_id: string
          hotel_offering: string
          images: Json
          includes_breakfast: boolean
          is_contiguous: boolean
          is_publicly_listed: boolean
          location_ids: string[]
          name: string
          name_localized: Json
          needs_pickup: boolean
          next_window_end: string
          next_window_start: string
          price_from: number
          price_per_unit: number
          product_group_id: string
          product_id: string
          product_kind: string
          service_time_shape: string
          short_description: string
          short_description_localized: Json
          slug: string
          sort_order: number
          sport_subcategory_codes: string[]
          thumb_path: string
        }[]
      }
      public_record_booking_approval_response: {
        Args: {
          p_comment: string
          p_decision: string
          p_request_id: string
          p_responder_name: string
        }
        Returns: Json
      }
      public_resolve_approval_request_by_token: {
        Args: { p_token: string }
        Returns: Json
      }
      public_resolve_briefing_booking_by_token: {
        Args: { p_token: string }
        Returns: Json
      }
      public_submit_booking: { Args: { p_payload: Json }; Returns: Json }
      purge_user_operational_rows: {
        Args: { p_user_id: string }
        Returns: number
      }
      recompute_booking_balance_due: {
        Args: { booking_id_arg: string }
        Returns: undefined
      }
      reinstate_subscription_perk_otp: {
        Args: { p_code_hash: string; p_email: string; p_operator_id: string }
        Returns: boolean
      }
      resolve_contact_by_email: {
        Args: { p_email: string; p_operator_id: string }
        Returns: string
      }
      resolve_ticket_notify_setting: {
        Args: { p_ticket_id: string; p_user_id: string }
        Returns: {
          bell: boolean
          delivery_mode: Database["public"]["Enums"]["notification_delivery_mode"]
          email: boolean
          push: boolean
        }[]
      }
      resolve_user_by_email: { Args: { p_email: string }; Returns: string }
      resource_pool_day_load: {
        Args: { p_days: string[]; p_resource_pool_id: string }
        Returns: {
          day: string
          gate_load: number
          total_load: number
        }[]
      }
      resource_pool_kind_defaults: {
        Args: { p_kind: Database["public"]["Enums"]["resource_kind"] }
        Returns: {
          slot_label: string
          slot_label_plural: string
          unit_label: string
          unit_label_plural: string
        }[]
      }
      roll_audit_log_partitions_ahead: { Args: never; Returns: undefined }
      safe_at_time_zone: { Args: { ts: string; tz: string }; Returns: string }
      set_member_disciplines: {
        Args: { p_entries: Json }
        Returns: {
          created_at: string
          discipline_id: string
          hours_per_year: number | null
          skill_level: string | null
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "member_disciplines"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      signup_create_operator: {
        Args: {
          p_email: string
          p_name: string
          p_slug: string
          p_user_id: string
        }
        Returns: string
      }
      site_warnings_nearby_pilots: {
        Args: { p_radius_m?: number; p_site_id: string }
        Returns: {
          name: string
          tier: string
          user_id: string
        }[]
      }
      sos_nearby_members: {
        Args: { p_lat: number; p_lng: number; p_radius_m?: number }
        Returns: {
          lat: number
          lng: number
          name: string
          user_id: string
        }[]
      }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      staff_create_pricing_scheme_tree: {
        Args: { p_operator_id: string; p_rules?: Json; p_scheme: Json }
        Returns: Json
      }
      staff_put_participant_day_state: {
        Args: {
          p_booking_id: string
          p_booking_participant_id: string
          p_day_date: string
          p_expected_back_at?: string
          p_note: string
          p_operator_id: string
          p_part_of_day: string
          p_pickup_address: string
          p_pickup_lat: number
          p_pickup_lng: number
          p_set_by: string
          p_status_id: string
        }
        Returns: Json
      }
      staff_save_product_availability_batch: {
        Args: {
          p_closes?: string[]
          p_deletes?: string[]
          p_operator_id: string
          p_product_id: string
          p_upserts?: Json
        }
        Returns: Json
      }
      staff_seed_participant_day_units: {
        Args: {
          p_candidates: Json
          p_day_date: string
          p_operator_id: string
          p_set_by?: string
          p_unit_ids: string[]
        }
        Returns: Json
      }
      staff_set_participant_day_unit: {
        Args: {
          p_assigned_unit_id: string
          p_booking_id: string
          p_booking_participant_id: string
          p_day_date: string
          p_operator_id: string
          p_set_by: string
        }
        Returns: Json
      }
      staff_submit_booking: { Args: { p_payload: Json }; Returns: Json }
      stale_approval_bookings: {
        Args: { p_limit?: number; p_stale_after_hours?: number }
        Returns: {
          booking_id: string
          booking_reference: string
          branch: string
          current_stage_code: string
          hours_pending: number
          last_comment: string
          last_decision: string
          last_responded_at: string
          operator_id: string
          request_id: string
          responder_location_name: string
          stage_entered_at: string
        }[]
      }
      subscription_has_live_member: {
        Args: {
          p_email: string
          p_operator_id: string
          p_subscription_id: string
        }
        Returns: boolean
      }
      transition_booking_approval: {
        Args: {
          p_booking_id: string
          p_branch: string
          p_decision: string
          p_reason?: string
          p_staff_user_id?: string
          p_unit_release?: Json
        }
        Returns: Json
      }
      unlockrows: { Args: { "": string }; Returns: number }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
    }
    Enums: {
      actor_kind: "user" | "system" | "integration" | "admin" | "anonymous"
      agent_earning_status: "accrued" | "paid" | "reversed"
      approval_outcome: "require_manual_approval" | "auto_approve" | "reject"
      approval_rule_kind:
        | "capacity_threshold"
        | "capacity_percentage"
        | "date_override"
        | "product_override"
        | "first_time_customer"
        | "high_value"
        | "requires_hotel_branch"
        | "pickup_location_role_match"
      booking_channel_kind:
        | "public_website"
        | "agent_dashboard"
        | "agent_qr_self_serve"
        | "phone_hotline"
        | "walk_in"
        | "imported"
      booking_semantic_state:
        | "pending"
        | "confirmed"
        | "finalised"
        | "cancelled"
        | "no_show"
      briefing_checkin_status:
        | "arrived_designated"
        | "arrived_elsewhere"
        | "in_progress"
      briefing_conditions_status: "pending" | "go" | "marginal" | "no_go"
      campaign_kind:
        | "marketing"
        | "agent_promo"
        | "partner_referral"
        | "voucher_linked"
        | "launch"
      campaign_scope: "booking" | "subscription" | "any"
      commission_adjustment_kind:
        | "partial_reversal"
        | "full_reversal"
        | "rate_correction"
        | "manual_credit"
      commission_batch_status: "open" | "sealed" | "paid"
      commission_recipient_kind: "platform" | "agent" | "provider"
      commission_rule_kind:
        | "base_percentage_of_net"
        | "base_percentage_of_gross"
        | "base_flat_per_booking"
        | "base_flat_per_day"
        | "product_override"
        | "channel_override"
        | "date_pattern_override"
        | "participant_count_tier"
        | "value_tier"
        | "campaign_override"
        | "monthly_volume_bonus"
        | "effective_period"
        | "manual_override"
      commission_status: "accrued" | "paid" | "reversed"
      digest_queue_status: "pending" | "sent" | "failed"
      external_sync_status:
        | "pending"
        | "in_flight"
        | "succeeded"
        | "failed"
        | "blocked_on_human"
      group_billing_arrangement: "separate_invoices" | "one_invoice" | "custom"
      holded_approve_mode: "never" | "on_push"
      holded_transfer_mode: "all_finalized" | "only_paid"
      notification_delivery_mode: "immediate" | "digest"
      outbound_email_status:
        | "queued"
        | "sending"
        | "sent"
        | "failed"
        | "skipped"
      participant_day_semantic_state:
        | "expected"
        | "present"
        | "absent"
        | "released"
        | "needs_pickup"
        | "completed"
      payment_provider:
        | "stripe"
        | "manual_cash"
        | "manual_transfer"
        | "manual_card"
        | "imported_historical"
      payment_status:
        | "pending"
        | "succeeded"
        | "failed"
        | "refunded"
        | "partially_refunded"
      pricing_rule_kind:
        | "per_day_base"
        | "per_streak_tier"
        | "per_total_days_tier"
        | "per_participant_tier"
        | "fixed_total"
        | "percentage_discount"
        | "flat_discount"
        | "time_of_day_surcharge"
        | "manual_override"
      product_availability_source: "template" | "manual"
      product_availability_status: "open" | "closed" | "fully_booked"
      product_kind:
        | "service"
        | "digital_good"
        | "physical_good"
        | "gift_card"
        | "subscription"
        | "hotel_room"
      product_schedule_exception_kind:
        | "closed"
        | "capacity_override"
        | "times_override"
      refund_status: "pending" | "succeeded" | "failed"
      resource_kind:
        | "transport_seat"
        | "staff_capacity"
        | "equipment_unit"
        | "physical_space"
        | "generic_seat"
      resource_pool_approval_mode:
        | "ask_every_time"
        | "ask_per_unit"
        | "units_released"
      resource_pool_unit_service_kind: "in_service" | "out_of_service"
      service_time_shape:
        | "single_date"
        | "days_range"
        | "fixed_window"
        | "time_slot"
      site_warning_severity: "critical" | "advisory"
      tax_id_kind:
        | "es_nif"
        | "es_cif"
        | "de_ust_idnr"
        | "uk_vat"
        | "fr_siren"
        | "generic_eu_vat"
        | "other"
      ticket_context: "operations" | "community" | "system"
      ticket_moscow: "must" | "should" | "could" | "wont"
      ticket_perceived_impact: "blocking" | "annoying" | "idea"
      ticket_priority: "p0" | "p1" | "p2"
      ticket_severity: "blocker" | "critical" | "major" | "minor" | "trivial"
      ticket_status: "backlog" | "ready" | "in_progress" | "in_review" | "done"
      ticket_type: "bug" | "feature" | "annoyance" | "question"
      voucher_kind: "percent" | "flat"
      voucher_scope: "booking" | "subscription" | "any"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      actor_kind: ["user", "system", "integration", "admin", "anonymous"],
      agent_earning_status: ["accrued", "paid", "reversed"],
      approval_outcome: ["require_manual_approval", "auto_approve", "reject"],
      approval_rule_kind: [
        "capacity_threshold",
        "capacity_percentage",
        "date_override",
        "product_override",
        "first_time_customer",
        "high_value",
        "requires_hotel_branch",
        "pickup_location_role_match",
      ],
      booking_channel_kind: [
        "public_website",
        "agent_dashboard",
        "agent_qr_self_serve",
        "phone_hotline",
        "walk_in",
        "imported",
      ],
      booking_semantic_state: [
        "pending",
        "confirmed",
        "finalised",
        "cancelled",
        "no_show",
      ],
      briefing_checkin_status: [
        "arrived_designated",
        "arrived_elsewhere",
        "in_progress",
      ],
      briefing_conditions_status: ["pending", "go", "marginal", "no_go"],
      campaign_kind: [
        "marketing",
        "agent_promo",
        "partner_referral",
        "voucher_linked",
        "launch",
      ],
      campaign_scope: ["booking", "subscription", "any"],
      commission_adjustment_kind: [
        "partial_reversal",
        "full_reversal",
        "rate_correction",
        "manual_credit",
      ],
      commission_batch_status: ["open", "sealed", "paid"],
      commission_recipient_kind: ["platform", "agent", "provider"],
      commission_rule_kind: [
        "base_percentage_of_net",
        "base_percentage_of_gross",
        "base_flat_per_booking",
        "base_flat_per_day",
        "product_override",
        "channel_override",
        "date_pattern_override",
        "participant_count_tier",
        "value_tier",
        "campaign_override",
        "monthly_volume_bonus",
        "effective_period",
        "manual_override",
      ],
      commission_status: ["accrued", "paid", "reversed"],
      digest_queue_status: ["pending", "sent", "failed"],
      external_sync_status: [
        "pending",
        "in_flight",
        "succeeded",
        "failed",
        "blocked_on_human",
      ],
      group_billing_arrangement: ["separate_invoices", "one_invoice", "custom"],
      holded_approve_mode: ["never", "on_push"],
      holded_transfer_mode: ["all_finalized", "only_paid"],
      notification_delivery_mode: ["immediate", "digest"],
      outbound_email_status: ["queued", "sending", "sent", "failed", "skipped"],
      participant_day_semantic_state: [
        "expected",
        "present",
        "absent",
        "released",
        "needs_pickup",
        "completed",
      ],
      payment_provider: [
        "stripe",
        "manual_cash",
        "manual_transfer",
        "manual_card",
        "imported_historical",
      ],
      payment_status: [
        "pending",
        "succeeded",
        "failed",
        "refunded",
        "partially_refunded",
      ],
      pricing_rule_kind: [
        "per_day_base",
        "per_streak_tier",
        "per_total_days_tier",
        "per_participant_tier",
        "fixed_total",
        "percentage_discount",
        "flat_discount",
        "time_of_day_surcharge",
        "manual_override",
      ],
      product_availability_source: ["template", "manual"],
      product_availability_status: ["open", "closed", "fully_booked"],
      product_kind: [
        "service",
        "digital_good",
        "physical_good",
        "gift_card",
        "subscription",
        "hotel_room",
      ],
      product_schedule_exception_kind: [
        "closed",
        "capacity_override",
        "times_override",
      ],
      refund_status: ["pending", "succeeded", "failed"],
      resource_kind: [
        "transport_seat",
        "staff_capacity",
        "equipment_unit",
        "physical_space",
        "generic_seat",
      ],
      resource_pool_approval_mode: [
        "ask_every_time",
        "ask_per_unit",
        "units_released",
      ],
      resource_pool_unit_service_kind: ["in_service", "out_of_service"],
      service_time_shape: [
        "single_date",
        "days_range",
        "fixed_window",
        "time_slot",
      ],
      site_warning_severity: ["critical", "advisory"],
      tax_id_kind: [
        "es_nif",
        "es_cif",
        "de_ust_idnr",
        "uk_vat",
        "fr_siren",
        "generic_eu_vat",
        "other",
      ],
      ticket_context: ["operations", "community", "system"],
      ticket_moscow: ["must", "should", "could", "wont"],
      ticket_perceived_impact: ["blocking", "annoying", "idea"],
      ticket_priority: ["p0", "p1", "p2"],
      ticket_severity: ["blocker", "critical", "major", "minor", "trivial"],
      ticket_status: ["backlog", "ready", "in_progress", "in_review", "done"],
      ticket_type: ["bug", "feature", "annoyance", "question"],
      voucher_kind: ["percent", "flat"],
      voucher_scope: ["booking", "subscription", "any"],
    },
  },
} as const

