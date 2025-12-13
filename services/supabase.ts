
import { createClient } from '@supabase/supabase-js';

// Récupération sécurisée des variables d'environnement
const env = (import.meta as any).env || {};

// Clés fournies par l'utilisateur (Fallback si le .env échoue)
const FALLBACK_URL = "https://fbukrfcmjtedagcjuwgk.supabase.co";
const FALLBACK_KEY = "sb_publishable_e7axY_rsM9uYi8LBYswXPA_UtQizWih";

// On récupère l'URL (Env > Fallback)
const SUPABASE_URL = env.VITE_SUPABASE_URL || FALLBACK_URL;

// On récupère la clé (Env > Fallback)
const SUPABASE_KEY = env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || env.VITE_SUPABASE_ANON_KEY || FALLBACK_KEY;

let supabaseInstance;

try {
    if (SUPABASE_URL && SUPABASE_KEY) {
      // Configuration normale
      supabaseInstance = createClient(SUPABASE_URL, SUPABASE_KEY);
    } else {
      throw new Error("Clés Supabase manquantes");
    }
} catch (error) {
  console.error("Erreur critique initialisation Supabase:", error);
  
  // Client factice pour ne pas bloquer l'interface avec un écran blanc
  supabaseInstance = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithOtp: async () => ({ error: { message: "Supabase non configuré (Erreur init)" } }),
      verifyOtp: async () => ({ error: { message: "Supabase non configuré" } }),
      signOut: async () => {},
    }
  } as any;
}

export const supabase = supabaseInstance;
