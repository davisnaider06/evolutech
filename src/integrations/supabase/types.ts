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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          description: string
          due_date: string
          id: string
          notes: string | null
          payment_date: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description: string
          due_date: string
          id?: string
          notes?: string | null
          payment_date?: string | null
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string
          due_date?: string
          id?: string
          notes?: string | null
          payment_date?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          assigned_to: string | null
          company_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          duration_minutes: number | null
          id: string
          notes: string | null
          price: number | null
          scheduled_at: string
          service_name: string
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          price?: number | null
          scheduled_at: string
          service_name: string
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          price?: number | null
          scheduled_at?: string
          service_name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          company_id: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          company_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          company_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_transactions: {
        Row: {
          amount: number
          category: string | null
          company_id: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          payment_method: string | null
          reference_id: string | null
          reference_type: string | null
          transaction_date: string
          type: string
        }
        Insert: {
          amount: number
          category?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          payment_method?: string | null
          reference_id?: string | null
          reference_type?: string | null
          transaction_date?: string
          type: string
        }
        Update: {
          amount?: number
          category?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          payment_method?: string | null
          reference_id?: string | null
          reference_type?: string | null
          transaction_date?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_conversations: {
        Row: {
          chatbot_id: string
          created_at: string
          id: string
          session_id: string
          updated_at: string
          visitor_email: string | null
          visitor_name: string | null
        }
        Insert: {
          chatbot_id: string
          created_at?: string
          id?: string
          session_id: string
          updated_at?: string
          visitor_email?: string | null
          visitor_name?: string | null
        }
        Update: {
          chatbot_id?: string
          created_at?: string
          id?: string
          session_id?: string
          updated_at?: string
          visitor_email?: string | null
          visitor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_conversations_chatbot_id_fkey"
            columns: ["chatbot_id"]
            isOneToOne: false
            referencedRelation: "company_chatbots"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chatbot_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          monthly_revenue: number | null
          name: string
          niche: string | null
          plan: Database["public"]["Enums"]["plan_type"]
          settings: Json | null
          sistema_base_id: string | null
          slug: string
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          monthly_revenue?: number | null
          name: string
          niche?: string | null
          plan?: Database["public"]["Enums"]["plan_type"]
          settings?: Json | null
          sistema_base_id?: string | null
          slug: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          monthly_revenue?: number | null
          name?: string
          niche?: string | null
          plan?: Database["public"]["Enums"]["plan_type"]
          settings?: Json | null
          sistema_base_id?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_sistema_base_id_fkey"
            columns: ["sistema_base_id"]
            isOneToOne: false
            referencedRelation: "sistemas_base"
            referencedColumns: ["id"]
          },
        ]
      }
      company_chatbots: {
        Row: {
          chatbot_type: string
          company_id: string
          created_at: string
          external_api_key: string | null
          external_webhook_url: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          primary_color: string | null
          slug: string | null
          system_prompt: string | null
          updated_at: string
          welcome_message: string | null
        }
        Insert: {
          chatbot_type?: string
          company_id: string
          created_at?: string
          external_api_key?: string | null
          external_webhook_url?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          slug?: string | null
          system_prompt?: string | null
          updated_at?: string
          welcome_message?: string | null
        }
        Update: {
          chatbot_type?: string
          company_id?: string
          created_at?: string
          external_api_key?: string | null
          external_webhook_url?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          slug?: string | null
          system_prompt?: string | null
          updated_at?: string
          welcome_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_chatbots_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_themes: {
        Row: {
          accent_color: string | null
          accent_foreground: string | null
          background_color: string | null
          border_color: string | null
          border_radius: string | null
          card_color: string | null
          card_foreground: string | null
          company_display_name: string | null
          company_id: string
          created_at: string
          dark_mode_enabled: boolean | null
          destructive_color: string | null
          favicon_path: string | null
          font_family: string | null
          foreground_color: string | null
          id: string
          login_cover_path: string | null
          logo_path: string | null
          muted_color: string | null
          muted_foreground: string | null
          primary_color: string | null
          primary_foreground: string | null
          secondary_color: string | null
          secondary_foreground: string | null
          sidebar_accent: string | null
          sidebar_background: string | null
          sidebar_foreground: string | null
          sidebar_primary: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          accent_foreground?: string | null
          background_color?: string | null
          border_color?: string | null
          border_radius?: string | null
          card_color?: string | null
          card_foreground?: string | null
          company_display_name?: string | null
          company_id: string
          created_at?: string
          dark_mode_enabled?: boolean | null
          destructive_color?: string | null
          favicon_path?: string | null
          font_family?: string | null
          foreground_color?: string | null
          id?: string
          login_cover_path?: string | null
          logo_path?: string | null
          muted_color?: string | null
          muted_foreground?: string | null
          primary_color?: string | null
          primary_foreground?: string | null
          secondary_color?: string | null
          secondary_foreground?: string | null
          sidebar_accent?: string | null
          sidebar_background?: string | null
          sidebar_foreground?: string | null
          sidebar_primary?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          accent_foreground?: string | null
          background_color?: string | null
          border_color?: string | null
          border_radius?: string | null
          card_color?: string | null
          card_foreground?: string | null
          company_display_name?: string | null
          company_id?: string
          created_at?: string
          dark_mode_enabled?: boolean | null
          destructive_color?: string | null
          favicon_path?: string | null
          font_family?: string | null
          foreground_color?: string | null
          id?: string
          login_cover_path?: string | null
          logo_path?: string | null
          muted_color?: string | null
          muted_foreground?: string | null
          primary_color?: string | null
          primary_foreground?: string | null
          secondary_color?: string | null
          secondary_foreground?: string | null
          sidebar_accent?: string | null
          sidebar_background?: string | null
          sidebar_foreground?: string | null
          sidebar_primary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_themes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          city: string | null
          company_id: string
          created_at: string
          document: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          state: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_id: string
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company_id?: string
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_modulos: {
        Row: {
          ativo: boolean | null
          created_at: string
          data_ativacao: string | null
          data_desativacao: string | null
          empresa_id: string
          id: string
          modulo_id: string
          obrigatorio: boolean | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          data_ativacao?: string | null
          data_desativacao?: string | null
          empresa_id: string
          id?: string
          modulo_id: string
          obrigatorio?: boolean | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          data_ativacao?: string | null
          data_desativacao?: string | null
          empresa_id?: string
          id?: string
          modulo_id?: string
          obrigatorio?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresa_modulos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresa_modulos_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "modulos"
            referencedColumns: ["id"]
          },
        ]
      }
      evolucoes: {
        Row: {
          created_at: string
          data_conclusao: string | null
          data_inicio: string | null
          descricao: string
          desenvolvedor_responsavel: string | null
          empresa_id: string | null
          id: string
          prioridade: string | null
          sistema_base_id: string | null
          solicitado_por: string | null
          status: string | null
          tipo: string | null
          titulo: string
          updated_at: string
          versao_alvo: string | null
        }
        Insert: {
          created_at?: string
          data_conclusao?: string | null
          data_inicio?: string | null
          descricao: string
          desenvolvedor_responsavel?: string | null
          empresa_id?: string | null
          id?: string
          prioridade?: string | null
          sistema_base_id?: string | null
          solicitado_por?: string | null
          status?: string | null
          tipo?: string | null
          titulo: string
          updated_at?: string
          versao_alvo?: string | null
        }
        Update: {
          created_at?: string
          data_conclusao?: string | null
          data_inicio?: string | null
          descricao?: string
          desenvolvedor_responsavel?: string | null
          empresa_id?: string | null
          id?: string
          prioridade?: string | null
          sistema_base_id?: string | null
          solicitado_por?: string | null
          status?: string | null
          tipo?: string | null
          titulo?: string
          updated_at?: string
          versao_alvo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evolucoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolucoes_sistema_base_id_fkey"
            columns: ["sistema_base_id"]
            isOneToOne: false
            referencedRelation: "sistemas_base"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_metrics: {
        Row: {
          active_users: number | null
          churn_rate: number | null
          company_id: string | null
          created_at: string
          id: string
          month: string
          mrr: number | null
          new_customers: number | null
          revenue: number | null
        }
        Insert: {
          active_users?: number | null
          churn_rate?: number | null
          company_id?: string | null
          created_at?: string
          id?: string
          month: string
          mrr?: number | null
          new_customers?: number | null
          revenue?: number | null
        }
        Update: {
          active_users?: number | null
          churn_rate?: number | null
          company_id?: string | null
          created_at?: string
          id?: string
          month?: string
          mrr?: number | null
          new_customers?: number | null
          revenue?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_metrics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          company_id: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["entity_status"]
          token: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["entity_status"]
          token?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["entity_status"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      modulos: {
        Row: {
          codigo: string
          created_at: string
          descricao: string | null
          icone: string | null
          id: string
          is_core: boolean | null
          nome: string
          preco_mensal: number | null
          status: Database["public"]["Enums"]["entity_status"] | null
          updated_at: string
        }
        Insert: {
          codigo: string
          created_at?: string
          descricao?: string | null
          icone?: string | null
          id?: string
          is_core?: boolean | null
          nome: string
          preco_mensal?: number | null
          status?: Database["public"]["Enums"]["entity_status"] | null
          updated_at?: string
        }
        Update: {
          codigo?: string
          created_at?: string
          descricao?: string | null
          icone?: string | null
          id?: string
          is_core?: boolean | null
          nome?: string
          preco_mensal?: number | null
          status?: Database["public"]["Enums"]["entity_status"] | null
          updated_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          notes: string | null
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          total: number
          unit_price: number
        }
        Insert: {
          id?: string
          notes?: string | null
          order_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
          total?: number
          unit_price?: number
        }
        Update: {
          id?: string
          notes?: string | null
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string | null
          discount: number | null
          id: string
          notes: string | null
          order_number: number
          payment_method: string | null
          payment_status: string | null
          status: string
          subtotal: number | null
          total: number | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          discount?: number | null
          id?: string
          notes?: string | null
          order_number?: number
          payment_method?: string | null
          payment_status?: string | null
          status?: string
          subtotal?: number | null
          total?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          discount?: number | null
          id?: string
          notes?: string | null
          order_number?: number
          payment_method?: string | null
          payment_status?: string | null
          status?: string
          subtotal?: number | null
          total?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_gateways: {
        Row: {
          ambiente: string
          configuracoes: Json | null
          created_at: string
          empresa_id: string
          id: string
          is_active: boolean
          nome_exibicao: string
          provedor: string
          public_key: string | null
          secret_key_encrypted: string | null
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          ambiente?: string
          configuracoes?: Json | null
          created_at?: string
          empresa_id: string
          id?: string
          is_active?: boolean
          nome_exibicao: string
          provedor: string
          public_key?: string | null
          secret_key_encrypted?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          ambiente?: string
          configuracoes?: Json | null
          created_at?: string
          empresa_id?: string
          id?: string
          is_active?: boolean
          nome_exibicao?: string
          provedor?: string
          public_key?: string | null
          secret_key_encrypted?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_gateways_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          category_id: string | null
          company_id: string
          cost_price: number | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          min_stock: number | null
          name: string
          sale_price: number
          sku: string | null
          stock_quantity: number | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          category_id?: string | null
          company_id: string
          cost_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          min_stock?: number | null
          name: string
          sale_price?: number
          sku?: string | null
          stock_quantity?: number | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          category_id?: string | null
          company_id?: string
          cost_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          min_stock?: number | null
          name?: string
          sale_price?: number
          sku?: string | null
          stock_quantity?: number | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      sistema_base_modulos: {
        Row: {
          created_at: string
          id: string
          is_default: boolean | null
          modulo_id: string
          sistema_base_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          modulo_id: string
          sistema_base_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          modulo_id?: string
          sistema_base_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sistema_base_modulos_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "modulos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sistema_base_modulos_sistema_base_id_fkey"
            columns: ["sistema_base_id"]
            isOneToOne: false
            referencedRelation: "sistemas_base"
            referencedColumns: ["id"]
          },
        ]
      }
      sistemas_base: {
        Row: {
          configuracoes: Json | null
          created_at: string
          default_modules: Json | null
          descricao: string | null
          id: string
          nicho: string
          nome: string
          porte: string | null
          status: Database["public"]["Enums"]["entity_status"] | null
          updated_at: string
          versao: string | null
        }
        Insert: {
          configuracoes?: Json | null
          created_at?: string
          default_modules?: Json | null
          descricao?: string | null
          id?: string
          nicho: string
          nome: string
          porte?: string | null
          status?: Database["public"]["Enums"]["entity_status"] | null
          updated_at?: string
          versao?: string | null
        }
        Update: {
          configuracoes?: Json | null
          created_at?: string
          default_modules?: Json | null
          descricao?: string | null
          id?: string
          nicho?: string
          nome?: string
          porte?: string | null
          status?: Database["public"]["Enums"]["entity_status"] | null
          updated_at?: string
          versao?: string | null
        }
        Relationships: []
      }
      sistemas_clientes: {
        Row: {
          configuracoes: Json | null
          created_at: string
          data_ativacao: string | null
          empresa_id: string
          id: string
          nome_customizado: string | null
          sistema_base_id: string
          status: Database["public"]["Enums"]["entity_status"] | null
          updated_at: string
        }
        Insert: {
          configuracoes?: Json | null
          created_at?: string
          data_ativacao?: string | null
          empresa_id: string
          id?: string
          nome_customizado?: string | null
          sistema_base_id: string
          status?: Database["public"]["Enums"]["entity_status"] | null
          updated_at?: string
        }
        Update: {
          configuracoes?: Json | null
          created_at?: string
          data_ativacao?: string | null
          empresa_id?: string
          id?: string
          nome_customizado?: string | null
          sistema_base_id?: string
          status?: Database["public"]["Enums"]["entity_status"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sistemas_clientes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sistemas_clientes_sistema_base_id_fkey"
            columns: ["sistema_base_id"]
            isOneToOne: false
            referencedRelation: "sistemas_base"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          product_id: string
          quantity: number
          reference_id: string | null
          reference_type: string | null
          type: string
          unit_cost: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          product_id: string
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          type: string
          unit_cost?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          type?: string
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets_suporte: {
        Row: {
          atribuido_para: string | null
          categoria: string | null
          created_at: string
          data_resolucao: string | null
          descricao: string
          empresa_id: string
          id: string
          prioridade: string | null
          resposta: string | null
          status: string | null
          titulo: string
          updated_at: string
          usuario_id: string
        }
        Insert: {
          atribuido_para?: string | null
          categoria?: string | null
          created_at?: string
          data_resolucao?: string | null
          descricao: string
          empresa_id: string
          id?: string
          prioridade?: string | null
          resposta?: string | null
          status?: string | null
          titulo: string
          updated_at?: string
          usuario_id: string
        }
        Update: {
          atribuido_para?: string | null
          categoria?: string | null
          created_at?: string
          data_resolucao?: string | null
          descricao?: string
          empresa_id?: string
          id?: string
          prioridade?: string | null
          resposta?: string | null
          status?: string | null
          titulo?: string
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_suporte_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      treinamento_progresso: {
        Row: {
          concluido: boolean | null
          created_at: string
          data_conclusao: string | null
          data_inicio: string | null
          empresa_id: string
          id: string
          progresso_percentual: number | null
          treinamento_id: string
          updated_at: string
          usuario_id: string
        }
        Insert: {
          concluido?: boolean | null
          created_at?: string
          data_conclusao?: string | null
          data_inicio?: string | null
          empresa_id: string
          id?: string
          progresso_percentual?: number | null
          treinamento_id: string
          updated_at?: string
          usuario_id: string
        }
        Update: {
          concluido?: boolean | null
          created_at?: string
          data_conclusao?: string | null
          data_inicio?: string | null
          empresa_id?: string
          id?: string
          progresso_percentual?: number | null
          treinamento_id?: string
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "treinamento_progresso_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treinamento_progresso_treinamento_id_fkey"
            columns: ["treinamento_id"]
            isOneToOne: false
            referencedRelation: "treinamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      treinamentos: {
        Row: {
          created_at: string
          descricao: string | null
          duracao_minutos: number | null
          empresa_id: string | null
          id: string
          is_publico: boolean | null
          modulo_id: string | null
          ordem: number | null
          status: Database["public"]["Enums"]["entity_status"] | null
          tipo: string | null
          titulo: string
          updated_at: string
          url_conteudo: string | null
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          duracao_minutos?: number | null
          empresa_id?: string | null
          id?: string
          is_publico?: boolean | null
          modulo_id?: string | null
          ordem?: number | null
          status?: Database["public"]["Enums"]["entity_status"] | null
          tipo?: string | null
          titulo: string
          updated_at?: string
          url_conteudo?: string | null
        }
        Update: {
          created_at?: string
          descricao?: string | null
          duracao_minutos?: number | null
          empresa_id?: string | null
          id?: string
          is_publico?: boolean | null
          modulo_id?: string | null
          ordem?: number | null
          status?: Database["public"]["Enums"]["entity_status"] | null
          tipo?: string | null
          titulo?: string
          updated_at?: string
          url_conteudo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treinamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treinamentos_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "modulos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_automation_config: {
        Row: {
          ativado_por: string | null
          created_at: string
          data_ativacao: string | null
          empresa_id: string
          eventos_disponiveis: Json | null
          id: string
          is_enabled: boolean
          motivo_desativacao: string | null
          payload_padrao: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          ativado_por?: string | null
          created_at?: string
          data_ativacao?: string | null
          empresa_id: string
          eventos_disponiveis?: Json | null
          id?: string
          is_enabled?: boolean
          motivo_desativacao?: string | null
          payload_padrao?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          ativado_por?: string | null
          created_at?: string
          data_ativacao?: string | null
          empresa_id?: string
          eventos_disponiveis?: Json | null
          id?: string
          is_enabled?: boolean
          motivo_desativacao?: string | null
          payload_padrao?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_automation_config_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_config: {
        Row: {
          auth_token: string | null
          created_at: string
          empresa_id: string
          id: string
          is_active: boolean | null
          max_retries: number | null
          timeout_ms: number | null
          updated_at: string
          webhook_url: string
        }
        Insert: {
          auth_token?: string | null
          created_at?: string
          empresa_id: string
          id?: string
          is_active?: boolean | null
          max_retries?: number | null
          timeout_ms?: number | null
          updated_at?: string
          webhook_url: string
        }
        Update: {
          auth_token?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          is_active?: boolean | null
          max_retries?: number | null
          timeout_ms?: number | null
          updated_at?: string
          webhook_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_config_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_dispatch: {
        Row: {
          created_at: string
          data_disparo: string | null
          empresa_id: string
          erro_mensagem: string | null
          evento: string
          id: string
          payload_enviado: Json
          resposta_webhook: Json | null
          status: string
          telefone: string
          tentativas: number | null
          updated_at: string
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          data_disparo?: string | null
          empresa_id: string
          erro_mensagem?: string | null
          evento: string
          id?: string
          payload_enviado?: Json
          resposta_webhook?: Json | null
          status?: string
          telefone: string
          tentativas?: number | null
          updated_at?: string
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          data_disparo?: string | null
          empresa_id?: string
          erro_mensagem?: string | null
          evento?: string
          id?: string
          payload_enviado?: Json
          resposta_webhook?: Json | null
          status?: string
          telefone?: string
          tentativas?: number | null
          updated_at?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_dispatch_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_company: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      get_payment_gateways_for_user: {
        Args: never
        Returns: {
          ambiente: string
          configuracoes: Json | null
          created_at: string
          empresa_id: string
          id: string
          is_active: boolean
          nome_exibicao: string
          provedor: string
          public_key: string | null
          secret_key_encrypted: string | null
          updated_at: string
          webhook_url: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "payment_gateways"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_company_owner: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_evolutech_user: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "super_admin_evolutech"
        | "admin_evolutech"
        | "dono_empresa"
        | "funcionario_empresa"
      audit_action:
        | "create"
        | "update"
        | "delete"
        | "login"
        | "logout"
        | "activate"
        | "deactivate"
        | "invite"
        | "role_change"
      entity_status: "active" | "inactive" | "pending"
      plan_type: "starter" | "professional" | "enterprise"
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
      app_role: [
        "super_admin_evolutech",
        "admin_evolutech",
        "dono_empresa",
        "funcionario_empresa",
      ],
      audit_action: [
        "create",
        "update",
        "delete",
        "login",
        "logout",
        "activate",
        "deactivate",
        "invite",
        "role_change",
      ],
      entity_status: ["active", "inactive", "pending"],
      plan_type: ["starter", "professional", "enterprise"],
    },
  },
} as const
