
const CITIES = ['Montréal', 'Québec', 'Laval', 'Gatineau', 'Longueuil', 'Sherbrooke', 'Trois-Rivières'];

export const generateRelatedQueries = (query: string): string[] => {
    const originalCity = CITIES.find(city => query.toLowerCase().includes(city.toLowerCase()));
    
    if (!originalCity) return [];

    const baseQuery = query.toLowerCase().replace(originalCity.toLowerCase(), '').trim();
    if (!baseQuery) return [];

    return CITIES
        .filter(city => city !== originalCity)
        .slice(0, 2)
        .map(city => `${baseQuery} ${city}`);
};
