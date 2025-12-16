import { supabase } from './supabase';
import { BusinessData, ContactPerson } from '../types';
import { SerperOptimizedResult } from './serper';
import { GeminiEnrichmentResult, GeminiKeyPerson, SerperOrganicResult } from '../types/api';
import { logger } from './logger';
import { handleError, ErrorCode, AppError } from './errorHandler';
import { GEMINI_CONFIG } from '../config';

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Trouve tous les numéros de téléphone dans un texte
 */
const findAllPhonesInText = (text: string): string[] => {
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;
  const matches = [...text.matchAll(phoneRegex)];
  return Array.from(new Set(matches.map(m => m[0].trim())));
};

/**
 * Trouve une adresse dans un texte
 */
const findAddressInText = (text: string): string | null => {
  const addressRegex =
    /\d+\s+[A-Za-z\u00C0-\u017F\s,.-]+(?:street|st|ave|avenue|rd|road|blvd|boulevard|rue|ch|chemin|route|dr|drive|sq|square|ln|lane|place|impasse|allée)\.?\s*(?:,|\s)\s*[A-Za-z\u00C0-\u017F\s.-]+/i;
  const match = text.match(addressRegex);
  return match ? match[0].trim() : null;
};

/**
 * Extrait les horaires d'un texte
 */
const extractHoursFromText = (text: string): string | null => {
  const hoursPatterns = [
    /(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|lun|mar|mer|jeu|ven|sam|dim|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun).{1,30}?(?:\d{1,2}(?:h|:|am|pm)\d{0,2}).{1,10}?(?:\d{1,2}(?:h|:|am|pm)\d{0,2})/i,
    /(?:heures|hours|ouverture|open|horaires).{1,20}?(?:\d{1,2}(?:h|:|am|pm)\d{0,2}).{1,10}?(?:\d{1,2}(?:h|:|am|pm)\d{0,2})/i,
    /\d{1,2}(?:h|:|am|pm)\d{0,2}\s*(?:à|to|-)\s*\d{1,2}(?:h|:|am|pm)\d{0,2}/i,
  ];

  for (const pattern of hoursPatterns) {
    const match = text.match(pattern);
    if (match) {
      const h = match[0].replace(/Business hours|Heures d'ouverture/i, '').trim();
      return h.charAt(0).toUpperCase() + h.slice(1);
    }
  }
  return null;
};

/**
 * Formate les horaires d'ouverture
 */
const formatOpeningHours = (hoursObj: Record<string, string> | null | undefined): string => {
  if (!hoursObj || typeof hoursObj !== 'object') return 'N/A';
  return Object.entries(hoursObj)
    .map(([day, time]) => `${day.charAt(0).toUpperCase() + day.slice(1)}: ${time}`)
    .join(' | ');
};

/**
 * Calcule un score de priorité pour un numéro de téléphone
 * Les numéros sans-frais ont une priorité plus basse
 */
const getPhoneScore = (phoneStr: string): number => {
  const p = phoneStr.replace(/\D/g, '');
  if (p.startsWith('1800') || p.startsWith('800')) return 0;
  if (p.startsWith('1888') || p.startsWith('888')) return 1;
  if (p.startsWith('1877') || p.startsWith('877')) return 2;
  if (p.startsWith('1866') || p.startsWith('866')) return 3;
  if (p.startsWith('1855') || p.startsWith('855')) return 4;
  return 100;
};

/**
 * Formate un numéro de téléphone
 */
const formatPhoneNumber = (phoneStr: string): string => {
  const cleaned = phoneStr.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `+1 (${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.substring(1, 4)}) ${cleaned.substring(4, 7)}-${cleaned.substring(7)}`;
  }
  return phoneStr;
};

/**
 * Extrait et score les emails d'un texte
 */
const extractEmailsWithQuality = (text: string): { email: string; quality: number }[] => {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex) || [];

  const junkDomains = ['wix.com', 'sentry.io', 'example.com', 'email.com', 'domain.com', 'google.com', 'googleapis.com'];
  const junkUsers = ['noreply', 'no-reply', 'admin', 'webmaster', 'support', 'postmaster', 'jobs', 'careers'];

  const emails = Array.from(new Set(matches.map(m => m.toLowerCase())))
    .filter(email => !junkDomains.some(d => email.includes(d)))
    .filter(email => !junkUsers.some(u => email.startsWith(u)));

  return emails
    .map(email => {
      let quality = 50;
      if (email.includes('info')) quality += 20;
      if (email.includes('contact')) quality += 20;
      if (email.includes('direction')) quality += 25;
      if (email.includes('presidence') || email.includes('ceo') || email.includes('pdg')) quality += 30;
      if (!email.match(/^(info|contact|admin|direction|hello|sales|ventes|marketing)@/)) quality += 15;

      return { email, quality };
    })
    .sort((a, b) => b.quality - a.quality);
};

// ===========================================
// MAIN FUNCTIONS
// ===========================================

/**
 * Enrichit les données avec Gemini AI
 */
export const enrichWithGemini = async (
  context: SerperOptimizedResult,
  query: string
): Promise<GeminiEnrichmentResult> => {
  const textContext = [
    context.knowledgeGraph?.description,
    ...context.organic.slice(0, 5).map(o => `${o.title}: ${o.snippet}`),
    '--- DECISION MAKERS CONTEXT ---',
    ...(context.decisionMakersContext?.slice(0, 5).map(o => `${o.title}: ${o.snippet}`) || []),
    '--- SOCIALS CONTEXT ---',
    ...(context.socialsContext?.slice(0, 3).map(o => `${o.title}: ${o.snippet}`) || []),
  ]
    .filter(Boolean)
    .join('\n\n');

  if (!textContext.trim()) return {};

  logger.time('gemini-enrichment');

  const prompt = `
<persona>
Tu es un expert en Lead Generation B2B et en extraction de données structurées. Tu maîtrises l'identification des décideurs d'entreprise.
</persona>
<task>
Analyse le texte pour "${query}" et extrais TOUTES les infos de contact.
PRIORITÉS CRITIQUES:
1. DÉCIDEURS: CEO, PDG, Directeur, Fondateur, Gérant, Président.
2. EMAILS NOMINATIFS: prenom.nom@domaine + chercher le titre du poste associé.
3. TÉLÉPHONES: Tous les numéros, y compris les sans-frais.
4. RÉSEAUX SOCIAUX: Profils officiels (LinkedIn, Facebook, Instagram).
RÈGLES DE QUALITÉ:
- Pour chaque décideur, cherche son email associé.
- Privilégie les emails génériques pertinents: info@, contact@, direction@, etc.
- Exclure les emails non pertinents: noreply@, support@, webmaster@, jobs@.
- Extrait le nom le plus probable de l'entreprise.
</task>
<context>
${textContext.substring(0, GEMINI_CONFIG.MAX_CONTEXT_LENGTH)}
</context>
<format>
Réponds UNIQUEMENT en JSON structuré en respectant le schéma fourni.
</format>
<few_shot_examples>
Exemple 1:
Texte: "Contactez Jean Tremblay, PDG de ABC Inc. au jean.tremblay@abc.com"
Output: {
  "companyName": "ABC Inc",
  "keyPeople": [{"name": "Jean Tremblay", "title": "PDG", "email": "jean.tremblay@abc.com"}],
  "emails": ["jean.tremblay@abc.com"]
}
Exemple 2:
Texte: "Notre équipe: Marie Dupont (Directrice) marie@xyz.ca, info@xyz.ca"
Output: {
  "companyName": "XYZ",
  "keyPeople": [{"name": "Marie Dupont", "title": "Directrice", "email": "marie@xyz.ca"}],
  "emails": ["marie@xyz.ca", "info@xyz.ca"]
}
</few_shot_examples>
    `;

  const responseSchema = {
    type: 'OBJECT',
    properties: {
      companyName: { type: 'STRING', description: "Le nom officiel de l'entreprise." },
      phones: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Liste des numéros de téléphone trouvés.' },
      emails: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Liste de tous les emails trouvés.' },
      keyPeople: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING', description: 'Nom complet du décideur.' },
            title: { type: 'STRING', description: 'Poste/titre exact du décideur.' },
            email: { type: 'STRING', description: 'Email personnel du décideur.' },
          },
          required: ['name', 'title'],
        },
        description: 'Liste des décideurs et employés clés identifiés.',
      },
      socials: {
        type: 'OBJECT',
        properties: {
          linkedin: { type: 'STRING', description: "URL du profil LinkedIn de l'entreprise." },
          facebook: { type: 'STRING', description: "URL de la page Facebook de l'entreprise." },
          instagram: { type: 'STRING', description: "URL du profil Instagram de l'entreprise." },
        },
        description: 'Profils sur les réseaux sociaux.',
      },
      hours: { type: 'STRING', description: "Horaires d'ouverture." },
    },
  };

  try {
    const { data, error } = await supabase.functions.invoke('proxy-api', {
      body: {
        service: 'gemini',
        payload: {
          body: {
            contents: [{ parts: [{ text: prompt }] }],
            config: {
              responseMimeType: 'application/json',
              responseSchema: responseSchema,
              temperature: GEMINI_CONFIG.TEMPERATURE,
            },
          },
        },
      },
    });

    if (error) {
      logger.error('Gemini proxy error:', error);
      throw new AppError(ErrorCode.API_ERROR, {
        message: `Proxy Gemini Error: ${error.message || 'Unknown error'}`,
        originalError: error,
      });
    }

    const textResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResponse) {
      logger.warn('Gemini response was valid but contained no text part.', { data });
      return {};
    }

    logger.timeEnd('gemini-enrichment');

    try {
      return JSON.parse(textResponse) as GeminiEnrichmentResult;
    } catch {
      logger.warn('Failed to parse Gemini JSON, attempting to clean response...');
      const cleanedResponse = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      try {
        return JSON.parse(cleanedResponse) as GeminiEnrichmentResult;
      } catch {
        logger.error('Failed to parse even after cleaning the Gemini JSON response:', { cleanedResponse });
        throw new AppError(ErrorCode.API_ERROR, {
          message: 'Failed to parse JSON response from Gemini',
          context: { response: cleanedResponse },
        });
      }
    }
  } catch (error) {
    logger.timeEnd('gemini-enrichment');
    throw handleError(error, { query });
  }
};

/**
 * Extrait et structure les données à partir du contexte
 */
export const extractDataFromContext = async (
  query: string,
  contextData: SerperOptimizedResult,
  geminiData?: GeminiEnrichmentResult
): Promise<{ businesses: BusinessData[]; rawText: string; qualityScore: number }> => {
  const business: BusinessData = {
    name: query,
    status: 'Non trouvé',
    address: 'N/A',
    phone: 'N/A',
    hours: 'N/A',
    searchedTerm: query,
    phones: [],
    emails: [],
    socials: {},
    decisionMakers: [],
    qualityScore: 0,
  };

  let qualityScore = 0;
  const { places, organic, knowledgeGraph } = contextData;

  // 1. Base MAPS
  if (places.length > 0) {
    const place = places[0];
    business.name = place.title || query;
    business.address = place.address || 'N/A';
    business.phone = place.phoneNumber || place.phone || 'N/A';
    business.website = place.website || '';
    business.category = place.type || place.category || '';
    business.hours = place.openingHours ? formatOpeningHours(place.openingHours) : 'Voir Fiche Maps';
    business.status =
      place.title && (place.title.toLowerCase().includes('closed') || place.title.toLowerCase().includes('fermé'))
        ? 'Fermé (Voir Fiche)'
        : 'En activité';
    business.sourceUri = place.cid
      ? `https://maps.google.com/?cid=${place.cid}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.name + ' ' + business.address)}`;
    qualityScore += 30;
  }
  // 2. FALLBACK WEB
  else if (knowledgeGraph || organic.length > 0) {
    const source = knowledgeGraph || organic[0];
    business.name = source.title || query;
    business.status = knowledgeGraph ? 'Fiche Google trouvée' : 'Site Web Trouvé';
    business.website = (knowledgeGraph?.website || organic[0]?.link) ?? '';
    business.category = knowledgeGraph?.type || business.category;
    business.sourceUri = organic.length > 0 ? organic[0].link : business.sourceUri;

    if (organic.length > 0 && organic[0].snippet) {
      const snippetPhones = findAllPhonesInText(organic[0].snippet);
      if (snippetPhones.length > 0) business.phone = snippetPhones[0];
      if (!business.address || business.address === 'N/A') {
        business.address = findAddressInText(organic[0].snippet) || 'N/A';
      }
      if (!business.hours || business.hours === 'N/A') {
        business.hours = extractHoursFromText(organic[0].snippet) || 'N/A';
      }
    }
    qualityScore += 20;
  }

  if (contextData.searchQuality === 'EMPTY') {
    return { businesses: [business], rawText: 'Aucun résultat.', qualityScore: 0 };
  }

  // 3. ENRICHISSEMENT IA & FUSION
  if (geminiData) {
    business.name = geminiData.companyName || business.name;
    business.phones = Array.from(new Set([...(business.phones || []), ...(geminiData.phones || [])]));
    business.emails = Array.from(new Set([...(business.emails || []), ...(geminiData.emails || [])]));
    business.socials = { ...business.socials, ...geminiData.socials };

    if ((business.hours === 'N/A' || business.hours === 'Voir Fiche Maps') && geminiData.hours) {
      business.hours = geminiData.hours;
    }

    if (geminiData.keyPeople && Array.isArray(geminiData.keyPeople)) {
      business.decisionMakers = geminiData.keyPeople
        .filter((p: GeminiKeyPerson) => p.name && p.title)
        .map(
          (p: GeminiKeyPerson): ContactPerson => ({
            name: p.name,
            title: p.title,
            email: p.email,
          })
        );
      business.decisionMakers.forEach(dm => {
        if (dm.email) business.emails?.push(dm.email);
      });
    }
  }

  // 4. FINAL CLEANUP & SCORING
  const combinedText = [...organic.slice(0, 3), ...(contextData.decisionMakersContext?.slice(0, 3) || [])]
    .map((o: SerperOrganicResult) => `${o.title} ${o.snippet}`)
    .filter(Boolean)
    .join(' ');

  const textEmails = extractEmailsWithQuality(combinedText);
  business.emails = Array.from(new Set([...(business.emails || []), ...textEmails.map(e => e.email)]));

  const allPhones = findAllPhonesInText(combinedText);
  if (business.phone && business.phone !== 'N/A') allPhones.unshift(business.phone);

  const uniquePhonesMap = new Map<string, string>();
  allPhones.forEach(p => {
    let normalized = p.replace(/\D/g, '');
    if (normalized.length === 10) normalized = '1' + normalized;
    if (!uniquePhonesMap.has(normalized)) uniquePhonesMap.set(normalized, p);
  });
  business.phones = Array.from(uniquePhonesMap.values());
  business.phones.sort((a, b) => getPhoneScore(a) - getPhoneScore(b));
  business.phones = business.phones.map(p => (getPhoneScore(p) < 100 ? p : formatPhoneNumber(p)));

  if (business.phones.length > 0) business.phone = business.phones[0];
  if (business.emails && business.emails.length > 0) business.email = business.emails[0];
  if (!business.website && organic.length > 0) business.website = organic[0].link;

  // Final Quality Score
  if (business.phone !== 'N/A') qualityScore += 10;
  if (business.website) qualityScore += 10;
  if (business.category) qualityScore += 5;
  if (business.emails && business.emails.length > 0) qualityScore += Math.min(15, business.emails.length * 5);
  if (business.decisionMakers && business.decisionMakers.length > 0) {
    qualityScore += Math.min(30, business.decisionMakers.length * 10);
  }

  business.qualityScore = Math.min(100, qualityScore);

  return {
    businesses: [business],
    rawText: `Analyse Optimisée (Qualité: ${business.qualityScore})`,
    qualityScore: business.qualityScore,
  };
};
