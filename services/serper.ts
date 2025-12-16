import { supabase } from './supabase';
import { SerperStrategy } from '../types';
import {
  SerperPlace,
  SerperOrganicResult,
  SerperKnowledgeGraph,
  SerperOptimizedResult,
  SerperSearchOptions,
  SerperMapsResponse,
  SerperSearchResponse,
} from '../types/api';
import { logger } from './logger';
import { handleError, ErrorCode, AppError } from './errorHandler';

// Re-export pour rétrocompatibilité
export type { SerperOptimizedResult };

/**
 * Mapping des codes de province vers les noms de localisation
 */
const LOCATION_MAP: Record<string, string> = {
  qc: 'Quebec, Canada',
  on: 'Ontario, Canada',
  bc: 'British Columbia, Canada',
  ab: 'Alberta, Canada',
  mb: 'Manitoba, Canada',
  sk: 'Saskatchewan, Canada',
  ns: 'Nova Scotia, Canada',
  nb: 'New Brunswick, Canada',
  nl: 'Newfoundland and Labrador, Canada',
  pe: 'Prince Edward Island, Canada',
  yt: 'Yukon, Canada',
  nt: 'Northwest Territories, Canada',
  nu: 'Nunavut, Canada',
};

/**
 * Effectue une requête vers l'API Serper via le proxy Supabase
 */
const doFetch = async <T extends SerperMapsResponse | SerperSearchResponse>(
  endpoint: string,
  query: string,
  serperKey: string,
  country: string
): Promise<T> => {
  const locationString = LOCATION_MAP[country] || 'Canada';

  // Rendre la requête explicite si la localisation n'est pas déjà présente
  const lowerQuery = query.toLowerCase();
  const locationParts = locationString.toLowerCase().split(',').map(p => p.trim());
  const locationAlreadyInQuery = locationParts.some(part => lowerQuery.includes(part));
  const explicitQuery = locationAlreadyInQuery ? query : `${query}, ${locationString}`;

  const requestBody = {
    q: explicitQuery,
    gl: 'ca',
    hl: 'fr',
    location: endpoint === 'maps' ? locationString : undefined,
  };

  logger.debug(`Serper ${endpoint} request:`, { query: explicitQuery, country });

  const { data, error } = await supabase.functions.invoke('proxy-api', {
    body: {
      service: 'serper',
      payload: {
        endpoint: endpoint,
        body: requestBody,
        apiKey: serperKey,
      },
    },
  });

  if (error) {
    logger.error(`Serper proxy error:`, error);
    if (error.message && error.message.includes('403')) {
      throw new AppError(ErrorCode.API_KEY_INVALID, {
        message: 'Clé API Serper invalide ou expirée',
      });
    }
    throw new AppError(ErrorCode.API_ERROR, {
      message: `Proxy Supabase Error: ${error.message}`,
      originalError: error,
    });
  }

  if (data && data.error) {
    throw new AppError(ErrorCode.API_ERROR, {
      message: `Serper API Error: ${JSON.stringify(data.error)}`,
      context: { apiError: data.error },
    });
  }

  return data as T;
};

/**
 * Recherche avec Serper en utilisant la stratégie spécifiée
 */
export const searchWithSerper = async (
  query: string,
  apiKey: string,
  country: string = 'qc',
  strategy: SerperStrategy = 'maps_basic',
  options: SerperSearchOptions = {}
): Promise<SerperOptimizedResult> => {
  const { enableDecisionMakerSearch = false, enableSocialsSearch = false } = options;

  logger.time('serper-search');

  let placesResult: SerperMapsResponse | null = null;
  let organicResult: SerperSearchResponse | null = null;
  let decisionMakersContext: SerperOrganicResult[] = [];
  let socialsContext: SerperOrganicResult[] = [];
  let searchQuality: 'GOOD' | 'FALLBACK' | 'EMPTY' = 'EMPTY';

  const useMaps = strategy.startsWith('maps');
  const enrichWithWeb = strategy === 'maps_web_enrich';
  const mainQueryFallback = `${query} (adresse OR téléphone OR contact OR email OR courriel) -jobs -careers -indeed`;

  try {
    if (useMaps) {
      placesResult = await doFetch<SerperMapsResponse>('maps', query, apiKey, country);

      if (enrichWithWeb) {
        const website = placesResult?.places?.[0]?.website;
        let webSearchQuery = mainQueryFallback;

        if (website) {
          try {
            const domain = new URL(website).hostname.replace('www.', '');
            webSearchQuery = `site:${domain} ("email" OR "contact" OR "courriel" OR "@${domain}") OR ("${query}" "contact")`;
          } catch {
            logger.warn('URL de site web invalide, utilisation de la requête de secours.', { website });
          }
        }
        organicResult = await doFetch<SerperSearchResponse>('search', webSearchQuery, apiKey, country);
      }
    } else {
      organicResult = await doFetch<SerperSearchResponse>('search', mainQueryFallback, apiKey, country);
    }

    const hasPlace = placesResult?.places && placesResult.places.length > 0;
    const hasOrganic = organicResult?.organic && organicResult.organic.length > 0;

    if (hasPlace || hasOrganic) {
      searchQuality = 'GOOD';
    }

    // Recherche des décideurs si activée
    if (enableDecisionMakerSearch) {
      const companyDomain = organicResult?.organic?.[0]?.link
        ? new URL(organicResult.organic[0].link).hostname.replace('www.', '')
        : null;

      const dmQueries = [
        `"${query}" (CEO OR PDG OR Directeur OR Fondateur OR Gérant)`,
        companyDomain ? `site:${companyDomain} (équipe OR "à propos" OR direction)` : null,
        `site:linkedin.com/in "at ${query}" (CEO OR Fondateur OR Directeur)`,
      ].filter((q): q is string => q !== null);

      const dmPromises = dmQueries.map(q =>
        doFetch<SerperSearchResponse>('search', q, apiKey, country).catch(e => {
          logger.warn(`DM search failed for query: ${q}`, e);
          return { organic: [] } as SerperSearchResponse;
        })
      );

      const dmResults = await Promise.all(dmPromises);
      decisionMakersContext = dmResults.flatMap(res => res.organic || []);
    }

    // Recherche des réseaux sociaux si activée
    if (enableSocialsSearch) {
      const socialQuery = `"${query}" (site:linkedin.com/company OR site:facebook.com OR site:instagram.com)`;
      const socialResult = await doFetch<SerperSearchResponse>('search', socialQuery, apiKey, country).catch(e => {
        logger.warn('Social search failed', e);
        return { organic: [] } as SerperSearchResponse;
      });
      socialsContext = socialResult.organic || [];
    }
  } catch (error) {
    logger.timeEnd('serper-search');
    throw handleError(error, { query, strategy, country });
  }

  logger.timeEnd('serper-search');

  return {
    places: (placesResult?.places || []) as SerperPlace[],
    organic: (organicResult?.organic || []) as SerperOrganicResult[],
    knowledgeGraph: (organicResult?.knowledgeGraph || placesResult?.knowledgeGraph || null) as SerperKnowledgeGraph | null,
    decisionMakersContext,
    socialsContext,
    searchQuality,
  };
};
