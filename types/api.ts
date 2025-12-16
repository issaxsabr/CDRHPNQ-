/**
 * Types pour les réponses API externes (Serper, Gemini)
 * Ces types permettent un typage strict des données reçues
 */

// ===========================================
// SERPER API TYPES
// ===========================================

/**
 * Résultat d'un lieu Google Maps
 */
export interface SerperPlace {
  title: string;
  address?: string;
  phoneNumber?: string;
  phone?: string;
  website?: string;
  type?: string;
  category?: string;
  cid?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  ratingCount?: number;
  priceLevel?: string;
  openingHours?: Record<string, string>;
}

/**
 * Résultat de recherche organique
 */
export interface SerperOrganicResult {
  title: string;
  link: string;
  snippet: string;
  position?: number;
  date?: string;
  sitelinks?: Array<{
    title: string;
    link: string;
  }>;
}

/**
 * Knowledge Graph de Google
 */
export interface SerperKnowledgeGraph {
  title: string;
  type?: string;
  website?: string;
  description?: string;
  imageUrl?: string;
  attributes?: Record<string, string>;
}

/**
 * Réponse complète de l'API Serper (Maps)
 */
export interface SerperMapsResponse {
  searchParameters?: {
    q: string;
    gl: string;
    hl: string;
    location?: string;
  };
  places?: SerperPlace[];
  knowledgeGraph?: SerperKnowledgeGraph;
}

/**
 * Réponse complète de l'API Serper (Search)
 */
export interface SerperSearchResponse {
  searchParameters?: {
    q: string;
    gl: string;
    hl: string;
  };
  organic?: SerperOrganicResult[];
  knowledgeGraph?: SerperKnowledgeGraph;
  relatedSearches?: Array<{ query: string }>;
  peopleAlsoAsk?: Array<{ question: string; snippet: string }>;
}

/**
 * Résultat optimisé combinant Maps et Search
 */
export interface SerperOptimizedResult {
  places: SerperPlace[];
  organic: SerperOrganicResult[];
  knowledgeGraph: SerperKnowledgeGraph | null;
  decisionMakersContext?: SerperOrganicResult[];
  socialsContext?: SerperOrganicResult[];
  searchQuality: 'GOOD' | 'FALLBACK' | 'EMPTY';
}

// ===========================================
// GEMINI API TYPES
// ===========================================

/**
 * Décideur/contact extrait par Gemini
 */
export interface GeminiKeyPerson {
  name: string;
  title?: string;
  email?: string;
}

/**
 * Réseaux sociaux extraits par Gemini
 */
export interface GeminiSocials {
  linkedin?: string;
  facebook?: string;
  instagram?: string;
  twitter?: string;
}

/**
 * Données enrichies extraites par Gemini
 */
export interface GeminiEnrichmentResult {
  companyName?: string;
  phones?: string[];
  emails?: string[];
  keyPeople?: GeminiKeyPerson[];
  socials?: GeminiSocials;
  hours?: string;
}

/**
 * Réponse brute de l'API Gemini
 */
export interface GeminiApiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

// ===========================================
// SUPABASE PROXY TYPES
// ===========================================

/**
 * Payload pour le proxy Supabase
 */
export interface ProxyPayload {
  service: 'serper' | 'gemini';
  payload: {
    endpoint?: string;
    body: Record<string, unknown>;
    apiKey?: string;
  };
}

/**
 * Erreur retournée par le proxy
 */
export interface ProxyError {
  message: string;
  code?: string;
  status?: number;
}

// ===========================================
// HELPER TYPES
// ===========================================

/**
 * Résultat d'une opération async avec possibilité d'erreur
 */
export type AsyncResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Options de recherche Serper
 */
export interface SerperSearchOptions {
  enableDecisionMakerSearch?: boolean;
  enableSocialsSearch?: boolean;
}
