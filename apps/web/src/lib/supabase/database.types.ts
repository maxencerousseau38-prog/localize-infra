/**
 * Generated from the live schema with the Supabase MCP (`generate_typescript_types`).
 *
 * Regenerate after every migration. Hand-editing it is how the types and the
 * database quietly disagree, and the type checker then defends the wrong shape.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          name: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          name: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      organization_members: {
        Row: {
          created_at: string;
          organization_id: string;
          role: Database['public']['Enums']['organization_role'];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          organization_id: string;
          role?: Database['public']['Enums']['organization_role'];
          user_id: string;
        };
        Update: {
          created_at?: string;
          organization_id?: string;
          role?: Database['public']['Enums']['organization_role'];
          user_id?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          organization_id: string;
          slug: string;
          source_locale: string;
          target_locales: string[];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          organization_id: string;
          slug: string;
          source_locale?: string;
          target_locales?: string[];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          organization_id?: string;
          slug?: string;
          source_locale?: string;
          target_locales?: string[];
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      create_organization: {
        Args: { p_name: string; p_slug: string };
        Returns: Database['public']['Tables']['organizations']['Row'];
      };
      is_org_member: { Args: { org: string }; Returns: boolean };
      org_role: {
        Args: { org: string };
        Returns: Database['public']['Enums']['organization_role'];
      };
    };
    Enums: {
      organization_role: 'owner' | 'admin' | 'member';
    };
    CompositeTypes: Record<never, never>;
  };
}

export type Organization = Database['public']['Tables']['organizations']['Row'];
export type Project = Database['public']['Tables']['projects']['Row'];
export type OrganizationRole = Database['public']['Enums']['organization_role'];
