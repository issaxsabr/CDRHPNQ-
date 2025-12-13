
import { supabase } from './supabase';
import { SerperStrategy } from '../types';

export const searchWithSerper = async (query: string, _apiKey: string, country: string = 'qc', strategy: SerperStrategy = 'maps_basic') => {
  // Note: _apiKey est désormais ignoré car la clé est gérée de manière sécurisée côté serveur (Supabase Edge Function)

  let locationString: string | undefined;
  // Mapping des provinces pour Serper Location
  switch (country) {
      case 'qc': locationString = "Quebec, Canada"; break;
      case 'on': locationString = "Ontario, Canada"; break;
      case 'bc': locationString = "British Columbia, Canada"; break;
      case 'ab': locationString = "Alberta, Canada"; break;
      case 'mb': locationString = "Manitoba, Canada"; break;
      case 'sk': locationString = "Saskatchewan, Canada"; break;
      case 'ns': locationString = "Nova Scotia, Canada"; break;
      case 'nb': locationString = "New Brunswick, Canada"; break;
      case 'nl': locationString = "Newfoundland and Labrador, Canada"; break;
      case 'pe': locationString = "Prince Edward Island, Canada"; break;
      case 'yt': locationString = "Yukon, Canada"; break;
      case 'nt': locationString = "Northwest Territories, Canada"; break;
      case 'nu': locationString = "Nunavut, Canada"; break;
      default: locationString = "Canada"; // Fallback générique
  }
  
  const doFetch = async (endpoint: string, customQuery?: string) => {
    let queryToUse = customQuery || (locationString ? `${query} ${locationString}` : query);

    // Si c'est une recherche web générale (pas pour l'email), on la guide pour de meilleurs résultats
    if (endpoint === 'search' && !customQuery) {
        queryToUse = `${queryToUse} (adresse OR téléphone OR horaires OR contact)`;
    }
    
    const requestBody = {
        "q": queryToUse,
        "gl": "ca", // TOUJOURS Canada
        "hl": "fr",
        "location": endpoint === 'maps' ? locationString : undefined
    };

    // --- SÉCURITÉ : APPEL VIA EDGE FUNCTION ---
    // On n'appelle plus directment google.serper.dev
    // On passe par notre proxy Supabase qui détient la clé secrète
    const { data, error } = await supabase.functions.invoke('proxy-api', {
        body: {
            service: 'serper',
            payload: {
                endpoint: endpoint,
                body: requestBody
            }
        }
    });

    if (error) {
        console.error("Erreur Proxy Supabase:", error);
        throw new Error("Impossible de contacter le serveur sécurisé. Vérifiez votre connexion ou la configuration de la Edge Function.");
    }

    // Le proxy renvoie parfois l'erreur API dans le corps de la réponse
    if (data && data.error) {
         throw new Error(`Erreur API Serper : ${JSON.stringify(data.error)}`);
    }

    return data;
  };

  try {
    const useMaps = strategy.startsWith('maps'); 
    const forceEnrich = strategy === 'maps_web_enrich';

    let placesResult: any = null;
    let organicResult: any = null;
    let fallbackUsed = false;

    // 1. RECHERCHE PRINCIPALE
    if (useMaps) {
        // Coût : 3 crédits
        placesResult = await doFetch("maps");
        
        // NOUVEAU : Si stratégie Enrichie, on lance AUSSI la recherche web
        // pour tenter de trouver des emails/socials que Maps ne donne pas souvent
        if (forceEnrich) {
             organicResult = await doFetch("search");
        }
    } else {
        // Coût : 1 crédit
        organicResult = await doFetch("search");
    }
    
    // Vérification des résultats Maps
    const hasPlace = placesResult?.places && placesResult.places.length > 0;
    
    // Fallback automatique : Si on a choisi Maps mais qu'il n'y a RIEN, on tente le Web (coût +1)
    // Sauf si on l'a déjà fait via forceEnrich
    if (useMaps && !hasPlace && !forceEnrich) {
         organicResult = await doFetch("search");
         fallbackUsed = true;
    }
    
    // Fusion de tous les résultats
    const finalResult = {
        places: placesResult?.places || [],
        organic: organicResult?.organic || placesResult?.organic || [],
        knowledgeGraph: organicResult?.knowledgeGraph || placesResult?.knowledgeGraph || null,
        fallbackUsed
    };

    return finalResult;

  } catch (error) {
    console.error("Erreur Serper", error);
    throw error;
  }
};
