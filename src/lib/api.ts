/**
 * API Service for "Where Big Fish"
 * Connects to GBIF (Global Biodiversity Information Facility) and OpenStreetMap (Overpass API)
 */

export interface SpeciesData {
  key: number;
  scientificName: string;
  vernacularName?: string;
  canonicalName: string;
  image?: string;
  description?: string;
}

export interface LocationData {
  id: string | number;
  name: string;
  lat: number;
  lon: number;
  type: string;
  tags: Record<string, string>;
}

const GBIF_BASE_URL = 'https://api.gbif.org/v1';
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Global Fishing Hotspots (Europe & America focus)
export const REGIONS = {
  FLORIDA: { lat: 27.6648, lon: -81.5158, name: 'Florida, USA' },
  NORWAY: { lat: 68.2232, lon: 14.5682, name: 'Lofoten, Norway' },
  GREAT_LAKES: { lat: 45.0, lon: -85.0, name: 'Great Lakes, NA' },
  ALASKA: { lat: 64.2, lon: -149.5, name: 'Alaska, USA' },
  UK_COAST: { lat: 50.7, lon: -1.3, name: 'English Channel, UK' }
};

const HEADERS = {
  'User-Agent': 'WhereBigFish/1.0 (https://wherebigfish.com; contact@wherebigfish.com)',
  'Content-Type': 'application/x-www-form-urlencoded'
};

/**
 * GBIF: Search for fish species
 */
export async function searchSpecies(query: string = 'fish', limit: number = 20): Promise<SpeciesData[]> {
  try {
    const response = await fetch(`${GBIF_BASE_URL}/species/search?q=${encodeURIComponent(query)}&limit=${limit}&rank=SPECIES&status=ACCEPTED`);
    if (!response.ok) throw new Error(`GBIF error: ${response.status}`);
    const data = await response.json();
    
    return data.results.map((item: any) => ({
      key: item.key,
      scientificName: item.scientificName,
      vernacularName: item.vernacularNames?.[0]?.vernacularName || item.canonicalName,
      canonicalName: item.canonicalName,
      image: `https://api.gbif.org/v1/species/${item.key}/descriptions` 
    }));
  } catch (error) {
    console.error('Error fetching species from GBIF:', error);
    return [];
  }
}

/**
 * Overpass: Fetch fishing locations in a specific region
 */
export async function getFishingLocations(lat: number, lon: number, radius: number = 50000): Promise<LocationData[]> {
  const query = `
    [out:json][timeout:30];
    (
      node["leisure"="fishing"](around:${radius},${lat},${lon});
      way["leisure"="fishing"](around:${radius},${lat},${lon});
      node["sport"="fishing"](around:${radius},${lat},${lon});
      node["amenity"="fishing_pond"](around:${radius},${lat},${lon});
      node["fishing"="yes"](around:${radius},${lat},${lon});
    );
    out center;
  `;

  try {
    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: HEADERS,
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) throw new Error(`Overpass error: ${response.status}`);

    const data = await response.json();
    
    return (data.elements || []).map((el: any) => ({
      id: el.id,
      name: el.tags?.name || `Fishing Spot #${el.id}`,
      lat: el.lat || el.center?.lat,
      lon: el.lon || el.center?.lon,
      type: el.tags?.leisure || el.tags?.sport || 'fishing_spot',
      tags: el.tags || {}
    }));
  } catch (error) {
    console.error('Error fetching locations from Overpass:', error);
    return [{
      id: 'fallback-florida',
      name: 'Key West, Florida (Sample)',
      lat: 24.5551,
      lon: -81.7800,
      type: 'fishing_spot',
      tags: { description: 'API temporarily busy, showing sample US hotspot.' }
    }];
  }
}

/**
 * Overpass: Fetch details for a specific OSM element
 */
export async function getLocationById(id: string | number): Promise<LocationData | null> {
  const query = `
    [out:json][timeout:25];
    (
      node(${id});
      way(${id});
      relation(${id});
    );
    out center;
  `;

  try {
    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: HEADERS,
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) throw new Error(`Overpass error: ${response.status}`);

    const data = await response.json();
    const el = data.elements?.[0];
    
    if (!el) return null;

    return {
      id: el.id,
      name: el.tags?.name || `Fishing Spot #${el.id}`,
      lat: el.lat || el.center?.lat,
      lon: el.lon || el.center?.lon,
      type: el.tags?.leisure || 'fishing_spot',
      tags: el.tags || {}
    };
  } catch (error) {
    console.error('Error fetching location details:', error);
    return null;
  }
}
