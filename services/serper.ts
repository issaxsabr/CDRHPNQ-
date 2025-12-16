
import { supabase } from './supabase';
import { SerperStrategy } from '../types';

export interface SerperOptimizedResult {
    places: any[];
    organic: any[];
    knowledgeGraph: any | null;
    decisionMakersContext?: any[];
    socialsContext?: any[];
    searchQuality: 'GOOD' | 'FALLBACK' | 'EMPTY';
}

interface SerperOptions {
    enableDecisionMakerSearch?: boolean;
    enableSocialsSearch?: boolean;
}

const doFetch = async (endpoint: string, query: string, serperKey: string, country: string) => {
    let locationString: string | undefined;
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
        default: locationString = "Canada";
    }

    // NOUVELLE LOGIQUE : Rendre la requête explicite
    const lowerQuery = query.toLowerCase();
    const locationParts = locationString.toLowerCase().split(',').map(p => p.trim());
    const locationAlreadyInQuery = locationParts.some(part => lowerQuery.includes(part));
    
    const explicitQuery = locationAlreadyInQuery ? query : `${query}, ${locationString}`;
  
    const requestBody = {
        "q": explicitQuery,
        "gl": "ca",
        "hl": "fr",
        "location": endpoint === 'maps' ? locationString : undefined
    };

    const { data, error } = await supabase.functions.invoke('proxy-api', {
        body: {
            service: 'serper',
            payload: {
                endpoint: endpoint,
                body: requestBody,
                apiKey: serperKey
            }
        }
    });

    if (error) {
        // Gérer le cas où la clé API est invalide
        if (error.message && error.message.includes('403')) {
             throw new Error("Clé API Serper invalide ou expirée. Veuillez la vérifier dans les paramètres.");
        }
        throw new Error(`Proxy Supabase Error: ${error.message}`);
    }

    if (data && data.error) {
         throw new Error(`Serper API Error: ${JSON.stringify(data.error)}`);
    }

    return data;
};

export const searchWithSerper = async (
    query: string, 
    apiKey: string, 
    country: string = 'qc', 
    strategy: SerperStrategy = 'maps_basic',
    options: SerperOptions = {}
): Promise<SerperOptimizedResult> => {
  const { enableDecisionMakerSearch = false, enableSocialsSearch = false } = options;

  let placesResult: any = null;
  let organicResult: any = null;
  let decisionMakersContext: any[] = [];
  let socialsContext: any[] = [];
  let searchQuality: 'GOOD' | 'FALLBACK' | 'EMPTY' = 'EMPTY';

  const useMaps = strategy.startsWith('maps');
  const enrichWithWeb = strategy === 'maps_web_enrich' || strategy === 'maps_web_leadgen';
  const mainQueryFallback = `${query} (adresse OR téléphone OR contact OR email OR courriel) -jobs -careers -indeed`;
  
  if (useMaps) {
      placesResult = await doFetch("maps", query, apiKey, country);
      
      if (enrichWithWeb) {
          const website = placesResult?.places?.[0]?.website;
          let webSearchQuery = mainQueryFallback;

          if (website) {
              try {
                  const domain = new URL(website).hostname.replace('www.', '');
                  // Logique optimisée inspirée par votre suggestion
                  webSearchQuery = `site:${domain} ("email" OR "contact" OR "courriel" OR "@${domain}") OR ("${query}" "contact")`;
              } catch (e) {
                  console.warn("URL de site web invalide, utilisation de la requête de secours.", website);
              }
          }
          organicResult = await doFetch("search", webSearchQuery, apiKey, country);
      }
  } else {
      organicResult = await doFetch("search", mainQueryFallback, apiKey, country);
  }

  const hasPlace = placesResult?.places && placesResult.places.length > 0;
  const hasOrganic = organicResult?.organic && organicResult.organic.length > 0;

  if (hasPlace || hasOrganic) {
      searchQuality = 'GOOD';
  }
  
  if (enableDecisionMakerSearch) {
      const companyDomain = organicResult?.organic?.[0]?.link ? new URL(organicResult.organic[0].link).hostname.replace('www.','') : null;
      const dmQueries = [
          `"${query}" (CEO OR PDG OR Directeur OR Fondateur OR Gérant)`,
          companyDomain ? `site:${companyDomain} (équipe OR "à propos" OR direction)` : null,
          `site:linkedin.com/in "at ${query}" (CEO OR Fondateur OR Directeur)`
      ].filter(Boolean) as string[];

      const dmPromises = dmQueries.map(q => doFetch("search", q, apiKey, country).catch(e => { console.warn(`DM search failed for query: ${q}`, e); return { organic: [] }; }));
      const dmResults = await Promise.all(dmPromises);
      decisionMakersContext = dmResults.flatMap(res => res.organic || []);
  }
  
  if (enableSocialsSearch) {
      const socialQuery = `"${query}" (site:linkedin.com/company OR site:facebook.com OR site:instagram.com)`;
      const socialResult = await doFetch("search", socialQuery, apiKey, country).catch(e => { console.warn('Social search failed', e); return { organic: [] }; });
      socialsContext = socialResult.organic || [];
  }

  return {
      places: placesResult?.places || [],
      organic: organicResult?.organic || [],
      knowledgeGraph: organicResult?.knowledgeGraph || placesResult?.knowledgeGraph || null,
      decisionMakersContext,
      socialsContext,
      searchQuality,
  };
};