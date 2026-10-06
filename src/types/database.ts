export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      activities: {
        Row: {
          body: Json | null;
          body_text: string | null;
          category_id: string | null;
          cover_media_id: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          ends_at: string | null;
          id: string;
          place_id: string | null;
          project_id: string | null;
          published_at: string | null;
          results: string | null;
          review_note: string | null;
          review_note_at: string | null;
          review_note_by: string | null;
          seo_description: string | null;
          seo_title: string | null;
          slug: string;
          starts_at: string;
          status: Database["public"]["Enums"]["content_status"];
          summary: string | null;
          title: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          body?: Json | null;
          body_text?: string | null;
          category_id?: string | null;
          cover_media_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          ends_at?: string | null;
          id?: string;
          place_id?: string | null;
          project_id?: string | null;
          published_at?: string | null;
          results?: string | null;
          review_note?: string | null;
          review_note_at?: string | null;
          review_note_by?: string | null;
          seo_description?: string | null;
          seo_title?: string | null;
          slug: string;
          starts_at: string;
          status?: Database["public"]["Enums"]["content_status"];
          summary?: string | null;
          title: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          body?: Json | null;
          body_text?: string | null;
          category_id?: string | null;
          cover_media_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          ends_at?: string | null;
          id?: string;
          place_id?: string | null;
          project_id?: string | null;
          published_at?: string | null;
          results?: string | null;
          review_note?: string | null;
          review_note_at?: string | null;
          review_note_by?: string | null;
          seo_description?: string | null;
          seo_title?: string | null;
          slug?: string;
          starts_at?: string;
          status?: Database["public"]["Enums"]["content_status"];
          summary?: string | null;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "activities_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activities_cover_media_id_fkey";
            columns: ["cover_media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activities_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activities_place_id_fkey";
            columns: ["place_id"];
            isOneToOne: false;
            referencedRelation: "places";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activities_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activities_review_note_by_fkey";
            columns: ["review_note_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activities_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      activity_media: {
        Row: {
          activity_id: string;
          caption: string | null;
          created_at: string;
          id: string;
          media_id: string;
          position: number;
        };
        Insert: {
          activity_id: string;
          caption?: string | null;
          created_at?: string;
          id?: string;
          media_id: string;
          position?: number;
        };
        Update: {
          activity_id?: string;
          caption?: string | null;
          created_at?: string;
          id?: string;
          media_id?: string;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: "activity_media_activity_id_fkey";
            columns: ["activity_id"];
            isOneToOne: false;
            referencedRelation: "activities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_media_media_id_fkey";
            columns: ["media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
        ];
      };
      activity_tags: {
        Row: {
          activity_id: string;
          id: string;
          tag_id: string;
        };
        Insert: {
          activity_id: string;
          id?: string;
          tag_id: string;
        };
        Update: {
          activity_id?: string;
          id?: string;
          tag_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activity_tags_activity_id_fkey";
            columns: ["activity_id"];
            isOneToOne: false;
            referencedRelation: "activities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
        ];
      };
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
          activity_id: string | null;
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
          activity_id?: string | null;
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
          activity_id?: string | null;
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
            foreignKeyName: "consent_records_activity_id_fkey";
            columns: ["activity_id"];
            isOneToOne: false;
            referencedRelation: "activities";
            referencedColumns: ["id"];
          },
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
      galleries: {
        Row: {
          activity_id: string | null;
          cover_media_id: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          description: string | null;
          id: string;
          project_id: string | null;
          published_at: string | null;
          review_note: string | null;
          review_note_at: string | null;
          review_note_by: string | null;
          seo_description: string | null;
          seo_title: string | null;
          slug: string;
          status: Database["public"]["Enums"]["content_status"];
          title: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          activity_id?: string | null;
          cover_media_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          project_id?: string | null;
          published_at?: string | null;
          review_note?: string | null;
          review_note_at?: string | null;
          review_note_by?: string | null;
          seo_description?: string | null;
          seo_title?: string | null;
          slug: string;
          status?: Database["public"]["Enums"]["content_status"];
          title: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          activity_id?: string | null;
          cover_media_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          project_id?: string | null;
          published_at?: string | null;
          review_note?: string | null;
          review_note_at?: string | null;
          review_note_by?: string | null;
          seo_description?: string | null;
          seo_title?: string | null;
          slug?: string;
          status?: Database["public"]["Enums"]["content_status"];
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "galleries_activity_id_fkey";
            columns: ["activity_id"];
            isOneToOne: false;
            referencedRelation: "activities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "galleries_cover_media_id_fkey";
            columns: ["cover_media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "galleries_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "galleries_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "galleries_review_note_by_fkey";
            columns: ["review_note_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "galleries_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      gallery_items: {
        Row: {
          caption: string | null;
          created_at: string;
          gallery_id: string;
          id: string;
          media_id: string;
          position: number;
        };
        Insert: {
          caption?: string | null;
          created_at?: string;
          gallery_id: string;
          id?: string;
          media_id: string;
          position?: number;
        };
        Update: {
          caption?: string | null;
          created_at?: string;
          gallery_id?: string;
          id?: string;
          media_id?: string;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: "gallery_items_gallery_id_fkey";
            columns: ["gallery_id"];
            isOneToOne: false;
            referencedRelation: "galleries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gallery_items_media_id_fkey";
            columns: ["media_id"];
            isOneToOne: false;
            referencedRelation: "media";
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
      page_versions: {
        Row: {
          body: Json | null;
          body_text: string | null;
          id: string;
          key: string;
          page_id: string;
          published_at: string;
          published_by: string | null;
          title: string;
          version: string;
        };
        Insert: {
          body?: Json | null;
          body_text?: string | null;
          id?: string;
          key: string;
          page_id: string;
          published_at?: string;
          published_by?: string | null;
          title: string;
          version: string;
        };
        Update: {
          body?: Json | null;
          body_text?: string | null;
          id?: string;
          key?: string;
          page_id?: string;
          published_at?: string;
          published_by?: string | null;
          title?: string;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: "page_versions_page_id_fkey";
            columns: ["page_id"];
            isOneToOne: false;
            referencedRelation: "pages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "page_versions_published_by_fkey";
            columns: ["published_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      pages: {
        Row: {
          body: Json | null;
          body_text: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          id: string;
          key: string;
          published_at: string | null;
          review_note: string | null;
          review_note_at: string | null;
          review_note_by: string | null;
          seo_description: string | null;
          seo_title: string | null;
          status: Database["public"]["Enums"]["content_status"];
          title: string;
          updated_at: string;
          updated_by: string | null;
          version: string | null;
        };
        Insert: {
          body?: Json | null;
          body_text?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          key: string;
          published_at?: string | null;
          review_note?: string | null;
          review_note_at?: string | null;
          review_note_by?: string | null;
          seo_description?: string | null;
          seo_title?: string | null;
          status?: Database["public"]["Enums"]["content_status"];
          title: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: string | null;
        };
        Update: {
          body?: Json | null;
          body_text?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          key?: string;
          published_at?: string | null;
          review_note?: string | null;
          review_note_at?: string | null;
          review_note_by?: string | null;
          seo_description?: string | null;
          seo_title?: string | null;
          status?: Database["public"]["Enums"]["content_status"];
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "pages_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pages_review_note_by_fkey";
            columns: ["review_note_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pages_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
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
      posts: {
        Row: {
          body: Json | null;
          body_text: string | null;
          byline: string | null;
          category_id: string | null;
          cover_media_id: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          excerpt: string | null;
          id: string;
          published_at: string | null;
          review_note: string | null;
          review_note_at: string | null;
          review_note_by: string | null;
          seo_description: string | null;
          seo_title: string | null;
          slug: string;
          status: Database["public"]["Enums"]["content_status"];
          title: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          body?: Json | null;
          body_text?: string | null;
          byline?: string | null;
          category_id?: string | null;
          cover_media_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          excerpt?: string | null;
          id?: string;
          published_at?: string | null;
          review_note?: string | null;
          review_note_at?: string | null;
          review_note_by?: string | null;
          seo_description?: string | null;
          seo_title?: string | null;
          slug: string;
          status?: Database["public"]["Enums"]["content_status"];
          title: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          body?: Json | null;
          body_text?: string | null;
          byline?: string | null;
          category_id?: string | null;
          cover_media_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          excerpt?: string | null;
          id?: string;
          published_at?: string | null;
          review_note?: string | null;
          review_note_at?: string | null;
          review_note_by?: string | null;
          seo_description?: string | null;
          seo_title?: string | null;
          slug?: string;
          status?: Database["public"]["Enums"]["content_status"];
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "posts_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "posts_cover_media_id_fkey";
            columns: ["cover_media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "posts_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "posts_review_note_by_fkey";
            columns: ["review_note_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "posts_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
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
      projects: {
        Row: {
          body: Json | null;
          body_text: string | null;
          cover_media_id: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          end_date: string | null;
          id: string;
          objective: string | null;
          project_status: string;
          published_at: string | null;
          review_note: string | null;
          review_note_at: string | null;
          review_note_by: string | null;
          seo_description: string | null;
          seo_title: string | null;
          slug: string;
          start_date: string | null;
          status: Database["public"]["Enums"]["content_status"];
          summary: string | null;
          title: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          body?: Json | null;
          body_text?: string | null;
          cover_media_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          end_date?: string | null;
          id?: string;
          objective?: string | null;
          project_status?: string;
          published_at?: string | null;
          review_note?: string | null;
          review_note_at?: string | null;
          review_note_by?: string | null;
          seo_description?: string | null;
          seo_title?: string | null;
          slug: string;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["content_status"];
          summary?: string | null;
          title: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          body?: Json | null;
          body_text?: string | null;
          cover_media_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          end_date?: string | null;
          id?: string;
          objective?: string | null;
          project_status?: string;
          published_at?: string | null;
          review_note?: string | null;
          review_note_at?: string | null;
          review_note_by?: string | null;
          seo_description?: string | null;
          seo_title?: string | null;
          slug?: string;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["content_status"];
          summary?: string | null;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "projects_cover_media_id_fkey";
            columns: ["cover_media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_review_note_by_fkey";
            columns: ["review_note_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
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
      team_members: {
        Row: {
          bio: string | null;
          consent_record_id: string | null;
          consent_valid_until: string | null;
          consent_withdrawn: boolean;
          cover_media_id: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          full_name: string;
          id: string;
          position: number;
          published_at: string | null;
          review_note: string | null;
          review_note_at: string | null;
          review_note_by: string | null;
          role_title: string;
          status: Database["public"]["Enums"]["content_status"];
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          bio?: string | null;
          consent_record_id?: string | null;
          consent_valid_until?: string | null;
          consent_withdrawn?: boolean;
          cover_media_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          full_name: string;
          id?: string;
          position?: number;
          published_at?: string | null;
          review_note?: string | null;
          review_note_at?: string | null;
          review_note_by?: string | null;
          role_title: string;
          status?: Database["public"]["Enums"]["content_status"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          bio?: string | null;
          consent_record_id?: string | null;
          consent_valid_until?: string | null;
          consent_withdrawn?: boolean;
          cover_media_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          full_name?: string;
          id?: string;
          position?: number;
          published_at?: string | null;
          review_note?: string | null;
          review_note_at?: string | null;
          review_note_by?: string | null;
          role_title?: string;
          status?: Database["public"]["Enums"]["content_status"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "team_members_consent_record_id_fkey";
            columns: ["consent_record_id"];
            isOneToOne: false;
            referencedRelation: "consent_records";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_members_cover_media_id_fkey";
            columns: ["cover_media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_members_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_members_review_note_by_fkey";
            columns: ["review_note_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_members_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      testimonials: {
        Row: {
          activity_id: string | null;
          author_context: string | null;
          author_display_name: string;
          consent_record_id: string;
          consent_valid_until: string | null;
          consent_withdrawn: boolean;
          cover_media_id: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          id: string;
          project_id: string | null;
          published_at: string | null;
          quote: string;
          review_note: string | null;
          review_note_at: string | null;
          review_note_by: string | null;
          status: Database["public"]["Enums"]["content_status"];
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          activity_id?: string | null;
          author_context?: string | null;
          author_display_name: string;
          consent_record_id: string;
          consent_valid_until?: string | null;
          consent_withdrawn?: boolean;
          cover_media_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          project_id?: string | null;
          published_at?: string | null;
          quote: string;
          review_note?: string | null;
          review_note_at?: string | null;
          review_note_by?: string | null;
          status?: Database["public"]["Enums"]["content_status"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          activity_id?: string | null;
          author_context?: string | null;
          author_display_name?: string;
          consent_record_id?: string;
          consent_valid_until?: string | null;
          consent_withdrawn?: boolean;
          cover_media_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          project_id?: string | null;
          published_at?: string | null;
          quote?: string;
          review_note?: string | null;
          review_note_at?: string | null;
          review_note_by?: string | null;
          status?: Database["public"]["Enums"]["content_status"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "testimonials_activity_id_fkey";
            columns: ["activity_id"];
            isOneToOne: false;
            referencedRelation: "activities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "testimonials_consent_record_id_fkey";
            columns: ["consent_record_id"];
            isOneToOne: false;
            referencedRelation: "consent_records";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "testimonials_cover_media_id_fkey";
            columns: ["cover_media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "testimonials_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "testimonials_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "testimonials_review_note_by_fkey";
            columns: ["review_note_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "testimonials_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      videos: {
        Row: {
          activity_id: string | null;
          cover_media_id: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          description: string | null;
          id: string;
          project_id: string | null;
          provider: string;
          provider_video_id: string;
          published_at: string | null;
          review_note: string | null;
          review_note_at: string | null;
          review_note_by: string | null;
          status: Database["public"]["Enums"]["content_status"];
          title: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          activity_id?: string | null;
          cover_media_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          project_id?: string | null;
          provider: string;
          provider_video_id: string;
          published_at?: string | null;
          review_note?: string | null;
          review_note_at?: string | null;
          review_note_by?: string | null;
          status?: Database["public"]["Enums"]["content_status"];
          title: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          activity_id?: string | null;
          cover_media_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          project_id?: string | null;
          provider?: string;
          provider_video_id?: string;
          published_at?: string | null;
          review_note?: string | null;
          review_note_at?: string | null;
          review_note_by?: string | null;
          status?: Database["public"]["Enums"]["content_status"];
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "videos_activity_id_fkey";
            columns: ["activity_id"];
            isOneToOne: false;
            referencedRelation: "activities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "videos_cover_media_id_fkey";
            columns: ["cover_media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "videos_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "videos_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "videos_review_note_by_fkey";
            columns: ["review_note_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "videos_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      content_media_usages: {
        Row: {
          entity_id: string | null;
          entity_type: string | null;
          media_id: string | null;
          usage: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      media_public_targets: {
        Args: { p_media_ids?: string[] };
        Returns: {
          media_id: string;
          public_key: string;
          should_be_public: boolean;
        }[];
      };
      media_publish_status: {
        Args: { p_media_ids: string[] };
        Returns: {
          issues: string[];
          media_id: string;
        }[];
      };
    };
    Enums: {
      content_status: "draft" | "review" | "published" | "archived";
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
    Enums: {
      content_status: ["draft", "review", "published", "archived"],
    },
  },
} as const;
