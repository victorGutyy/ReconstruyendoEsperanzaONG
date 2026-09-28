export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          changed_fields: string[];
          id: number;
          new_data: Json | null;
          occurred_at: string;
          old_data: Json | null;
          record_id: string;
          table_name: string;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          changed_fields?: string[];
          id?: never;
          new_data?: Json | null;
          occurred_at?: string;
          old_data?: Json | null;
          record_id: string;
          table_name: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          changed_fields?: string[];
          id?: never;
          new_data?: Json | null;
          occurred_at?: string;
          old_data?: Json | null;
          record_id?: string;
          table_name?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          description: string | null;
          id: string;
          name: string;
          position: number;
          scope: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          name: string;
          position?: number;
          scope: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          name?: string;
          position?: number;
          scope?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      consent_records: {
        Row: {
          channel: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          document_path: string;
          form_version: string;
          granted_on: string;
          id: string;
          is_minor: boolean;
          minor_opinion: string | null;
          revocation_note: string | null;
          revoked_at: string | null;
          scope_description: string;
          signer_name: string | null;
          signer_type: string;
          subject_name: string;
          updated_at: string;
          updated_by: string | null;
          valid_until: string | null;
        };
        Insert: {
          channel: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          document_path: string;
          form_version: string;
          granted_on: string;
          id?: string;
          is_minor: boolean;
          minor_opinion?: string | null;
          revocation_note?: string | null;
          revoked_at?: string | null;
          scope_description: string;
          signer_name?: string | null;
          signer_type: string;
          subject_name: string;
          updated_at?: string;
          updated_by?: string | null;
          valid_until?: string | null;
        };
        Update: {
          channel?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          document_path?: string;
          form_version?: string;
          granted_on?: string;
          id?: string;
          is_minor?: boolean;
          minor_opinion?: string | null;
          revocation_note?: string | null;
          revoked_at?: string | null;
          scope_description?: string;
          signer_name?: string | null;
          signer_type?: string;
          subject_name?: string;
          updated_at?: string;
          updated_by?: string | null;
          valid_until?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "consent_records_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "consent_records_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      media: {
        Row: {
          alt_text: string | null;
          bytes: number | null;
          caption: string | null;
          created_at: string;
          credit: string | null;
          deleted_at: string | null;
          height: number | null;
          id: string;
          mime_type: string | null;
          people_in_photo: string | null;
          private_path: string | null;
          processing_status: string;
          public_key: string | null;
          updated_at: string;
          uploaded_by: string;
          width: number | null;
        };
        Insert: {
          alt_text?: string | null;
          bytes?: number | null;
          caption?: string | null;
          created_at?: string;
          credit?: string | null;
          deleted_at?: string | null;
          height?: number | null;
          id?: string;
          mime_type?: string | null;
          people_in_photo?: string | null;
          private_path?: string | null;
          processing_status?: string;
          public_key?: string | null;
          updated_at?: string;
          uploaded_by?: string;
          width?: number | null;
        };
        Update: {
          alt_text?: string | null;
          bytes?: number | null;
          caption?: string | null;
          created_at?: string;
          credit?: string | null;
          deleted_at?: string | null;
          height?: number | null;
          id?: string;
          mime_type?: string | null;
          people_in_photo?: string | null;
          private_path?: string | null;
          processing_status?: string;
          public_key?: string | null;
          updated_at?: string;
          uploaded_by?: string;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "media_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      media_consents: {
        Row: {
          consent_record_id: string;
          created_at: string;
          id: string;
          media_id: string;
        };
        Insert: {
          consent_record_id: string;
          created_at?: string;
          id?: string;
          media_id: string;
        };
        Update: {
          consent_record_id?: string;
          created_at?: string;
          id?: string;
          media_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "media_consents_consent_record_id_fkey";
            columns: ["consent_record_id"];
            isOneToOne: false;
            referencedRelation: "consent_records";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "media_consents_media_id_fkey";
            columns: ["media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
        ];
      };
      permissions: {
        Row: {
          description: string;
          key: string;
        };
        Insert: {
          description: string;
          key: string;
        };
        Update: {
          description?: string;
          key?: string;
        };
        Relationships: [];
      };
      places: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          id: string;
          is_active: boolean;
          kind: string;
          name: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          is_active?: boolean;
          kind: string;
          name: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          is_active?: boolean;
          kind?: string;
          name?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string | null;
          full_name: string;
          id: string;
          invited_by: string | null;
          is_active: boolean;
          role_id: number | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          full_name: string;
          id: string;
          invited_by?: string | null;
          is_active?: boolean;
          role_id?: number | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          full_name?: string;
          id?: string;
          invited_by?: string | null;
          is_active?: boolean;
          role_id?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
        ];
      };
      role_permissions: {
        Row: {
          permission_key: string;
          role_id: number;
        };
        Insert: {
          permission_key: string;
          role_id: number;
        };
        Update: {
          permission_key?: string;
          role_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey";
            columns: ["permission_key"];
            isOneToOne: false;
            referencedRelation: "permissions";
            referencedColumns: ["key"];
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
        ];
      };
      roles: {
        Row: {
          description: string;
          id: number;
          key: string;
          name: string;
        };
        Insert: {
          description: string;
          id?: never;
          key: string;
          name: string;
        };
        Update: {
          description?: string;
          id?: never;
          key?: string;
          name?: string;
        };
        Relationships: [];
      };
      tags: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          id: string;
          name: string;
          slug: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          name: string;
          slug: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      media_publish_status: {
        Args: { p_media_ids: string[] };
        Returns: {
          issues: string[];
          media_id: string;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
