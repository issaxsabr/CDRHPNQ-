
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

const doFetch = async (endpoint: string, query: string, country: string) => {
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
  
    const requestBody = {
        "q": query,
        "gl": "ca",
        "hl": "fr",
        "location": endpoint === 'maps' ? locationString : undefined
    };

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
        throw new Error(`Proxy Supabase Error: ${error.message}`);
    }

    if (data && data.error) {
         throw new Error(`Serper API Error: ${JSON.stringify(data.error)}`);
    }

    return data;
};

export const searchWithSerper = async (
    query: string, 
    _apiKey: string, 
    country: string = 'qc', 
    strategy: SerperStrategy = 'maps_basic',
    options: SerperOptions = {}
): Promise<SerperOptimizedResult> => {
  const { enableDecisionMakerSearch = false, enableSocialsSearch = true } = options;

  let placesResult: any = null;
  let organicResult: any = null;
  let decisionMakersContext: any[] = [];
  let socialsContext: any[] = [];
  let searchQuality: 'GOOD' | 'FALLBACK' | 'EMPTY' = 'EMPTY';

  const useMaps = strategy.startsWith('maps');
  const enrichWithWeb = strategy === 'maps_web_enrich';

  const mainQuery = `${query} (adresse OR téléphone OR contact) -jobs -careers -indeed`;
  
  if (useMaps) {
      placesResult = await doFetch("maps", query, country);
      if (enrichWithWeb) {
          organicResult = await doFetch("search", mainQuery, country);
      }
  } else {
      organicResult = await doFetch("search", mainQuery, country);
  }

  const hasPlace = placesResult?.places && placesResult.places.length > 0;
  if (useMaps && !hasPlace && !enrichWithWeb) {
      organicResult = await doFetch("search", mainQuery, country);
      searchQuality = 'FALLBACK';
  } else if (hasPlace || (organicResult?.organic && organicResult.organic.length > 0)) {
      searchQuality = 'GOOD';
  }

  if (enableDecisionMakerSearch) {
      const companyDomain = organicResult?.organic?.[0]?.link ? new URL(organicResult.organic[0].link).hostname.replace('www.','') : null;
      const dmQueries = [
          `"${query}" (CEO OR PDG OR Directeur OR Fondateur OR Gérant)`,
          companyDomain ? `site:${companyDomain} (équipe OR "à propos" OR direction)` : null,
          `site:linkedin.com/in "at ${query}" (CEO OR Fondateur OR Directeur)`
      ].filter(Boolean) as string[];

      const dmPromises = dmQueries.map(q => doFetch("search", q, country).catch(e => { console.warn(`DM search failed for query: ${q}`, e); return { organic: [] }; }));
      const dmResults = await Promise.all(dmPromises);
      decisionMakersContext = dmResults.flatMap(res => res.organic || []);
  }
  
  if (enableSocialsSearch) {
      const socialQuery = `"${query}" (site:linkedin.com/company OR site:facebook.com OR site:instagram.com)`;
      const socialResult = await doFetch("search", socialQuery, country).catch(e => { console.warn('Social search failed', e); return { organic: [] }; });
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