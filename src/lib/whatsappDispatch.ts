/**
 * WhatsApp Dispatch Service
 * 
 * ATENÇÃO: Este módulo é um ORQUESTRADOR DE EVENTOS.
 * NÃO contém lógica de envio de WhatsApp.
 * 
 * O sistema prepara os dados e dispara para o endpoint configurado,
 * onde a automação da Evolutech processa externamente.
 */

import { supabase } from "@/integrations/supabase/client";

export type WhatsAppEvento = 
  | "agendamento" 
  | "confirmacao" 
  | "cancelamento" 
  | "lembrete" 
  | "boas_vindas"
  | "notificacao";

interface DispatchOptions {
  empresa_id: string;
  telefone: string;
  evento: WhatsAppEvento;
  mensagem?: string;
  dados_extras?: Record<string, unknown>;
}

interface DispatchResult {
  success: boolean;
  dispatch_id?: string;
  status: string;
  message: string;
}

/**
 * Dispara um evento para o sistema de automação de WhatsApp
 * 
 * Este método:
 * 1. Envia os dados para a edge function
 * 2. A edge function registra no banco e dispara para o webhook externo
 * 3. O webhook externo (n8n/automação Evolutech) processa o envio real
 * 
 * @param options Dados do evento a ser disparado
 * @returns Resultado do dispatch (não do envio final)
 */
export async function dispatchWhatsAppEvent(options: DispatchOptions): Promise<DispatchResult> {
  try {
    const { data, error } = await supabase.functions.invoke("whatsapp-dispatch", {
      body: {
        empresa_id: options.empresa_id,
        telefone: options.telefone,
        evento: options.evento,
        mensagem: options.mensagem,
        dados_extras: options.dados_extras,
      },
    });

    if (error) {
      console.error("Erro ao disparar evento WhatsApp:", error);
      return {
        success: false,
        status: "erro",
        message: error.message || "Erro ao conectar com serviço de dispatch",
      };
    }

    return data as DispatchResult;
  } catch (error) {
    console.error("Erro no dispatchWhatsAppEvent:", error);
    return {
      success: false,
      status: "erro",
      message: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

/**
 * Formata número de telefone para padrão brasileiro
 */
export function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  
  // Se não tem código do país, adiciona 55 (Brasil)
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  
  return digits;
}

/**
 * Helpers para eventos específicos
 */
export const WhatsAppEvents = {
  /**
   * Dispara notificação de novo agendamento
   */
  async agendamento(
    empresa_id: string, 
    telefone: string, 
    dados: { 
      cliente_nome: string; 
      data_hora: string; 
      servico?: string;
      profissional?: string;
    }
  ): Promise<DispatchResult> {
    return dispatchWhatsAppEvent({
      empresa_id,
      telefone: formatPhoneNumber(telefone),
      evento: "agendamento",
      mensagem: `Novo agendamento para ${dados.cliente_nome} em ${dados.data_hora}`,
      dados_extras: dados,
    });
  },

  /**
   * Dispara confirmação de agendamento
   */
  async confirmacao(
    empresa_id: string, 
    telefone: string, 
    dados: { 
      cliente_nome: string; 
      data_hora: string;
      agendamento_id?: string;
    }
  ): Promise<DispatchResult> {
    return dispatchWhatsAppEvent({
      empresa_id,
      telefone: formatPhoneNumber(telefone),
      evento: "confirmacao",
      mensagem: `Agendamento confirmado para ${dados.cliente_nome} em ${dados.data_hora}`,
      dados_extras: dados,
    });
  },

  /**
   * Dispara cancelamento de agendamento
   */
  async cancelamento(
    empresa_id: string, 
    telefone: string, 
    dados: { 
      cliente_nome: string; 
      motivo?: string;
      agendamento_id?: string;
    }
  ): Promise<DispatchResult> {
    return dispatchWhatsAppEvent({
      empresa_id,
      telefone: formatPhoneNumber(telefone),
      evento: "cancelamento",
      mensagem: `Agendamento cancelado: ${dados.cliente_nome}`,
      dados_extras: dados,
    });
  },

  /**
   * Dispara lembrete de agendamento
   */
  async lembrete(
    empresa_id: string, 
    telefone: string, 
    dados: { 
      cliente_nome: string; 
      data_hora: string;
      tempo_restante?: string;
    }
  ): Promise<DispatchResult> {
    return dispatchWhatsAppEvent({
      empresa_id,
      telefone: formatPhoneNumber(telefone),
      evento: "lembrete",
      mensagem: `Lembrete: agendamento de ${dados.cliente_nome} em ${dados.data_hora}`,
      dados_extras: dados,
    });
  },

  /**
   * Dispara mensagem de boas-vindas
   */
  async boasVindas(
    empresa_id: string, 
    telefone: string, 
    dados: { 
      cliente_nome: string;
    }
  ): Promise<DispatchResult> {
    return dispatchWhatsAppEvent({
      empresa_id,
      telefone: formatPhoneNumber(telefone),
      evento: "boas_vindas",
      mensagem: `Bem-vindo(a), ${dados.cliente_nome}!`,
      dados_extras: dados,
    });
  },
};
