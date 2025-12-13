
import { supabase } from './supabase';
import { BusinessData, ContactPerson } from "../types";

// NOTE: Le SDK @google/genai a été retiré car nous passons maintenant par le proxy serveur sécurisé.
// Plus de clé API exposée dans le navigateur !

/**
 * Helper to find ALL phone numbers in text
 */
const findAllPhonesInText = (text: string): string[] => {
    // Regex plus robuste acceptant les formats internationaux et locaux
    const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;
    const matches = [...text.matchAll(phoneRegex)];
    return Array.from(new Set(matches.map(m => m[0].trim())));
};

/**
 * Helper to find address-like patterns
 */
const findAddressInText = (text: string): string | null => {
    const addressRegex = /\d+\s+[A-Za-z\u00C0-\u017F\s,.-]+(?:street|st|ave|avenue|rd|road|blvd|boulevard|rue|ch|chemin|route|dr|drive|sq|square|ln|lane|place|impasse|allée)\.?\s*(?:,|\s)\s*[A-Za-z\u00C0-\u017F\s.-]+/i;
    const match = text.match(addressRegex);
    return match ? match[0].trim() : null;
};

/**
 * Helper to extract hours from text snippet
 */
const extractHoursFromText = (text: string): string | null => {
    const hoursPatterns = [
        /(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|lun|mar|mer|jeu|ven|sam|dim|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun).{1,30}?(?:\d{1,2}(?:h|:|am|pm)\d{0,2}).{1,10}?(?:\d{1,2}(?:h|:|am|pm)\d{0,2})/i,
        /(?:heures|hours|ouverture|open|horaires).{1,20}?(?:\d{1,2}(?:h|:|am|pm)\d{0,2}).{1,10}?(?:\d{1,2}(?:h|:|am|pm)\d{0,2})/i,
        /\d{1,2}(?:h|:|am|pm)\d{0,2}\s*(?:à|to|-)\s*\d{1,2}(?:h|:|am|pm)\d{0,2}/i
    ];

    for (const pattern of hoursPatterns) {
        const match = text.match(pattern);
        if (match) {
            let h = match[0].replace(/Business hours|Heures d'ouverture/i, '').trim();
            return h.charAt(0).toUpperCase() + h.slice(1);
        }
    }
    return null;
};

/**
 * Helper to format opening hours object to string
 */
const formatOpeningHours = (hoursObj: any): string => {
    if (!hoursObj || typeof hoursObj !== 'object') return "N/A";
    return Object.entries(hoursObj)
        .map(([day, time]) => `${day.charAt(0).toUpperCase() + day.slice(1)}: ${time}`)
        .join(' | ');
};

/**
 * Helper regex pour TOUS les emails avec filtrage intelligent
 */
const extractEmails = (text: string): string[] => {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = [...text.matchAll(emailRegex)];
    
    // Filtres anti-bruit
    const junkDomains = ['wix.com', 'sentry.io', 'example.com', 'email.com', 'domain.com', 'noreply', 'sentry', 'ingest', 'u-2e', 'google.com'];
    const junkUsers = ['noreply', 'no-reply', 'admin', 'webmaster', 'support-wix', 'postmaster'];

    let emails = Array.from(new Set(matches.map(m => m[0].toLowerCase())))
        .filter(email => !junkDomains.some(d => email.includes(d)))
        .filter(email => !junkUsers.some(u => email.startsWith(u)));

    // Tri intelligent: Priorité aux emails "humains" ou "contact"
    emails.sort((a, b) => {
        const score = (str: string) => {
            if (str.includes('info')) return 3;
            if (str.includes('contact')) return 3;
            if (str.includes('hello')) return 2;
            if (str.includes('admin')) return 1;
            return 0;
        };
        return score(b) - score(a);
    });

    return emails;
};

/**
 * Nettoie le titre d'une page web pour extraire le vrai nom de l'entreprise
 */
const cleanNameFromTitle = (title: string, query: string): string => {
    if (!title) return query;

    const genericNavTerms = [
        'contact', 'contactez-nous', 'contact us', 'nous joindre', 'nous contacter',
        'accueil', 'home', 'homepage', 'bienvenue', 'welcome',
        'a propos', 'à propos', 'about', 'about us',
        'services', 'nos services', 'produits',
        'login', 'connexion', 'sign in',
        'citoyens', 'citoyen', 'citizens',
        'particuliers', 'particulier', 'individuals',
        'entreprises', 'entreprise', 'businesses',
        'index', 'default', 'main'
    ];

    let cleanTitle = title.trim();

    if (genericNavTerms.some(t => cleanTitle.toLowerCase() === t)) {
        return query;
    }

    const separators = [' - ', ' | ', ' : ', ' • ', ' — '];
    let usedSeparator = separators.find(sep => cleanTitle.includes(sep));

    if (usedSeparator) {
        const parts = cleanTitle.split(usedSeparator).map(p => p.trim());
        const validParts = parts.filter(part => {
            const lowerPart = part.toLowerCase();
            return !genericNavTerms.some(term => lowerPart === term || lowerPart.startsWith(term + ' '));
        });

        if (validParts.length > 0) {
            const matchQuery = validParts.find(p => p.toLowerCase().includes(query.toLowerCase()));
            if (matchQuery) return matchQuery;
            return validParts[0]; 
        } else {
            return query;
        }
    }
    
    for (const term of genericNavTerms) {
        if (cleanTitle.toLowerCase().startsWith(term)) {
            const replaced = cleanTitle.substring(term.length).replace(/^[-|: ]+/, '').trim();
            return replaced.length > 0 ? replaced : query;
        }
        if (cleanTitle.toLowerCase().endsWith(term)) {
            const replaced = cleanTitle.substring(0, cleanTitle.length - term.length).replace(/[-|: ]+$/, '').trim();
            return replaced.length > 0 ? replaced : query;
        }
    }

    return cleanTitle;
};

/**
 * Score de priorité pour téléphone (sans-frais en premier).
 */
const getPhoneScore = (phoneStr: string): number => {
    const p = phoneStr.replace(/\D/g, '');
    if (p.startsWith('1800') || p.startsWith('800')) return 0;
    if (p.startsWith('1888') || p.startsWith('888')) return 1;
    if (p.startsWith('1877') || p.startsWith('877')) return 2;
    if (p.startsWith('1866') || p.startsWith('866')) return 3;
    if (p.startsWith('1855') || p.startsWith('855')) return 4;
    return 100; // Non sans-frais
};

/**
 * Formate un numéro nord-américain au format +1 (XXX) XXX-XXXX.
 */
const formatPhoneNumber = (phoneStr: string): string => {
    const cleaned = phoneStr.replace(/\D/g, '');
    if (cleaned.length === 10) return `+1 (${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6)}`;
    if (cleaned.length === 11 && cleaned.startsWith('1')) return `+1 (${cleaned.substring(1, 4)}) ${cleaned.substring(4, 7)}-${cleaned.substring(7)}`;
    return phoneStr;
};


/**
 * Utilise Gemini pour extraire des infos du contexte Serper et DÉTECTER LES DÉCIDEURS
 * SÉCURISÉ : Passe maintenant par Supabase Edge Function
 */
export const enrichWithGemini = async (context: any, query: string): Promise<any> => {
    const organic = context?.organic || [];
    const kg = context?.knowledgeGraph || null;

    const textContext = [
        kg?.description,
        ...organic.slice(0, 5).map((o: any) => `${o.title} ${o.snippet}`)
    ].filter(Boolean).join("\n\n");

    if (!textContext.trim()) return {}; 
    
    const prompt = `Tu es un expert en Lead Generation. Analyse le texte pour l'entreprise "${query}".
    
    OBJECTIF CRITIQUE : Trouve les PERSONNES (Nom + Titre + Email).
    
    1. Décideurs Principaux : CEO, PDG, Owner, Fondateur, Directeur.
    2. Employés Clés : Si tu trouves un email nominatif (ex: julie.provencher@...), cherche absolument le TITRE du poste associé dans le texte (ex: Coordonnatrice, Agente, Comptable, Secrétaire).
    
    Format de sortie souhaité pour keyPeople :
    - name: Nom Prénom
    - title: Le poste exact trouvé (ex: "Coordonnatrice aux ventes")
    - email: L'email associé
    
    Extrais aussi les emails génériques et téléphones.

    Contexte :
    ---
    ${textContext}
    ---
    
    Réponds en JSON uniquement.`;

    try {
        // APPEL SÉCURISÉ VIA SUPABASE (Au lieu de GoogleGenAI direct)
        const { data, error } = await supabase.functions.invoke('proxy-api', {
            body: {
                service: 'gemini',
                payload: {
                    body: {
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: {
                            responseMimeType: "application/json",
                            // On simplifie le schéma pour le proxy REST
                            temperature: 0.2
                        }
                    }
                }
            }
        });

        if (error) {
            console.error("Erreur Proxy Gemini:", error);
            throw new Error(`Proxy Gemini Error: ${error.message || 'Unknown error'}`);
        }

        // Parsing de la réponse REST de Gemini
        // La structure est data.candidates[0].content.parts[0].text
        const textResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (textResponse) {
            return JSON.parse(textResponse);
        }
        
        throw new Error("Empty or invalid response from Gemini enrichment");

    } catch (e: any) {
        console.error("Erreur d'enrichissement Gemini (Proxy):", e);
        throw new Error(`Gemini Enrichment Failed: ${e.message || e}`);
    }
}


/**
 * Analyse les données Serper (Maps + Web) et fusionne avec Gemini (IA)
 */
export const extractDataFromContext = async (
    query: string,
    contextData: any,
    geminiData?: any,
): Promise<{ businesses: BusinessData[]; rawText: string }> => {

    let name = query;
    let address = "N/A";
    let phone = "N/A";
    let phones: string[] = [];
    let hours = "N/A";
    let status = "Non trouvé"; 
    let sourceUri = "";
    let found = false;
    
    let website = "";
    let category = "";
    
    let email: string | undefined;
    let emails: string[] = [];
    let socials: any = {};
    let decisionMakers: ContactPerson[] = [];

    const places = contextData?.places || [];
    const organic = contextData?.organic || [];
    const kg = contextData?.knowledgeGraph || null;

    // 1. BASE MAPS
    if (places.length > 0) {
        const place = places[0];
        found = true;

        name = place.title || query;
        address = place.address || "N/A";
        phone = place.phoneNumber || place.phone || "N/A";
        if (phone !== "N/A") phones.push(phone);

        website = place.website || "";
        category = place.type || place.category || "";
        // Rating removed from extraction
        
        hours = place.openingHours ? formatOpeningHours(place.openingHours) : "Voir Fiche Maps";
        status = (place.title && (place.title.toLowerCase().includes('closed') || place.title.toLowerCase().includes('fermé'))) 
                 ? "Fermé (Voir Fiche)" 
                 : "En activité";

        sourceUri = place.cid 
            ? `https://maps.google.com/?cid=${place.cid}` 
            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + " " + address)}`;
    } 
    
    // 2. FALLBACK WEB
    if (!found) {
        if (kg) {
             found = true;
             name = kg.title || name;
             status = "Fiche Google trouvée";
             website = kg.website || "";
             if (kg.type) category = kg.type;
        } else if (organic.length > 0) {
             const org = organic[0];
             found = true;
             name = cleanNameFromTitle(org.title, query);
             status = "Site Web Trouvé (Pas de fiche Maps)";
             sourceUri = org.link;
             website = org.link;
             
             if (org.snippet) {
                 const extractedPhones = findAllPhonesInText(org.snippet);
                 if (extractedPhones.length > 0) {
                     phone = extractedPhones[0];
                     phones = [...phones, ...extractedPhones];
                 }
                 const a = findAddressInText(org.snippet);
                 if (a) address = a;
                 const h = extractHoursFromText(org.snippet);
                 if (h) hours = h;
             }
        }
    }

    // 3. ENRICHISSEMENT IA & FUSION
    if (found) {
        if (geminiData) {
            if (geminiData.companyName) name = geminiData.companyName;
            if (geminiData.phones) phones = [...phones, ...geminiData.phones];
            if (geminiData.emails) emails = [...emails, ...geminiData.emails];
            if (geminiData.socials) socials = { ...socials, ...geminiData.socials };
            if (geminiData.hours && (hours === "N/A" || hours === "Voir Fiche Maps")) {
                hours = geminiData.hours;
            }
            // IMPORTANT : Import des décideurs trouvés par Gemini
            if (geminiData.keyPeople && Array.isArray(geminiData.keyPeople)) {
                decisionMakers = geminiData.keyPeople.filter((p: any) => p.name);
                // Ajouter l'email du décideur à la liste principale s'il est nouveau
                decisionMakers.forEach(dm => {
                    if (dm.email) emails.push(dm.email);
                });
            }
        }
        
        // Scan additionnel des snippets pour emails
        const combinedText = [
            kg?.description,
            ...organic.slice(0, 5).map((o: any) => `${o.title} ${o.snippet}`)
        ].filter(Boolean).join(" ");
        
        emails = [...emails, ...extractEmails(combinedText)];
        phones = [...phones, ...findAllPhonesInText(combinedText)];

        // Nettoyage final
        emails = Array.from(new Set(emails));
        
        // Dédoublonnage téléphones
        const uniquePhonesMap = new Map<string, string>();
        phones.forEach(p => {
            let normalized = p.replace(/\D/g, '');
            if (normalized.length === 10) normalized = '1' + normalized;
            if (!uniquePhonesMap.has(normalized)) uniquePhonesMap.set(normalized, p);
        });
        phones = Array.from(uniquePhonesMap.values());
        phones.sort((a, b) => getPhoneScore(a) - getPhoneScore(b));
        phones = phones.map(p => getPhoneScore(p) < 100 ? p : formatPhoneNumber(p));

        if (phones.length > 0) phone = phones[0];
        if (emails.length > 0) email = emails[0];
        
        // Website fallback
        if (organic.length > 0 && !website) website = organic[0].link;

        // Horaires fallback
        if ((hours === "N/A" || hours === "Voir Fiche Maps") && kg && kg.hours) hours = kg.hours;

        return {
            businesses: [{
                name,
                status,
                address,
                phone,
                phones,
                hours,
                sourceUri,
                searchedTerm: query,
                website,
                category,
                // Removed rating, priceLevel
                email,
                emails,
                socials: Object.keys(socials).length > 0 ? socials : undefined,
                decisionMakers
            }],
            rawText: `Extraction Hybride Optimisée${geminiData ? ' + Analyse (Décideurs)' : ''}`
        };
    }

    return {
        businesses: [{
            name: query,
            status: "Introuvable",
            address: "N/A",
            phone: "N/A",
            phones: [],
            hours: "N/A",
            searchedTerm: query
        }],
        rawText: "Aucun résultat."
    };
}
