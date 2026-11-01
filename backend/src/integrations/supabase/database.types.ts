// Gerado a partir do schema do projeto sentinela-dev (migrations 0001 a 0004), em 31/10/2026.
// Ao criar uma migration nova, regenere este arquivo com o Supabase CLI
// (`supabase gen types typescript`) ou pela ferramenta de tipos do Supabase.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.18';
  };
  public: {
    Tables: {
      alerts: {
        Row: {
          alert_type: string;
          attempts: number;
          created_at: string;
          delivery_status: string;
          id: string;
          idempotency_key: string;
          last_error: string | null;
          resend_message_id: string | null;
          sent_at: string | null;
          threat_id: string;
          user_id: string;
        };
        Insert: {
          alert_type: string;
          attempts?: number;
          created_at?: string;
          delivery_status?: string;
          id?: string;
          idempotency_key: string;
          last_error?: string | null;
          resend_message_id?: string | null;
          sent_at?: string | null;
          threat_id: string;
          user_id: string;
        };
        Update: {
          alert_type?: string;
          attempts?: number;
          created_at?: string;
          delivery_status?: string;
          id?: string;
          idempotency_key?: string;
          last_error?: string | null;
          resend_message_id?: string | null;
          sent_at?: string | null;
          threat_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'alerts_threat_id_fkey';
            columns: ['threat_id'];
            isOneToOne: false;
            referencedRelation: 'threats';
            referencedColumns: ['id'];
          },
        ];
      };
      analyses: {
        Row: {
          ai_status: string;
          content: Json;
          created_at: string;
          id: string;
          model: string | null;
          prompt_version: string;
          provider: string;
          scan_id: string;
          user_id: string;
        };
        Insert: {
          ai_status: string;
          content: Json;
          created_at?: string;
          id?: string;
          model?: string | null;
          prompt_version: string;
          provider: string;
          scan_id: string;
          user_id: string;
        };
        Update: {
          ai_status?: string;
          content?: Json;
          created_at?: string;
          id?: string;
          model?: string | null;
          prompt_version?: string;
          provider?: string;
          scan_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'analyses_scan_id_user_id_fkey';
            columns: ['scan_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'scans';
            referencedColumns: ['id', 'user_id'];
          },
        ];
      };
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          entity: string;
          entity_id: string | null;
          id: number;
          metadata: Json;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          entity: string;
          entity_id?: string | null;
          id?: never;
          metadata?: Json;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          entity?: string;
          entity_id?: string | null;
          id?: never;
          metadata?: Json;
        };
        Relationships: [];
      };
      indicators: {
        Row: {
          confidence: number;
          created_at: string;
          first_seen_at: string;
          id: string;
          indicator_type: string;
          indicator_value: string;
          last_seen_at: string;
          source_id: string;
        };
        Insert: {
          confidence?: number;
          created_at?: string;
          first_seen_at?: string;
          id?: string;
          indicator_type: string;
          indicator_value: string;
          last_seen_at?: string;
          source_id: string;
        };
        Update: {
          confidence?: number;
          created_at?: string;
          first_seen_at?: string;
          id?: string;
          indicator_type?: string;
          indicator_value?: string;
          last_seen_at?: string;
          source_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'indicators_source_id_fkey';
            columns: ['source_id'];
            isOneToOne: false;
            referencedRelation: 'sources';
            referencedColumns: ['id'];
          },
        ];
      };
      ingestion_runs: {
        Row: {
          error_summary: string | null;
          finished_at: string | null;
          id: string;
          items_new: number;
          items_received: number;
          items_updated: number;
          source_id: string;
          started_at: string;
          status: string;
        };
        Insert: {
          error_summary?: string | null;
          finished_at?: string | null;
          id?: string;
          items_new?: number;
          items_received?: number;
          items_updated?: number;
          source_id: string;
          started_at?: string;
          status: string;
        };
        Update: {
          error_summary?: string | null;
          finished_at?: string | null;
          id?: string;
          items_new?: number;
          items_received?: number;
          items_updated?: number;
          source_id?: string;
          started_at?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ingestion_runs_source_id_fkey';
            columns: ['source_id'];
            isOneToOne: false;
            referencedRelation: 'sources';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          full_name: string | null;
          id: string;
          role: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          full_name?: string | null;
          id: string;
          role?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string | null;
          id?: string;
          role?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      scans: {
        Row: {
          algorithm_version: string;
          classification: string;
          created_at: string;
          evidence: Json;
          host: string;
          id: string;
          normalized_url: string;
          risk_level: string;
          risk_score: number;
          rules_triggered: Json;
          sources_consulted: Json;
          status: string;
          url: string;
          user_id: string;
        };
        Insert: {
          algorithm_version: string;
          classification: string;
          created_at?: string;
          evidence?: Json;
          host: string;
          id?: string;
          normalized_url: string;
          risk_level: string;
          risk_score: number;
          rules_triggered?: Json;
          sources_consulted?: Json;
          status: string;
          url: string;
          user_id: string;
        };
        Update: {
          algorithm_version?: string;
          classification?: string;
          created_at?: string;
          evidence?: Json;
          host?: string;
          id?: string;
          normalized_url?: string;
          risk_level?: string;
          risk_score?: number;
          rules_triggered?: Json;
          sources_consulted?: Json;
          status?: string;
          url?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      sources: {
        Row: {
          base_url: string;
          consecutive_failures: number;
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          last_error_at: string | null;
          last_error_summary: string | null;
          last_success_at: string | null;
          name: string;
          reliability: number;
          source_type: string;
          terms_url: string | null;
          updated_at: string;
        };
        Insert: {
          base_url: string;
          consecutive_failures?: number;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          last_error_at?: string | null;
          last_error_summary?: string | null;
          last_success_at?: string | null;
          name: string;
          reliability: number;
          source_type: string;
          terms_url?: string | null;
          updated_at?: string;
        };
        Update: {
          base_url?: string;
          consecutive_failures?: number;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          last_error_at?: string | null;
          last_error_summary?: string | null;
          last_success_at?: string | null;
          name?: string;
          reliability?: number;
          source_type?: string;
          terms_url?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          category: string;
          created_at: string;
          enabled: boolean;
          id: string;
          user_id: string;
        };
        Insert: {
          category: string;
          created_at?: string;
          enabled?: boolean;
          id?: string;
          user_id: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          enabled?: boolean;
          id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      threat_indicators: {
        Row: {
          indicator_id: string;
          threat_id: string;
        };
        Insert: {
          indicator_id: string;
          threat_id: string;
        };
        Update: {
          indicator_id?: string;
          threat_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'threat_indicators_indicator_id_fkey';
            columns: ['indicator_id'];
            isOneToOne: false;
            referencedRelation: 'indicators';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'threat_indicators_threat_id_fkey';
            columns: ['threat_id'];
            isOneToOne: false;
            referencedRelation: 'threats';
            referencedColumns: ['id'];
          },
        ];
      };
      threat_revisions: {
        Row: {
          changed_fields: Json;
          created_at: string;
          id: number;
          ingestion_run_id: string | null;
          threat_id: string;
        };
        Insert: {
          changed_fields: Json;
          created_at?: string;
          id?: never;
          ingestion_run_id?: string | null;
          threat_id: string;
        };
        Update: {
          changed_fields?: Json;
          created_at?: string;
          id?: never;
          ingestion_run_id?: string | null;
          threat_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'threat_revisions_ingestion_run_id_fkey';
            columns: ['ingestion_run_id'];
            isOneToOne: false;
            referencedRelation: 'ingestion_runs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'threat_revisions_threat_id_fkey';
            columns: ['threat_id'];
            isOneToOne: false;
            referencedRelation: 'threats';
            referencedColumns: ['id'];
          },
        ];
      };
      threats: {
        Row: {
          category: string;
          collected_at: string;
          created_at: string;
          cve_id: string | null;
          dedupe_key: string;
          description: string | null;
          external_id: string | null;
          id: string;
          last_verified_at: string | null;
          published_at: string | null;
          severity: string;
          source_id: string;
          source_url: string | null;
          title: string;
          updated_at: string;
          verification_status: string;
        };
        Insert: {
          category: string;
          collected_at?: string;
          created_at?: string;
          cve_id?: string | null;
          dedupe_key: string;
          description?: string | null;
          external_id?: string | null;
          id?: string;
          last_verified_at?: string | null;
          published_at?: string | null;
          severity: string;
          source_id: string;
          source_url?: string | null;
          title: string;
          updated_at?: string;
          verification_status?: string;
        };
        Update: {
          category?: string;
          collected_at?: string;
          created_at?: string;
          cve_id?: string | null;
          dedupe_key?: string;
          description?: string | null;
          external_id?: string | null;
          id?: string;
          last_verified_at?: string | null;
          published_at?: string | null;
          severity?: string;
          source_id?: string;
          source_url?: string | null;
          title?: string;
          updated_at?: string;
          verification_status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'threats_source_id_fkey';
            columns: ['source_id'];
            isOneToOne: false;
            referencedRelation: 'sources';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
