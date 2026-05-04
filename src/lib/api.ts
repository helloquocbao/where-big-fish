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

/**
 * GBIF: Search for fish species
 */
export async function searchSpecies(query: string = 'fish', limit: number = 20): Promise<SpeciesData[]> {
  try {
    const response = await fetch(`${GBIF_BASE_URL}/species/search?q=${encodeURIComponent(query)}&limit=${limit}&rank=SPECIES&status=ACCEPTED`);
    const data = await response.json();
    
    return data.results.map((item: any) => ({
      key: item.key,
      scientificName: item.scientificName,
      vernacularName: item.vernacularNames?.[0]?.vernacularName || item.canonicalName,
      canonicalName: item.canonicalName,
      image: `https://api.gbif.org/v1/species/${item.key}/descriptions` // Placeholder for image logic
    }));
  } catch (error) {
    console.error('Error fetching species from GBIF:', error);
    return [];
  }
}

/**
 * Overpass: Fetch fishing locations in a specific region (default: Vietnam)
 */
export async function getFishingLocations(lat: number = 10.8231, lon: number = 106.6297, radius: number = 50000): Promise<LocationData[]> {
  const query = `
    [out:json][timeout:25];
    (
      node["leisure"="fishing"](around:${radius},${lat},${lon});
      way["leisure"="fishing"](around:${radius},${lat},${lon});
      node["fishing"="yes"](around:${radius},${lat},${lon});
    );
    out center;
  `;

  try {
    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
    });
    const data = await response.json();
    
    return data.elements.map((el: any) => ({
      id: el.id,
      name: el.tags?.name || `Điểm câu #${el.id}`,
      lat: el.lat || el.center?.lat,
      lon: el.lon || el.center?.lon,
      type: el.tags?.leisure || 'fishing_spot',
      tags: el.tags || {}
    }));
  } catch (error) {
    console.error('Error fetching locations from Overpass:', error);
    return [];
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
    );
    out center;
  `;

  try {
    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
    });
    const data = await response.json();
    const el = data.elements[0];
    
    if (!el) return null;

    return {
      id: el.id,
      name: el.tags?.name || `Điểm câu #${el.id}`,
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
