import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * O Supabase e usado em partes pontuais do sistema (upload de logo, chatbot,
 * disparo de WhatsApp e a tela de verificacao). O login e todo o resto da
 * operacao falam com a API propria.
 *
 * Antes, faltar VITE_SUPABASE_URL derrubava o bundle inteiro na inicializacao
 * ("supabaseUrl is required") e nem a tela de login abria. Agora a ausencia da
 * configuracao so afeta quem realmente depende do Supabase: o cliente vira um
 * stub que recusa a chamada com uma mensagem clara, e o resto do sistema
 * continua funcionando normalmente.
 */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

const MENSAGEM =
  'Supabase nao configurado neste ambiente. Defina VITE_SUPABASE_URL e ' +
  'VITE_SUPABASE_PUBLISHABLE_KEY nas variaveis de ambiente do build.';

/** Recusa qualquer uso do Supabase sem quebrar a aplicacao. */
function criarStub(): any {
  if (typeof console !== 'undefined') {
    console.warn(`[supabase] ${MENSAGEM}`);
  }

  const recusar = () => Promise.reject(new Error(MENSAGEM));
  const encadeavel: any = new Proxy(
    {},
    {
      get(_alvo, prop) {
        // then/catch/finally fazem o objeto ser tratado como Promise.
        if (prop === 'then' || prop === 'catch' || prop === 'finally') return undefined;
        return () => encadeavel;
      },
    }
  );
  // Termina a cadeia devolvendo o erro, no formato que o codigo ja espera.
  encadeavel.then = (resolve: any) => resolve({ data: null, error: new Error(MENSAGEM) });

  return {
    from: () => encadeavel,
    storage: { from: () => ({ upload: recusar, getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
    functions: { invoke: recusar },
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: async () => ({ error: null }),
    },
  };
}

export const supabase = isSupabaseConfigured
  ? createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        storage: localStorage,
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : (criarStub() as ReturnType<typeof createClient<Database>>);
